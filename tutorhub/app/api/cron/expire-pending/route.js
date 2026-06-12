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
    const now = new Date().toISOString();
    // 2 hours ago for fallback check
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Find expired pending bookings:
    // 1. Those with an explicit expires_at that has passed
    // 2. OR those without expires_at where date+time is more than 2 hours in the past
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, student_id, tutor_id, total_price, expires_at, date, time_slot")
      .eq("status", "pending");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // Filter to only truly expired ones
    const expiredBookings = bookings.filter((b) => {
      if (b.expires_at) {
        return b.expires_at < now;
      }
      // Fallback: check if lesson date+time is > 2h ago
      if (b.date && b.time_slot) {
        const lessonDateTime = new Date(`${b.date}T${b.time_slot}`).toISOString();
        return lessonDateTime < twoHoursAgo;
      }
      return false;
    });

    if (expiredBookings.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let processed = 0;

    for (const booking of expiredBookings) {
      try {
        // Cancel the booking
        const { error: updateErr } = await supabase
          .from("bookings")
          .update({
            status: "cancelled",
            cancellation_reason: "auto_expired",
          })
          .eq("id", booking.id)
          .eq("status", "pending"); // guard against race condition

        if (updateErr) {
          console.error(`Failed to expire booking ${booking.id}:`, updateErr.message);
          continue;
        }

        // Refund to student credit balance
        if (booking.total_price && booking.student_id) {
          const { error: creditErr } = await supabase.rpc("increment_credit_balance", {
            p_user_id: booking.student_id,
            p_amount: booking.total_price,
          }).catch(() => {
            // Fallback if RPC not available: manual update
            return supabase
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
              });
          });

          if (creditErr) {
            console.error(`Credit refund failed for booking ${booking.id}:`, creditErr.message);
          }

          // Insert credit transaction record
          await supabase
            .from("credit_transactions")
            .insert({
              user_id: booking.student_id,
              amount: booking.total_price,
              reason: "refund_expired_booking",
              booking_id: booking.id,
            })
            .catch((err) => console.error("Credit transaction insert error:", err.message));
        }

        // Notify student
        await supabase
          .from("notifications")
          .insert({
            user_id: booking.student_id,
            type: "booking",
            title: "ჯავშანი ვადაგასულია",
            body: "ჯავშანი ვადაგასულია - კრედიტი დაბრუნდა",
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
              title: "ჯავშანი გაუქმდა",
              body: "ჯავშანი ავტომატურად გაუქმდა (დაუდასტურებელი)",
              link: "/dashboard/tutor/bookings",
              is_read: false,
            })
            .catch((err) => console.error("Tutor notification error:", err.message));
        }

        processed++;
      } catch (err) {
        console.error(`Error expiring booking ${booking.id}:`, err.message);
      }
    }

    return NextResponse.json({ processed });
  } catch (err) {
    console.error("expire-pending cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
