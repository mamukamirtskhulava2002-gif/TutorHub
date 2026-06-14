import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const now   = new Date().toISOString();

    // Pending bookings whose expires_at has passed
    const { data: bookings, error } = await admin
      .from("bookings")
      .select("id, student_id, tutor_id, total_price, date, time_slot")
      .eq("status", "pending")
      .lt("expires_at", now);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!bookings?.length) return NextResponse.json({ processed: 0 });

    let processed = 0;

    for (const booking of bookings) {
      try {
        const { error: updateErr } = await admin
          .from("bookings")
          .update({ status: "cancelled", cancellation_reason: "auto_expired" })
          .eq("id", booking.id)
          .eq("status", "pending");

        if (updateErr) { console.error(`expire booking ${booking.id}:`, updateErr.message); continue; }

        // Refund student wallet
        const price = Number(booking.total_price || 0);
        if (price > 0) {
          await admin.rpc("increment_wallet", { p_user_id: booking.student_id, p_amount: price });
        }

        // Notify student
        try {
          await admin.from("notifications").insert({
            user_id: booking.student_id,
            type:    "booking",
            title:   "ჯავშანი გაუქმდა ⏰",
            body:    `მასწავლებელმა ვადაში ვერ დაადასტურა${price > 0 ? ` — ${price}₾ საფულეში დაბრუნდა` : ""}.`,
            link:    "/dashboard/student/lessons",
            is_read: false,
          });
        } catch {}

        // Notify tutor
        try {
          await admin.from("notifications").insert({
            user_id: booking.tutor_id,
            type:    "booking",
            title:   "ჯავშანი ვადაგასულია ⏰",
            body:    `${booking.date} ${(booking.time_slot || "").slice(0, 5)}-ის ჯავშანი ვადაში დაუდასტურებელი დარჩა და გაუქმდა.`,
            link:    "/dashboard/tutor/bookings",
            is_read: false,
          });
        } catch {}

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
