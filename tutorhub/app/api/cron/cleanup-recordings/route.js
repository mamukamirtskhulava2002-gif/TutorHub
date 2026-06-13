import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Runs every 4 hours — deletes lesson_recordings where expires_at < now
// Also auto-releases student_absent bookings after 24h (pays tutor)
export async function POST(request) {
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  const now = new Date().toISOString();
  let results = {};

  // 1. Delete expired lesson recordings
  const { count: deletedRecordings, error: recErr } = await supabase
    .from("lesson_recordings")
    .delete({ count: "exact" })
    .lt("expires_at", now);

  if (recErr) console.error("cleanup-recordings error:", recErr.message);
  results.deletedRecordings = deletedRecordings || 0;

  // 2. Auto-release student_absent bookings after 24h → pay tutor
  const { data: absentBookings, error: abErr } = await supabase
    .from("bookings")
    .select(`
      id, student_id, tutor_id, total_price, date, time_slot,
      profiles!student_id(full_name),
      tutors!tutor_id(profiles(full_name), subject)
    `)
    .eq("status", "student_absent")
    .lt("completion_token_expires_at", now);

  if (abErr) console.error("student_absent query error:", abErr.message);

  let releasedCount = 0;
  for (const b of absentBookings || []) {
    try {
      const { error: upErr } = await supabase
        .from("bookings")
        .update({ status: "done", auto_completed_at: now, student_confirmed_at: now })
        .eq("id", b.id)
        .eq("status", "student_absent");

      if (upErr) { console.error(`auto-release error ${b.id}:`, upErr.message); continue; }

      // Auto-close the dispute
      await supabase.from("disputes")
        .update({
          status: "resolved",
          admin_note: "ავტო: სტუდენტი 24სთ-ში არ გამოცხადდა — თანხა გადაეცა მასწ.",
          resolved_at: now,
        })
        .eq("booking_id", b.id)
        .eq("status", "open")
        .ilike("reason", "student_absent%");

      // Notify tutor
      await supabase.from("notifications").insert({
        user_id: b.tutor_id,
        type: "payment",
        title: "💰 გადახდა მიღებულია",
        body: `მოსწავლე 24სთ-ში არ გამოცხ. — ${b.total_price}₾ ჩაირიცხა.`,
        link: "/dashboard/tutor/income",
        is_read: false,
      }).catch(() => {});

      const studentName = b.profiles?.full_name || "სტუდენტი";
      const tutorName   = b.tutors?.profiles?.full_name || "მასწავლებელი";
      const subject     = b.tutors?.subject?.[0] || "გაკვეთილი";
      const lessonLabel = `${b.date} ${(b.time_slot || "").slice(0, 5)} — ${subject}`;

      // Notify student
      await supabase.from("notifications").insert({
        user_id: b.student_id,
        type: "booking",
        title: "გაკვეთილი ჩათვლილია ჩატარებულად",
        body: `${lessonLabel} (${tutorName}) — 24სთ გასვლის შემდეგ თანხა მასწავ. გადაეცა.`,
        link: "/dashboard/student/lessons",
        is_read: false,
      }).catch(() => {});

      // Notify parent(s)
      const { data: parentLinks } = await supabase
        .from("parent_children")
        .select("parent_id")
        .eq("child_id", b.student_id);

      if (parentLinks?.length) {
        await supabase.from("notifications").insert(
          parentLinks.map(p => ({
            user_id: p.parent_id,
            type: "booking",
            title: `📋 ${studentName}-ის გაკვეთილი ჩათვ. ჩატ.`,
            body: `${tutorName}-თან ${lessonLabel} — შვილი არ გამოცხ., 24სთ შემდეგ ანგარიშსწორება მოხდა.`,
            link: "/dashboard/parent",
            is_read: false,
          }))
        ).catch(() => {});
      }

      releasedCount++;
    } catch (err) {
      console.error(`Error releasing absent booking ${b.id}:`, err.message);
    }
  }

  results.releasedAbsentBookings = releasedCount;
  return NextResponse.json(results);
}
