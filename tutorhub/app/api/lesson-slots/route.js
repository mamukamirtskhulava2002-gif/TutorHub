import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

// GET  /api/lesson-slots?tutorId=xxx&from=2026-06-01&to=2026-06-30
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tutorId = searchParams.get("tutorId");
  const from    = searchParams.get("from");
  const to      = searchParams.get("to");

  const supabase = await createSupabaseServer();

  let q = supabase
    .from("lesson_slots")
    .select("*, slot_enrollments(id, status, student_id), slot_waitlist(id, status)")
    .not("status", "eq", "cancelled")
    .order("date").order("time_slot");

  if (tutorId) q = q.eq("tutor_id", tutorId);
  if (from)    q = q.gte("date", from);
  if (to)      q = q.lte("date", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/lesson-slots
export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "tutor")
    return NextResponse.json({ error: "Only tutors can create slots" }, { status: 403 });

  const {
    bookingType = "single",
    isGroup = false,
    minStudents = 1,
    maxCapacity = 1,
    date,
    timeSlot,
    durationHours = 1,
    pricePerStudent,
    subject = [],
    weeksCount = 1,
  } = await request.json();

  if (!date || !timeSlot || pricePerStudent == null)
    return NextResponse.json({ error: "date, timeSlot, pricePerStudent სავალდებულოა" }, { status: 400 });

  const admin    = createAdminClient();
  const isRepeat = bookingType === "recurring" || bookingType === "package";
  const seriesId = isRepeat ? randomUUID() : null;

  // Build slots array
  const rows = Array.from({ length: isRepeat ? weeksCount : 1 }, (_, i) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + i * 7);
    return {
      tutor_id:          user.id,
      subject,
      date:              d.toLocaleDateString("en-CA"),
      time_slot:         timeSlot,
      duration_hours:    durationHours,
      booking_type:      bookingType,
      is_group:          isGroup,
      min_students:      isGroup ? minStudents : 1,
      max_capacity:      isGroup ? maxCapacity : 1,
      price_per_student: pricePerStudent,
      series_id:         seriesId,
      status:            "open",
    };
  });

  const { data: slots, error } = await admin
    .from("lesson_slots").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ slots }, { status: 201 });
}
