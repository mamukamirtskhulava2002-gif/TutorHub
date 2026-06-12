import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Called by cron every ~30 minutes.
// Sends a one-time reminder to tutors who have a confirmed lesson that ended
// more than 4 hours ago but haven't yet pressed "დასრულება".
export async function POST(request) {
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient();
    const now = Date.now();

    // Fetch all confirmed bookings with enough info to compute lesson-end time.
    // We also grab date/time/duration to filter in JS (avoids complex DB time math).
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, tutor_id, date, time_slot, duration_hours, profiles!student_id(full_name)")
      .eq("status", "confirmed");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!bookings?.length) return NextResponse.json({ reminded: 0 });

    // Keep only bookings where: lesson_end + 4h < now
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    const eligible = bookings.filter(b => {
      if (!b.date || !b.time_slot) return false;
      const start   = new Date(`${b.date}T${b.time_slot}`);
      const end     = new Date(start.getTime() + (b.duration_hours || 1) * 3600000);
      return end.getTime() + FOUR_HOURS < now;
    });

    if (!eligible.length) return NextResponse.json({ reminded: 0 });

    // Check which of these already received the reminder notification.
    // We store the booking id in the notification link so we can detect duplicates.
    const eligibleIds = eligible.map(b => b.id);
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("link")
      .eq("type", "remind_complete")
      .in("user_id", eligible.map(b => b.tutor_id));

    const alreadyReminded = new Set(
      (existingNotifs || []).map(n => {
        const m = n.link?.match(/remind=([a-f0-9-]+)/);
        return m ? m[1] : null;
      }).filter(Boolean)
    );

    const toRemind = eligible.filter(b => !alreadyReminded.has(b.id));
    if (!toRemind.length) return NextResponse.json({ reminded: 0 });

    let reminded = 0;
    for (const b of toRemind) {
      const studentName = b.profiles?.full_name || "სტუდენტი";
      const lessonLabel = `${b.date} ${b.time_slot?.slice(0, 5)}`;

      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id:  b.tutor_id,
        type:     "remind_complete",
        title:    "⏰ გაკვეთილი დასრულდა — დაადასტურეთ",
        body:     `${lessonLabel}-ზე ${studentName}-სთან გაკვეთილი 4 საათზე მეტია დასრულდა. დააჭირეთ "დასრულება"-ს, რათა თანხა ჩაირიცხოს.`,
        link:     `/dashboard/tutor/bookings?remind=${b.id}`,
        is_read:  false,
      });

      if (!notifErr) reminded++;
    }

    return NextResponse.json({ reminded });
  } catch (err) {
    console.error("remind-tutor-complete cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
