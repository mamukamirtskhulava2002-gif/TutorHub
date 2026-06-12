import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServer } from "@/lib/supabase-server";

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

    if (!booking) {
      console.error(`processPaymentToTutor: booking ${bookingId} not found`);
      return;
    }

    const { data: tutorProfile } = await supabase
      .from("tutors")
      .select("stripe_account_id")
      .eq("id", booking.tutor_id)
      .single();

    // Mark payment as paid
    await supabase
      .from("bookings")
      .update({ payment_status: "paid" })
      .eq("id", bookingId);

    // Transfer to tutor via Stripe Connect if account exists
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

    // Notify tutor
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
      .catch((err) => console.error("Tutor payment notification error:", err.message));
  } catch (err) {
    console.error("processPaymentToTutor error:", err.message);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(request, { params }) {
  try {
    const supabase = await createSupabaseServer();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    }

    const { id: bookingId } = await params;

    // Fetch booking
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, student_id, tutor_id, status")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "ჯავშანი ვერ მოიძებნა" }, { status: 404 });
    }

    // Must be the student
    if (booking.student_id !== user.id) {
      return NextResponse.json({ error: "წვდომა აკრძალულია" }, { status: 403 });
    }

    // Must be in the right status
    if (booking.status !== "completed_by_tutor") {
      return NextResponse.json(
        { error: `ჯავშანი ვერ დადასტურდება (სტატუსი: ${booking.status})` },
        { status: 400 }
      );
    }

    // Update booking to done
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "done",
        student_confirmed_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

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
        body: "სტუდენტმა გაკვეთილი დაადასტურა ✅ გადახდა დამუშავდება",
        link: "/dashboard/tutor/income",
        is_read: false,
      })
      .catch((err) => console.error("Tutor notification error:", err.message));

    // Process payment (fire-and-forget)
    processPaymentToTutor(supabase, bookingId).catch((err) =>
      console.error("Payment processing error:", err.message)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("student-confirm error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
