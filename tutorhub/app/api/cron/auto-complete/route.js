import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── Helper: transfer payment to tutor ───────────────────────────────────────
async function processPaymentToTutor(supabase, bookingId) {
  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, tutor_id, student_id, total_price, stripe_payment_intent")
      .eq("id", bookingId)
      .single();

    if (!booking) return;

    const { data: tutorProfile } = await supabase
      .from("tutors")
      .select("stripe_account_id")
      .eq("id", booking.tutor_id)
      .single();

    await supabase
      .from("bookings")
      .update({ payment_status: "paid" })
      .eq("id", bookingId);

    if (tutorProfile?.stripe_account_id && booking.stripe_payment_intent) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          booking.stripe_payment_intent
        );
        const chargeId = paymentIntent.latest_charge;
        if (chargeId) {
          await stripe.transfers.create({
            amount: Math.round(booking.total_price * 100),
            currency: "gel",
            destination: tutorProfile.stripe_account_id,
            source_transaction: chargeId,
            metadata: { bookingId },
          });
        }
      } catch (stripeErr) {
        console.error("Stripe transfer error:", stripeErr.message);
      }
    }

    await supabase
      .from("notifications")
      .insert({
        user_id: booking.tutor_id,
        type: "payment",
        title: "გადახდა მიღებულია 💰",
        body: `${booking.total_price} ₾ ჩაირიცხა — ჯავშანი #${bookingId.slice(0, 8)}`,
        link: "/dashboard/tutor/income",
        is_read: false,
      })
      .catch((err) => console.error("Tutor notification error:", err.message));
  } catch (err) {
    console.error("processPaymentToTutor error:", err.message);
  }
}

// ─── Cron handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  // Validate cron secret
  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient();
    const now = new Date().toISOString();

    // Find all bookings where tutor marked complete but student hasn't confirmed
    // and the 24h token window has passed
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, student_id, tutor_id")
      .eq("status", "completed_by_tutor")
      .lt("completion_token_expires_at", now)
      .is("student_confirmed_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    const autoCompletedAt = now;
    let processed = 0;

    for (const booking of bookings) {
      try {
        // Update status to done
        const { error: updateErr } = await supabase
          .from("bookings")
          .update({
            status: "done",
            auto_completed_at: autoCompletedAt,
            student_confirmed_at: autoCompletedAt,
          })
          .eq("id", booking.id);

        if (updateErr) {
          console.error(`Failed to auto-complete booking ${booking.id}:`, updateErr.message);
          continue;
        }

        // Process payment to tutor
        await processPaymentToTutor(supabase, booking.id);

        // Notify student
        await supabase
          .from("notifications")
          .insert({
            user_id: booking.student_id,
            type: "booking",
            title: "გაკვეთილი ავტომატურად დადასტურდა",
            body: "გაკვეთილი ავტომატურად დადასტურდა (24 სთ გასვლა)",
            link: "/dashboard/student/lessons",
            is_read: false,
          })
          .catch((err) => console.error("Student notification error:", err.message));

        processed++;
      } catch (err) {
        console.error(`Error processing booking ${booking.id}:`, err.message);
      }
    }

    return NextResponse.json({ processed });
  } catch (err) {
    console.error("auto-complete cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
