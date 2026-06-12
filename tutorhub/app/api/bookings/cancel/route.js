import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const PENALTY_PCT    = 0.20; // 20% penalty from tutor if late cancel
const FREE_CANCEL_H  = 24;   // free cancellation window (hours)
const MONTHLY_LIMIT  = 3;    // max cancellations per month before flag

export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { bookingId, reason } = await request.json();
    if (!bookingId) return NextResponse.json({ error: "bookingId სავალდებულოა" }, { status: 400 });

    const admin = createAdminClient();

    // ── Load booking ──
    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, tutor_id, student_id, date, time_slot, total_price, status, duration_hours")
      .eq("id", bookingId)
      .single();

    if (bErr || !booking)  return NextResponse.json({ error: "ჯავშანი ვერ მოიძებნა" }, { status: 404 });
    if (booking.status === "cancelled") return NextResponse.json({ error: "უკვე გაუქმებულია" }, { status: 400 });
    if (booking.status === "done")      return NextResponse.json({ error: "დასრულებული გაკვეთილი გაუქმება შეუძლებელია" }, { status: 400 });

    const isTutor   = booking.tutor_id   === user.id;
    const isStudent = booking.student_id === user.id;
    if (!isTutor && !isStudent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // ── Calculate hours until lesson ──
    const lessonAt = new Date(`${booking.date}T${booking.time_slot || "00:00"}:00`);
    const hoursLeft = (lessonAt - Date.now()) / 3_600_000;
    const isLate    = hoursLeft < FREE_CANCEL_H;
    const price     = Number(booking.total_price || 0);

    // ── Determine refund amounts ──
    let studentRefund = 0;
    let tutorPenalty  = 0;

    if (!isLate) {
      // Free cancel window — full refund, no penalty
      studentRefund = price;
      tutorPenalty  = 0;
    } else if (isTutor) {
      // Tutor late cancel — full refund to student + 20% penalty from tutor
      studentRefund = price;
      tutorPenalty  = Math.round(price * PENALTY_PCT * 100) / 100;
    } else {
      // Student late cancel — 50% refund
      studentRefund = Math.round(price * 0.5 * 100) / 100;
      tutorPenalty  = 0;
    }

    // ── Update booking status ──
    await admin.from("bookings").update({
      status:            "cancelled",
      cancelled_by:      isTutor ? "tutor" : "student",
      cancellation_reason: reason || null,
      cancelled_at:      new Date().toISOString(),
    }).eq("id", bookingId);

    // ── Wallet: refund student ──
    if (studentRefund > 0) {
      await admin.rpc("increment_wallet", { p_user_id: booking.student_id, p_amount: studentRefund });
    }

    // ── Wallet: deduct tutor penalty ──
    if (tutorPenalty > 0) {
      await admin.rpc("increment_wallet", { p_user_id: booking.tutor_id, p_amount: -tutorPenalty });
    }

    // ── Monthly cancellation counter + trust index (tutor) ──
    if (isTutor) {
      const nowMonth = new Date().toISOString().slice(0, 7);
      const { data: tutorRow } = await admin
        .from("tutors")
        .select("monthly_cancellations, cancellations_month, total_booked_lessons, cancelled_by_tutor, is_frozen")
        .eq("id", booking.tutor_id)
        .single();

      const sameMonth  = tutorRow?.cancellations_month === nowMonth;
      const newMonthly = sameMonth ? (tutorRow.monthly_cancellations || 0) + 1 : 1;
      const newCancelled = (tutorRow?.cancelled_by_tutor || 0) + 1;
      const total        = tutorRow?.total_booked_lessons || 0;

      // Auto-freeze if trust index drops below 75% (min 5 confirmed bookings)
      const trustIndex  = total > 0 ? Math.round(((total - newCancelled) / total) * 100) : null;
      const shouldFreeze = trustIndex !== null && trustIndex < 75 && total >= 5 && !tutorRow?.is_frozen;
      const frozenUntil  = shouldFreeze
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      await admin.from("tutors").update({
        monthly_cancellations: newMonthly,
        cancellations_month:   nowMonth,
        cancelled_by_tutor:    newCancelled,
        ...(shouldFreeze ? { is_frozen: true, frozen_until: frozenUntil } : {}),
      }).eq("id", booking.tutor_id);

      // If limit exceeded → notify admins
      if (newMonthly > MONTHLY_LIMIT) {
        const { data: tutorProfile } = await admin
          .from("profiles").select("full_name").eq("id", booking.tutor_id).single();
        const { data: admins } = await admin
          .from("profiles").select("id").eq("role", "admin");

        if (admins?.length) {
          await admin.from("notifications").insert(admins.map(a => ({
            user_id: a.id,
            type:    "system",
            title:   "⚠️ მასწავლებელმა გადააჭარბა გაუქმების ლიმიტს",
            body:    `${tutorProfile?.full_name || "მასწ."}-მ ამ თვეში ${newMonthly}-ჯერ გააუქმა გაკვეთილი (ლიმიტი: ${MONTHLY_LIMIT}).`,
            is_read: false,
          })));
        }
      }

      // Notify tutor when auto-frozen
      if (shouldFreeze) {
        await admin.from("notifications").insert({
          user_id: booking.tutor_id,
          type:    "system",
          title:   "🔒 პროფილი დაბლოკილია",
          body:    `სანდოობის ინდექსი ${trustIndex}%-ზე ჩამოვიდა (ნებ. ≥75%). პროფილი 7 დღით შეჩერებულია.`,
          is_read: false,
        });
      }
    }

    // ── Notifications ──
    const otherUserId = isTutor ? booking.student_id : booking.tutor_id;
    const canceller   = isTutor ? "მასწავლებელმა" : "სტუდენტმა";

    let notifBody = isLate
      ? `${canceller} გააუქმა გაკვეთილი ${booking.date} ${booking.time_slot}-ზე (24 სთ-ზე ნაკლები).`
      : `${canceller} გააუქმა გაკვეთილი ${booking.date} ${booking.time_slot}-ზე.`;

    if (reason) notifBody += ` მიზეზი: "${reason}".`;

    if (studentRefund > 0) {
      notifBody += ` ${studentRefund} ₾ დაბრუნებულია საფულეში.`;
    }

    await admin.from("notifications").insert({
      user_id: otherUserId,
      type:    "system",
      title:   "❌ გაკვეთილი გაუქმდა",
      body:    notifBody,
      is_read: false,
    });

    return NextResponse.json({
      success:      true,
      studentRefund,
      tutorPenalty,
      isLate,
    });
  } catch (e) {
    console.error("cancel booking error:", e);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
