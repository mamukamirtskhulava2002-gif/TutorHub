import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServer } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;

  // Stripe signature შემოწმება
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  try {
    switch (event.type) {

      // ✅ გადახდა წარმატებული
      case "checkout.session.completed": {
        const session = event.data.object;
        const { bookingId, studentId, tutorId } = session.metadata ?? {};

        if (bookingId) {
          // booking სტატუსი → confirmed
          await supabase
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("id", bookingId);

          // გადახდის ჩანაწერი
          await supabase
            .from("payments")
            .upsert({
              booking_id: bookingId,
              student_id: studentId,
              tutor_id: tutorId,
              amount: session.amount_total / 100, // თეთრი → ლარი
              currency: session.currency,
              status: "paid",
              stripe_session_id: session.id,
              stripe_payment_intent: session.payment_intent,
            }, { onConflict: "stripe_session_id" });
        }
        break;
      }

      // ❌ გადახდა ვადაგასული (მომხმარებელმა დახურა)
      case "checkout.session.expired": {
        const session = event.data.object;
        const { bookingId } = session.metadata;

        if (bookingId) {
          // booking → cancelled
          await supabase
            .from("bookings")
            .update({ status: "cancelled" })
            .eq("id", bookingId);

          // გადახდა → expired
          await supabase
            .from("payments")
            .upsert({
              booking_id: bookingId,
              stripe_session_id: session.id,
              status: "expired",
            }, { onConflict: "stripe_session_id" });
        }
        break;
      }

      // ❌ გადახდა ვერ მოხდა
      case "payment_intent.payment_failed": {
        const intent = event.data.object;

        // stripe_payment_intent-ით ვპოულობთ booking-ს
        const { data: payment } = await supabase
          .from("payments")
          .select("booking_id")
          .eq("stripe_payment_intent", intent.id)
          .single();

        if (payment?.booking_id) {
          await supabase
            .from("bookings")
            .update({ status: "cancelled" })
            .eq("id", payment.booking_id);

          await supabase
            .from("payments")
            .update({ status: "failed" })
            .eq("stripe_payment_intent", intent.id);
        }
        break;
      }

      // 💸 თანხის დაბრუნება
      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;

        const { data: payment } = await supabase
          .from("payments")
          .select("booking_id")
          .eq("stripe_payment_intent", paymentIntentId)
          .single();

        if (payment?.booking_id) {
          await supabase
            .from("bookings")
            .update({ status: "cancelled" })
            .eq("id", payment.booking_id);

          await supabase
            .from("payments")
            .update({ status: "refunded" })
            .eq("stripe_payment_intent", paymentIntentId);
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}