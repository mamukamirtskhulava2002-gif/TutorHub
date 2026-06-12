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

// ─── GET: return booking info for the token (public) ─────────────────────────
export async function GET(request, { params }) {
  try {
    const supabase = createClient();
    const { token } = await params;

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        `id, status, date, time_slot, total_price, completion_token_expires_at, tutor_id,
         profiles!bookings_tutor_id_fkey(full_name),
         tutors!bookings_tutor_id_fkey(subject)`
      )
      .eq("completion_token", token)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: "ტოკენი ვერ მოიძებნა" }, { status: 404 });
    }

    const subject = booking.tutors?.subject;
    const subjectLabel = Array.isArray(subject) ? subject[0] : (subject ?? "გაკვეთილი");

    return NextResponse.json({
      id: booking.id,
      status: booking.status,
      date: booking.date,
      time_slot: booking.time_slot,
      total_price: booking.total_price,
      expires_at: booking.completion_token_expires_at,
      tutor_name: booking.profiles?.full_name ?? "მასწავლებელი",
      subject: subjectLabel,
    });
  } catch (err) {
    console.error("GET /api/confirm/[token] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST: confirm lesson via token (no auth required) ───────────────────────
export async function POST(request, { params }) {
  try {
    const supabase = createClient();
    const { token } = await params;

    const now = new Date().toISOString();

    // Find booking with valid (non-expired) token
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, student_id, tutor_id, status, completion_token_expires_at")
      .eq("completion_token", token)
      .gt("completion_token_expires_at", now)
      .single();

    if (error || !booking) {
      return NextResponse.json(
        { error: "ტოკენი ვადაგასულია" },
        { status: 410 }
      );
    }

    if (booking.status === "done") {
      return NextResponse.json({ success: true, already_confirmed: true });
    }

    // Update booking to done and clear token
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "done",
        student_confirmed_at: now,
        completion_token: null,
      })
      .eq("id", booking.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Notify tutor
    await supabase
      .from("notifications")
      .insert({
        user_id: booking.tutor_id,
        type: "booking",
        title: "გაკვეთილი დადასტურდა ✅",
        body: "სტუდენტმა SMS-ით გაკვეთილი დაადასტურა — გადახდა დამუშავდება",
        link: "/dashboard/tutor/income",
        is_read: false,
      })
      .catch((err) => console.error("Notification error:", err.message));

    // Process payment (fire-and-forget)
    processPaymentToTutor(supabase, booking.id).catch((err) =>
      console.error("Payment error:", err.message)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/confirm/[token] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
