import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const PENALTY_PCT   = 0.20; // 20% penalty from tutor if late cancel
const FREE_CANCEL_H = 24;   // free cancellation window (hours)
const MONTHLY_LIMIT = 3;    // max cancellations per month before flag

export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { bookingId, seriesId, reason } = await request.json();
    if (!bookingId && !seriesId)
      return NextResponse.json({ error: "bookingId ან seriesId სავალდებულოა" }, { status: 400 });

    const admin = createAdminClient();

    // ══════════════════════════════════════════════
    // SERIES / PACKAGE CANCELLATION
    // ══════════════════════════════════════════════
    if (seriesId) {
      const { data: series } = await admin
        .from("booking_series")
        .select("student_id, tutor_id, total_sessions")
        .eq("id", seriesId)
        .single();

      if (!series) return NextResponse.json({ error: "სერია ვერ მოიძებნა" }, { status: 404 });
      if (series.tutor_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      // All active bookings in the series
      const { data: activeBookings } = await admin
        .from("bookings")
        .select("id, date, time_slot, total_price, package_id")
        .eq("series_id", seriesId)
        .in("status", ["pending", "confirmed"]);

      const remaining    = activeBookings?.length || 0;
      const totalSessions = series.total_sessions || 0;

      // Get package price for proportional refund
      let packagePrice = 0;
      const packageId = activeBookings?.find(b => b.package_id)?.package_id;
      if (packageId) {
        const { data: pkg } = await admin
          .from("packages")
          .select("total_price")
          .eq("id", packageId)
          .single();
        packagePrice = pkg?.total_price || 0;
      }

      // Refund = proportional share of package price for remaining sessions
      // Fallback: sum individual booking prices (for recurring series without a package)
      let studentRefund = 0;
      if (totalSessions > 0 && packagePrice > 0) {
        studentRefund = Math.round((packagePrice * remaining / totalSessions) * 100) / 100;
      } else {
        studentRefund = (activeBookings || []).reduce((s, b) => s + Number(b.total_price || 0), 0);
      }

      // 24h rule: count how many active bookings are within 24h → tutor 20% penalty on that share
      const now = Date.now();
      const lateCount = (activeBookings || []).filter(b => {
        const t = new Date(`${b.date}T${b.time_slot || "00:00"}:00`);
        return (t - now) / 3600000 < FREE_CANCEL_H;
      }).length;

      let tutorPenalty = 0;
      if (lateCount > 0 && totalSessions > 0 && packagePrice > 0) {
        tutorPenalty = Math.round(packagePrice * (lateCount / totalSessions) * PENALTY_PCT * 100) / 100;
      }

      // Cancel all active bookings + the series
      await admin.from("bookings").update({
        status:              "cancelled",
        cancelled_by:        "tutor",
        cancellation_reason: reason || null,
        cancelled_at:        new Date().toISOString(),
      }).eq("series_id", seriesId).in("status", ["pending", "confirmed"]);

      await admin.from("booking_series").update({ status: "cancelled" }).eq("id", seriesId);

      // Wallet: refund student
      if (studentRefund > 0) {
        await admin.rpc("increment_wallet", { p_user_id: series.student_id, p_amount: studentRefund });
      }

      // Wallet: deduct tutor penalty
      if (tutorPenalty > 0) {
        await admin.rpc("increment_wallet", { p_user_id: series.tutor_id, p_amount: -tutorPenalty });
      }

      // Monthly cancellation counter
      const nowMonth = new Date().toISOString().slice(0, 7);
      const { data: tutorRow } = await admin
        .from("tutors")
        .select("monthly_cancellations, cancellations_month")
        .eq("id", series.tutor_id)
        .single();
      const sameMonth  = tutorRow?.cancellations_month === nowMonth;
      const newMonthly = sameMonth ? (tutorRow.monthly_cancellations || 0) + 1 : 1;
      await admin.from("tutors").update({
        monthly_cancellations: newMonthly,
        cancellations_month:   nowMonth,
      }).eq("id", series.tutor_id);

      if (newMonthly > MONTHLY_LIMIT) {
        const { data: tutorProfile } = await admin.from("profiles").select("full_name").eq("id", series.tutor_id).single();
        const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
        if (admins?.length) {
          try {
            await admin.from("notifications").insert(admins.map(a => ({
              user_id: a.id, type: "system",
              title: "⚠️ მასწავლებელმა გადააჭარბა გაუქმების ლიმიტს",
              body: `${tutorProfile?.full_name || "მასწ."}-მ ამ თვეში ${newMonthly}-ჯერ გააუქმა (ლიმიტი: ${MONTHLY_LIMIT}).`,
              is_read: false,
            })));
          } catch {}
        }
      }

      // Notify student
      let notifBody = `მასწავლებელმა პაკეტი გააუქმა.`;
      if (reason) notifBody += ` მიზეზი: "${reason}".`;
      if (studentRefund > 0) notifBody += ` ${studentRefund}₾ საფულეში ჩაირიცხა.`;
      if (tutorPenalty > 0) notifBody += ` (${tutorPenalty}₾ ჯარიმა დაეკისრა მასწავლებელს)`;

      try {
        await admin.from("notifications").insert({
          user_id: series.student_id, type: "booking",
          title: "პაკეტი გაუქმდა ❌",
          body:  notifBody,
          link:  "/dashboard/student/lessons", is_read: false,
        });
      } catch {}

      return NextResponse.json({ success: true, studentRefund, tutorPenalty });
    }

    // ══════════════════════════════════════════════
    // SINGLE BOOKING CANCELLATION
    // ══════════════════════════════════════════════
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

    // Calculate hours until lesson
    const lessonAt   = new Date(`${booking.date}T${booking.time_slot || "00:00"}:00`);
    const hoursLeft  = (lessonAt - Date.now()) / 3_600_000;
    const isLate     = hoursLeft < FREE_CANCEL_H;
    const price      = Number(booking.total_price || 0);

    // Determine refund amounts
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
      // Student late cancel — blocked in UI (canCancel), but if somehow called: no refund
      studentRefund = 0;
      tutorPenalty  = 0;
    }

    // Update booking status
    await admin.from("bookings").update({
      status:              "cancelled",
      cancelled_by:        isTutor ? "tutor" : "student",
      cancellation_reason: reason || null,
      cancelled_at:        new Date().toISOString(),
    }).eq("id", bookingId);

    // Wallet: refund student
    if (studentRefund > 0) {
      await admin.rpc("increment_wallet", { p_user_id: booking.student_id, p_amount: studentRefund });
    }

    // Wallet: deduct tutor penalty
    if (tutorPenalty > 0) {
      await admin.rpc("increment_wallet", { p_user_id: booking.tutor_id, p_amount: -tutorPenalty });
    }

    // Monthly cancellation counter + trust index (tutor)
    if (isTutor) {
      const nowMonth = new Date().toISOString().slice(0, 7);
      const { data: tutorRow } = await admin
        .from("tutors")
        .select("monthly_cancellations, cancellations_month, total_booked_lessons, cancelled_by_tutor")
        .eq("id", booking.tutor_id)
        .single();

      const sameMonth    = tutorRow?.cancellations_month === nowMonth;
      const newMonthly   = sameMonth ? (tutorRow.monthly_cancellations || 0) + 1 : 1;
      const newCancelled = (tutorRow?.cancelled_by_tutor || 0) + 1;
      const total        = tutorRow?.total_booked_lessons || 0;

      const { data: firstDone } = await admin
        .from("bookings")
        .select("date, student_confirmed_at, auto_completed_at")
        .eq("tutor_id", booking.tutor_id)
        .eq("status", "done")
        .order("date", { ascending: true })
        .limit(1)
        .maybeSingle();

      const firstLessonDate = firstDone
        ? new Date(firstDone.student_confirmed_at || firstDone.auto_completed_at || firstDone.date + "T00:00:00Z")
        : null;
      const graceEndsAt = firstLessonDate ? new Date(firstLessonDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
      const pastGrace   = graceEndsAt ? Date.now() > graceEndsAt.getTime() : false;
      const trustIndex  = total > 0 ? Math.round(((total - newCancelled) / total) * 100) : null;
      const warnTutor   = pastGrace && trustIndex !== null && trustIndex < 75;

      await admin.from("tutors").update({
        monthly_cancellations: newMonthly,
        cancellations_month:   nowMonth,
        cancelled_by_tutor:    newCancelled,
      }).eq("id", booking.tutor_id);

      if (newMonthly > MONTHLY_LIMIT) {
        const { data: tutorProfile } = await admin.from("profiles").select("full_name").eq("id", booking.tutor_id).single();
        const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
        if (admins?.length) {
          try {
            await admin.from("notifications").insert(admins.map(a => ({
              user_id: a.id, type: "system",
              title: "⚠️ მასწავლებელმა გადააჭარბა გაუქმების ლიმიტს",
              body: `${tutorProfile?.full_name || "მასწ."}-მ ამ თვეში ${newMonthly}-ჯერ გააუქმა გაკვეთილი (ლიმიტი: ${MONTHLY_LIMIT}).`,
              is_read: false,
            })));
          } catch {}
        }
      }

      if (warnTutor) {
        try {
          await admin.from("notifications").insert({
            user_id: booking.tutor_id, type: "system",
            title: "⚠️ სანდოობის ინდექსი დაეცა",
            body: `სანდოობის ინდექსი ${trustIndex}%-ზე ჩამოვიდა (ნებ. ≥75%). ეს მოქმედებს ძიებაში ვარსკვლავის რეიტინგზე.`,
          });
        } catch {}
      }
    }

    // Notifications
    const otherUserId = isTutor ? booking.student_id : booking.tutor_id;
    const canceller   = isTutor ? "მასწავლებელმა" : "სტუდენტმა";
    let notifBody = isLate
      ? `${canceller} გააუქმა გაკვეთილი ${booking.date} ${booking.time_slot}-ზე (24 სთ-ზე ნაკლები).`
      : `${canceller} გააუქმა გაკვეთილი ${booking.date} ${booking.time_slot}-ზე.`;
    if (reason) notifBody += ` მიზეზი: "${reason}".`;
    if (studentRefund > 0) notifBody += ` ${studentRefund}₾ დაბრუნებულია საფულეში.`;

    await admin.from("notifications").insert({
      user_id: otherUserId, type: "system",
      title: "❌ გაკვეთილი გაუქმდა",
      body:  notifBody,
      is_read: false,
    });

    return NextResponse.json({ success: true, studentRefund, tutorPenalty, isLate });
  } catch (e) {
    console.error("cancel booking error:", e);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
