import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

// POST /api/lesson-slots/[id]/cancel-enrollment
// Cancels enrollment and notifies first person on waitlist
export async function POST(request, { params }) {
  const { id: slotId } = await params;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Load slot
  const { data: slot } = await admin
    .from("lesson_slots").select("*").eq("id", slotId).single();
  if (!slot) return NextResponse.json({ error: "სლოტი ვერ მოიძებნა" }, { status: 404 });

  // Only the enrolled student or tutor can cancel
  const isTutor   = slot.tutor_id === user.id;
  const isStudent = !isTutor;

  if (isTutor) {
    // Tutor cancels the whole slot
    await admin.from("lesson_slots").update({ status: "cancelled" }).eq("id", slotId);
    // Notify all enrolled students
    const { data: enrollments } = await admin
      .from("slot_enrollments").select("student_id").eq("slot_id", slotId).eq("status", "enrolled");
    if (enrollments?.length) {
      await admin.from("notifications").insert(enrollments.map(e => ({
        user_id: e.student_id, type: "system",
        title:   "❌ სლოტი გაუქმდა",
        body:    `მასწავლებელმა გააუქმა სლოტი: ${slot.date} ${slot.time_slot}.`,
        is_read: false,
      })));
    }
    return NextResponse.json({ cancelled: "slot" });
  }

  // Student cancels own enrollment
  const { data: enr } = await admin
    .from("slot_enrollments").select("id").eq("slot_id", slotId).eq("student_id", user.id).maybeSingle();
  if (!enr) return NextResponse.json({ error: "ჩარიცხვა ვერ მოიძებნა" }, { status: 404 });

  await admin.from("slot_enrollments").update({ status: "cancelled" }).eq("id", enr.id);

  // Re-open slot if was full
  if (slot.status === "full") {
    await admin.from("lesson_slots").update({ status: "open" }).eq("id", slotId);
  }

  // Notify first waitlisted person
  const { data: first } = await admin
    .from("slot_waitlist")
    .select("id, student_id")
    .eq("slot_id", slotId).eq("status", "waiting")
    .order("joined_at").limit(1).maybeSingle();

  if (first) {
    await admin.from("slot_waitlist").update({ status: "notified", notified_at: new Date().toISOString() }).eq("id", first.id);
    await admin.from("notifications").insert({
      user_id: first.student_id, type: "system",
      title:   "🎉 ადგილი გამოთავისუფლდა!",
      body:    `სლოტზე ${slot.date} ${slot.time_slot} ადგილი გამოთავისუფლდა! შეგიძლია ჩაეწერო. ↗ ჩარიცხვა.`,
      is_read: false,
    });
  }

  return NextResponse.json({ cancelled: "enrollment", notifiedWaitlist: !!first });
}
