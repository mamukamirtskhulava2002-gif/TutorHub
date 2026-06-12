import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServer } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    }

    const {
      tutorId,
      tutorName,
      subject,
      packageMonths,
      lessonsPerMonth,
      pricePerMonth,
      discount,
      firstBookingDate,
      firstBookingTime,
      firstBookingDuration,
      firstBookingFormat,
      note,
      studentId,
    } = await request.json();

    if (!tutorId || !pricePerMonth || !packageMonths) {
      return NextResponse.json({ error: "საჭირო ველები არ არის" }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

    // Find or create Stripe customer for this student
    let stripeCustomerId = null;
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("student_id", studentId || user.id)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .single();

    if (existingSub?.stripe_customer_id) {
      stripeCustomerId = existingSub.stripe_customer_id;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", studentId || user.id)
        .single();

      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name || user.email,
        metadata: { supabase_user_id: studentId || user.id },
      });
      stripeCustomerId = customer.id;
    }

    // Create a recurring Stripe price on-the-fly
    const price = await stripe.prices.create({
      unit_amount: Math.round(pricePerMonth * 100),
      currency: "gel",
      recurring: { interval: "month" },
      product_data: {
        name: `TutorHub — ${tutorName} (${lessonsPerMonth} გაკვ./თვ.)`,
      },
    });

    // Subscription end: cancel_at = N months from now
    const cancelAt = packageMonths > 0
      ? Math.floor(Date.now() / 1000) + packageMonths * 30 * 24 * 3600
      : undefined;

    const discountLabel = discount > 0 ? `-${Math.round(discount * 100)}%` : "";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [{ price: price.id, quantity: 1 }],
      mode: "subscription",
      subscription_data: {
        ...(cancelAt ? { cancel_at: cancelAt } : {}),
        metadata: {
          studentId: studentId || user.id,
          tutorId,
          packageMonths: String(packageMonths),
          lessonsPerMonth: String(lessonsPerMonth),
          pricePerMonth: String(pricePerMonth),
          discount: String(discount),
          firstBookingDate: firstBookingDate || "",
          firstBookingTime: firstBookingTime || "",
          firstBookingDuration: String(firstBookingDuration || 1),
          firstBookingFormat: firstBookingFormat || "online",
          note: note || "",
        },
      },
      metadata: {
        type: "subscription",
        studentId: studentId || user.id,
        tutorId,
        packageMonths: String(packageMonths),
        lessonsPerMonth: String(lessonsPerMonth),
      },
      success_url: `${origin}/dashboard/student/subscriptions?payment=success`,
      cancel_url: `${origin}/booking/${tutorId}?payment=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Subscription create error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
