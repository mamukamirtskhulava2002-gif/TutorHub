import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// GET  — admin only: list active (not yet expired) recordings
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "ადმინი ხარ?" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("lesson_recordings")
    .select(`
      id, booking_id, recording_url, created_at, expires_at,
      bookings(
        date, time_slot, total_price, duration_hours,
        profiles!student_id(full_name),
        tutors!tutor_id(profiles(full_name), subject)
      )
    `)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

// POST — tutor or system: save a lesson session record (expires in 24h)
export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { booking_id, recording_url } = await request.json();
  if (!booking_id) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  const { data: booking } = await supabase
    .from("bookings")
    .select("tutor_id, student_id")
    .eq("id", booking_id)
    .single();

  if (!booking || (booking.tutor_id !== user.id && booking.student_id !== user.id)) {
    return NextResponse.json({ error: "წვდომა აკრძალულია" }, { status: 403 });
  }

  const roomUrl = recording_url || `https://meet.jit.si/TutorHub-Room-${booking_id}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("lesson_recordings").upsert(
    { booking_id, recording_url: roomUrl, expires_at: expiresAt },
    { onConflict: "booking_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, expires_at: expiresAt });
}
