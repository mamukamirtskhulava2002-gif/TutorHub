import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// მიმდინარე მომხმარებლის ჯავშნების წამოღება
export async function GET() {
  try {
    const supabase = await createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        tutors (
          price_per_hour,
          subject,
          profiles ( full_name, avatar_url )
        )
      `)
      .or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`)
      .order("date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ახალი ჯავშნის შექმნა
export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    }

    const body = await request.json();
    const { tutorId, date, timeSlot, durationHours, format, totalPrice, note } = body;

    if (!tutorId || !date || !timeSlot || !format || !totalPrice) {
      return NextResponse.json({ error: "საჭირო ველები არ არის შევსებული" }, { status: 400 });
    }

    // double booking შემოწმება
    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("tutor_id", tutorId)
      .eq("date", date)
      .eq("time_slot", timeSlot)
      .in("status", ["pending", "confirmed"])
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "ეს დრო უკვე დაჯავშნილია" },
        { status: 409 }
      );
    }

    // expires_at = max(lesson start time, now + 24h)
    // If lesson is soon (< 24h away), tutor must confirm before lesson starts;
    // otherwise tutor has 24h from booking time to confirm.
    const lessonAt  = new Date(`${date}T${timeSlot}`);
    const in24h     = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const expiresAt = lessonAt > in24h ? in24h.toISOString() : lessonAt.toISOString();

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        student_id:     user.id,
        tutor_id:       tutorId,
        date,
        time_slot:      timeSlot,
        duration_hours: durationHours ?? 1,
        format,
        total_price:    totalPrice,
        note:           note ?? null,
        status:         "pending",
        expires_at:     expiresAt,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}