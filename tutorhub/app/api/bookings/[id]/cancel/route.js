import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const FREE_CANCEL_H = 24;

export async function POST(request, { params }) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    const user = session.user;

    const { id: bookingId } = await params;
    const body   = await request.json().catch(() => ({}));
    const reason = body?.reason || null;

    const admin = createAdminClient();

    const { data: booking, error: fetchError } = await admin
      .from("bookings")
      .select("id, student_id, tutor_id, status, date, time_slot, total_price")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) return NextResponse.json({ error: "ჯავშანი ვერ მოიძებნა" }, { status: 404 });

    const isStudent = booking.student_id === user.id;
    const isTutor   = booking.tutor_id   === user.id;
    if (!isStudent && !isTutor) return NextResponse.json({ error: "წვდომა აკრძალულია" }, { status: 403 });

    const cancellableStatuses = ["pending", "confirmed"];
    if (!cancellableStatuses.includes(booking.status)) {
      return NextResponse.json({ error: `ჯავშანი ვერ გაუქმდება (სტატუსი: ${booking.status})` }, { status: 400 });
    }

    const lessonTime = new Date(`${booking.date}T${booking.time_slot || "00:00"}:00`);
    const hoursUntil = (lessonTime - Date.now()) / 3600000;

    // Students cannot cancel confirmed bookings less than 24h before the lesson
    if (isStudent && booking.status === "confirmed" && hoursUntil < FREE_CANCEL_H) {
      return NextResponse.json({
        error: "გაუქმება შეუძლებელია — გაკვეთილამდე 24 საათზე ნაკლებია და თანხა არ დაგიბრუნდება",
      }, { status: 400 });
    }

    const { error: updateError } = await admin.from("bookings").update({
      status:               "cancelled",
      cancelled_by:         isStudent ? "student" : "tutor",
      cancellation_reason:  reason || null,
      cancelled_at:         new Date().toISOString(),
    }).eq("id", bookingId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // Full refund — late cancel (<24h) is blocked above for students, so always full refund here
    let creditRefunded = 0;
    const price = Number(booking.total_price || 0);
    if (price > 0) {
      await admin.rpc("increment_wallet", { p_user_id: booking.student_id, p_amount: price });
      creditRefunded = price;
    }

    // Notify other party
    const notifyId   = isStudent ? booking.tutor_id  : booking.student_id;
    const notifyLink = isStudent ? "/dashboard/tutor/bookings" : "/dashboard/student/lessons";
    let notifBody = reason
      ? `გაუქმების მიზეზი: ${reason}`
      : isStudent ? "სტუდენტმა ჯავშანი გააუქმა." : "მასწავლებელმა ჯავშანი გააუქმა.";
    if (creditRefunded > 0) notifBody += ` ${creditRefunded}₾ საფულეში დაბრუნდა.`;
    try {
      await admin.from("notifications").insert({
        user_id: notifyId, type: "booking",
        title:   "ჯავშანი გაუქმდა ❌",
        body:    notifBody,
        link:    notifyLink, is_read: false,
      });
    } catch {}

    return NextResponse.json({ success: true, credit_refunded: creditRefunded || null });
  } catch (err) {
    console.error("cancel error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
