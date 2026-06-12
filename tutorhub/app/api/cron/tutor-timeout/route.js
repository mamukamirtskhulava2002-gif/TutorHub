import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request) {
  // Validate cron secret
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient();

    // 48 hours ago
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const cutoffDate = fortyEightHoursAgo.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const cutoffTime = fortyEightHoursAgo.toTimeString().slice(0, 5);   // HH:MM

    // Find confirmed bookings where the lesson ended more than 48h ago
    // and tutor never marked it complete
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, student_id, tutor_id, total_price, date, time_slot")
      .eq("status", "confirmed");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // Filter to bookings where lesson was > 48h ago
    const timedOutBookings = bookings.filter((b) => {
      if (!b.date || !b.time_slot) return false;
      const lessonDateTime = new Date(`${b.date}T${b.time_slot}`);
      return lessonDateTime < fortyEightHoursAgo;
    });

    if (timedOutBookings.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // Get admin profile for admin notifications
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(5);

    let processed = 0;

    for (const booking of timedOutBookings) {
      try {
        // Cancel the booking
        const { error: updateErr } = await supabase
          .from("bookings")
          .update({
            status: "cancelled",
            cancellation_reason: "tutor_timeout",
          })
          .eq("id", booking.id)
          .eq("status", "confirmed"); // guard against race condition

        if (updateErr) {
          console.error(`Failed to cancel booking ${booking.id}:`, updateErr.message);
          continue;
        }

        // Refund to student credit balance
        if (booking.total_price && booking.student_id) {
          await supabase
            .from("profiles")
            .select("credit_balance")
            .eq("id", booking.student_id)
            .single()
            .then(({ data: profile }) => {
              const current = profile?.credit_balance ?? 0;
              return supabase
                .from("profiles")
                .update({ credit_balance: current + booking.total_price })
                .eq("id", booking.student_id);
            })
            .catch((err) => console.error("Credit refund error:", err.message));

          // Insert credit transaction record
          await supabase
            .from("credit_transactions")
            .insert({
              user_id: booking.student_id,
              amount: booking.total_price,
              reason: "refund_tutor_timeout",
              booking_id: booking.id,
            })
            .catch((err) => console.error("Credit transaction error:", err.message));
        }

        // Notify student
        await supabase
          .from("notifications")
          .insert({
            user_id: booking.student_id,
            type: "booking",
            title: "გაკვეთილი გაუქმდა",
            body: "მასწავლებელმა გაკვეთილი ვერ დაადასტურა — თანხა დაბრუნდა კრედიტებში",
            link: "/dashboard/student/lessons",
            is_read: false,
          })
          .catch((err) => console.error("Student notification error:", err.message));

        // Notify tutor
        if (booking.tutor_id) {
          await supabase
            .from("notifications")
            .insert({
              user_id: booking.tutor_id,
              type: "booking",
              title: "ჯავშანი გაუქმდა ⚠️",
              body: "გაკვეთილი ავტომატურად გაუქმდა — 48 საათში ვერ მოახდინეთ დადასტურება",
              link: "/dashboard/tutor/bookings",
              is_read: false,
            })
            .catch((err) => console.error("Tutor notification error:", err.message));
        }

        // Notify admins
        if (adminProfiles && adminProfiles.length > 0) {
          const adminNotifications = adminProfiles.map((admin) => ({
            user_id: admin.id,
            type: "admin",
            title: "⚠️ ავტო-გაუქმება",
            body: `⚠️ გაკვეთილი ავტომატურად გაუქმდა (მასწ. არ დაადასტ.) — ჯავშ. #${booking.id.slice(0, 8)}`,
            link: "/dashboard/admin/bookings",
            is_read: false,
          }));
          await supabase
            .from("notifications")
            .insert(adminNotifications)
            .catch((err) => console.error("Admin notification error:", err.message));
        }

        processed++;
      } catch (err) {
        console.error(`Error processing tutor-timeout for booking ${booking.id}:`, err.message);
      }
    }

    return NextResponse.json({ processed });
  } catch (err) {
    console.error("tutor-timeout cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
