import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function payTutor(admin, bookingId) {
  try {
    const { data: booking } = await admin
      .from("bookings")
      .select("id, tutor_id, student_id, total_price, stripe_payment_intent")
      .eq("id", bookingId)
      .single();

    if (!booking) return;

    await admin.from("bookings").update({ payment_status: "paid" }).eq("id", bookingId);

    const { data: tutorRow } = await admin
      .from("tutors")
      .select("stripe_account_id")
      .eq("id", booking.tutor_id)
      .single();

    if (tutorRow?.stripe_account_id && booking.stripe_payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent);
        if (pi.latest_charge) {
          await stripe.transfers.create({
            amount:             Math.round(booking.total_price * 100),
            currency:           "gel",
            destination:        tutorRow.stripe_account_id,
            source_transaction: pi.latest_charge,
            metadata:           { bookingId },
          });
        }
      } catch (err) {
        console.error("Stripe transfer error:", err.message);
      }
    }

    try {
      await admin.from("notifications").insert({
        user_id: booking.tutor_id,
        type:    "payment",
        title:   "💰 გადახდა ჩაირიცხა",
        body:    `${booking.total_price}₾ — გაკვეთილი ავტომატურად დადასტურდა (48 სთ).`,
        link:    "/dashboard/tutor/income",
        is_read: false,
      });
    } catch {}
  } catch (err) {
    console.error("payTutor error:", err.message);
  }
}

export async function POST(request) {
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const now = new Date();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Confirmed bookings whose lesson started 48h+ ago (tutor never pressed "complete")
    const { data: bookings, error } = await admin
      .from("bookings")
      .select("id, student_id, tutor_id, total_price, date, time_slot, duration_hours")
      .eq("status", "confirmed");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!bookings?.length) return NextResponse.json({ processed: 0 });

    const timedOut = bookings.filter(b => {
      if (!b.date || !b.time_slot) return false;
      const lessonStart = new Date(`${b.date}T${b.time_slot}`);
      const lessonEnd   = new Date(lessonStart.getTime() + (b.duration_hours || 1) * 3600000);
      return lessonEnd < cutoff;
    });

    if (!timedOut.length) return NextResponse.json({ processed: 0 });

    // Filter out bookings that have an open dispute — admin handles those
    const timedOutIds = timedOut.map(b => b.id);
    const { data: openDisputes } = await admin
      .from("disputes")
      .select("booking_id")
      .in("booking_id", timedOutIds)
      .eq("status", "open");

    const disputedIds = new Set((openDisputes || []).map(d => d.booking_id));

    let processed = 0;

    for (const booking of timedOut) {
      if (disputedIds.has(booking.id)) continue; // admin resolves disputed ones

      try {
        const { error: updateErr } = await admin
          .from("bookings")
          .update({
            status:               "done",
            auto_completed_at:    now.toISOString(),
            student_confirmed_at: now.toISOString(),
          })
          .eq("id", booking.id)
          .eq("status", "confirmed");

        if (updateErr) { console.error(`auto-complete error ${booking.id}:`, updateErr.message); continue; }

        await payTutor(admin, booking.id);

        try {
          await admin.from("notifications").insert({
            user_id: booking.student_id,
            type:    "booking",
            title:   "გაკვეთილი ჩათვლილია ჩატარებულად ✅",
            body:    "გაკვეთილი ავტომატურად დადასტურდა — მასწავლებელმა 48 სთ-ში ვერ მოახდინა დადასტურება, თანხა გადაიცა.",
            link:    "/dashboard/student/lessons",
            is_read: false,
          });
        } catch {}

        processed++;
      } catch (err) {
        console.error(`tutor-timeout booking ${booking.id}:`, err.message);
      }
    }

    return NextResponse.json({ processed });
  } catch (err) {
    console.error("tutor-timeout cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
