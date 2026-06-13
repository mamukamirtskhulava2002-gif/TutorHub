import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    }

    const { id: bookingId } = await params;

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select(`
        id, student_id, tutor_id, status, date, time_slot, total_price, duration_hours,
        profiles!student_id(full_name),
        tutors!tutor_id(profiles(full_name), subject)
      `)
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
        { error: `ჯავშანი არ არის დადასტ. სტატუსი: ${booking.status}` },
        { status: 400 }
      );
    }

    // Lesson must have started at least 10 minutes ago
    const lessonStart = new Date(`${booking.date}T${booking.time_slot}:00`);
    const now = new Date();
    const minutesSinceStart = (now - lessonStart) / 60000;
    if (minutesSinceStart < 10) {
      return NextResponse.json(
        { error: "გაკვეთილის დაწყებიდან 10 წუთი ჯერ არ გასულა" },
        { status: 400 }
      );
    }

    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Update booking: mark absent + set 24h auto-release window
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "student_absent",
        completed_by_tutor_at: now.toISOString(),
        completion_token_expires_at: expiresAt,
      })
      .eq("id", bookingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Create dispute record
    await supabase.from("disputes").insert({
      booking_id: bookingId,
      tutor_id: user.id,
      student_id: booking.student_id,
      reason: "student_absent: მოსწავლე არ გამოცხადდა გაკვეთილზე. 24 საათში თანხა ავტომატურად ირიცხება.",
      status: "open",
    }).catch(() => {});

    // Notify student
    await supabase.from("notifications").insert({
      user_id: booking.student_id,
      type: "booking",
      title: "⚠️ მასწავლებელი გელოდებათ",
      body: "მასწავლებელი გელოდებათ გაკვეთილზე. გთხოვთ, შეუერთდეთ, წინააღმდეგ შემთხვევაში გაკვეთილი ჩათვლილი იქნება ჩატარებულად.",
      link: `/lesson/${bookingId}`,
      is_read: false,
    }).catch(() => {});

    const studentName = booking.profiles?.full_name || "სტუდენტი";
    const tutorName   = booking.tutors?.profiles?.full_name || "მასწავლებელი";
    const subject     = booking.tutors?.subject?.[0] || "გაკვეთილი";
    const lessonLabel = `${booking.date} ${booking.time_slot?.slice(0, 5)} — ${subject}`;

    // Notify parent(s) if student has linked parent
    const { data: parentLinks } = await supabase
      .from("parent_children")
      .select("parent_id")
      .eq("child_id", booking.student_id);

    if (parentLinks?.length) {
      await supabase.from("notifications").insert(
        parentLinks.map(p => ({
          user_id: p.parent_id,
          type: "booking",
          title: `⚠️ ${studentName} გაკვეთილს არ დაესწრო`,
          body: `${tutorName}-თან ${lessonLabel} — შვილი გაკვეთილზე არ გამოცხადდა. 24სთ-ში საკითხი ავტ. მოგვარდება.`,
          link: "/dashboard/parent",
          is_read: false,
        }))
      ).catch(() => {});
    }

    // Notify admin
    const { data: admins } = await supabase
      .from("profiles").select("id").eq("role", "admin").limit(3);
    if (admins?.length) {
      await supabase.from("notifications").insert(
        admins.map(a => ({
          user_id: a.id,
          type: "admin",
          title: "⚠️ მოსწავლე არ გამოცხადდა",
          body: `${studentName} — ${lessonLabel} (${tutorName}). 24სთ-ში ავტ. მოგვარება.`,
          link: "/dashboard/admin/disputes",
          is_read: false,
        }))
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, auto_release_at: expiresAt });
  } catch (err) {
    console.error("student-absent error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
