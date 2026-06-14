import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    const user = session.user;

    const { id: bookingId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body?.reason || null;

    const { data: booking, error: fetchError } = await supabase
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

    // Cancellation policy: student cancels <2h before lesson → no refund (tutor still gets paid)
    const lessonTime  = new Date(`${booking.date}T${booking.time_slot || "00:00"}:00`);
    const hoursUntil  = (lessonTime - Date.now()) / 3600000;
    const lessonPast  = hoursUntil <= 0;
    const lateCancelPenalty = isStudent && booking.status === "confirmed" && hoursUntil < 2 && hoursUntil > -48;

    const updateData = {
      status: "cancelled",
      ...(reason ? { cancel_reason: reason } : {}),
    };
    const { error: updateError } = await supabase.from("bookings").update(updateData).eq("id", bookingId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    let creditRefunded = 0;

    if (!lateCancelPenalty && booking.total_price > 0) {
      // Refund to student credit balance
      const { data: profile } = await supabase
        .from("profiles").select("credit_balance").eq("id", booking.student_id).single();
      const newBalance = (profile?.credit_balance || 0) + booking.total_price;

      await supabase.from("profiles")
        .update({ credit_balance: newBalance }).eq("id", booking.student_id);

      await supabase.from("credit_transactions").insert({
        user_id:    booking.student_id,
        amount:     booking.total_price,
        reason:     isStudent ? "student_cancelled" : "tutor_cancelled",
        booking_id: bookingId,
      }).catch(() => {});

      creditRefunded = booking.total_price;
    }

    // If late cancel penalty: mark tutor as entitled to pay (process payment to tutor)
    if (lateCancelPenalty && booking.total_price > 0) {
      await supabase.from("notifications").insert({
        user_id: booking.tutor_id, type: "payment",
        title: "გაკვეთილი გაუქმდა — გადახდა ჩაირიცხება ✓",
        body: `სტუდენტმა გაუქმა 2 საათამდე — ${booking.total_price} ₾ ჩაირიცხება.`,
        link: "/dashboard/tutor/income", is_read: false,
      }).catch(() => {});
    }

    // Notify the other party
    const notifyId = isStudent ? booking.tutor_id : booking.student_id;
    const notifyLink = isStudent ? "/dashboard/tutor/bookings" : "/dashboard/student/lessons";
    await supabase.from("notifications").insert({
      user_id: notifyId, type: "booking",
      title: "ჯავშანი გაუქმდა ❌",
      body: reason
        ? `გაუქმების მიზეზი: ${reason}`
        : isStudent ? "სტუდენტმა ჯავშანი გააუქმა." : "მასწავლებელმა ჯავშანი გააუქმა.",
      link: notifyLink, is_read: false,
    }).catch(() => {});

    return NextResponse.json({ success: true, credit_refunded: creditRefunded || null, late_penalty: lateCancelPenalty });
  } catch (err) {
    console.error("cancel error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
