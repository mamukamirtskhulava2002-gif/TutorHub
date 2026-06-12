import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

// POST /api/lesson-slots/[id]/enroll
// If full → auto-join waitlist
export async function POST(request, { params }) {
  const { id: slotId } = await params;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Load slot
  const { data: slot, error: slotErr } = await admin
    .from("lesson_slots").select("*").eq("id", slotId).single();
  if (slotErr || !slot) return NextResponse.json({ error: "სლოტი ვერ მოიძებნა" }, { status: 404 });
  if (slot.status === "cancelled")  return NextResponse.json({ error: "სლოტი გაუქმებულია" }, { status: 400 });
  if (slot.tutor_id === user.id)    return NextResponse.json({ error: "შენი საკუთარი სლოტია" }, { status: 400 });

  // Count active enrollments
  const { count: enrolled } = await admin
    .from("slot_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", slotId).eq("status", "enrolled");

  const isFull = enrolled >= slot.max_capacity;

  // Check if already enrolled or on waitlist
  const { data: existing } = await admin
    .from("slot_enrollments").select("id,status").eq("slot_id", slotId).eq("student_id", user.id).maybeSingle();
  if (existing?.status === "enrolled") return NextResponse.json({ error: "უკვე ჩარიცხული ხარ" }, { status: 409 });

  const { data: onWait } = await admin
    .from("slot_waitlist").select("id").eq("slot_id", slotId).eq("student_id", user.id).maybeSingle();

  if (isFull) {
    // Join waitlist if not already there
    if (onWait) return NextResponse.json({ error: "მომლოდინეთა სიაში უკვე ხარ" }, { status: 409 });

    const { count: waitPos } = await admin
      .from("slot_waitlist").select("id", { count: "exact", head: true })
      .eq("slot_id", slotId).eq("status", "waiting");

    await admin.from("slot_waitlist").insert({
      slot_id: slotId, student_id: user.id, status: "waiting",
    });

    // Notify student
    await admin.from("notifications").insert({
      user_id: user.id, type: "system",
      title:   "📋 მომლოდინეთა სიაში ხარ",
      body:    `სლოტი სავსეა. შენ ხარ #${(waitPos || 0) + 1} რიგში. გაკვეთილი: ${slot.date} ${slot.time_slot}.`,
      is_read: false,
    });

    return NextResponse.json({ enrolled: false, waitlisted: true, position: (waitPos || 0) + 1 });
  }

  // Enroll
  const { error: enrErr } = await admin.from("slot_enrollments").insert({
    slot_id: slotId, student_id: user.id, status: "enrolled",
  });
  if (enrErr) return NextResponse.json({ error: enrErr.message }, { status: 500 });

  // If now full → update slot status
  if (enrolled + 1 >= slot.max_capacity) {
    await admin.from("lesson_slots").update({ status: "full" }).eq("id", slotId);
  }

  // Notify tutor
  const { data: stdProfile } = await admin
    .from("profiles").select("full_name").eq("id", user.id).single();
  await admin.from("notifications").insert({
    user_id: slot.tutor_id, type: "system",
    title:   "🎉 ახალი ჩარიცხვა!",
    body:    `${stdProfile?.full_name || "სტ."} ჩაეწერა შენს სლოტზე: ${slot.date} ${slot.time_slot}. (${enrolled + 1}/${slot.max_capacity})`,
    is_read: false,
  });

  return NextResponse.json({ enrolled: true, enrolledCount: enrolled + 1, maxCapacity: slot.max_capacity });
}
