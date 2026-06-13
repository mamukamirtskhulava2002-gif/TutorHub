import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const supabase = await createSupabaseServer();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    }

    const { id: bookingId } = await params;

    // Fetch booking and verify the caller is the tutor
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, student_id, tutor_id, status, date, time_slot, total_price")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "ჯავშანი ვერ მოიძებნა" }, { status: 404 });
    }

    if (booking.tutor_id !== user.id) {
      return NextResponse.json({ error: "წვდომა აკრძალულია" }, { status: 403 });
    }

    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: `ჯავშანი ვერ დასრულდება (სტატუსი: ${booking.status})` },
        { status: 400 }
      );
    }

    // Generate completion token and expiry (now + 26 hours)
    const completionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

    // Update booking
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "completed_by_tutor",
        completed_by_tutor_at: new Date().toISOString(),
        completion_token: completionToken,
        completion_token_expires_at: expiresAt,
      })
      .eq("id", bookingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Notify student
    await supabase
      .from("notifications")
      .insert({
        user_id: booking.student_id,
        type: "booking",
        title: "გაკვეთილი დასრულდა ✓",
        body: "მასწავლებელმა გაკვეთილი დასრულებულად მონიშნა ✓  — 24 საათი გაქვს დასადასტ.",
        link: "/dashboard/student/lessons",
        is_read: false,
      })
      .catch((err) => console.error("Notification error:", err.message));

    // Save lesson session record (visible to admin for 24h)
    await supabase.from("lesson_recordings").upsert(
      {
        booking_id: bookingId,
        recording_url: `https://meet.jit.si/TutorHub-Room-${bookingId}`,
        expires_at: expiresAt,
      },
      { onConflict: "booking_id" }
    ).catch(() => {});

    return NextResponse.json({ success: true, token: completionToken });
  } catch (err) {
    console.error("tutor-complete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
