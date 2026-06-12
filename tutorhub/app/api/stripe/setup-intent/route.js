import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase";
import { cookies } from "next/headers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, full_name, email")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      name:     profile?.full_name || "",
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
  });

  return NextResponse.json({ client_secret: setupIntent.client_secret });
}

// GET — list saved payment methods
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ methods: [] });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) return NextResponse.json({ methods: [] });

  const methods = await stripe.paymentMethods.list({
    customer: profile.stripe_customer_id,
    type: "card",
  });

  const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
  const defaultPm = customer.invoice_settings?.default_payment_method;

  return NextResponse.json({
    methods: methods.data.map(pm => ({
      id:      pm.id,
      brand:   pm.card.brand,
      last4:   pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear:  pm.card.exp_year,
      isDefault: pm.id === defaultPm,
    })),
  });
}

// DELETE — remove a payment method
export async function DELETE(req) {
  const { pm_id } = await req.json();
  if (!pm_id) return NextResponse.json({ error: "pm_id required" }, { status: 400 });
  await stripe.paymentMethods.detach(pm_id);
  return NextResponse.json({ success: true });
}
