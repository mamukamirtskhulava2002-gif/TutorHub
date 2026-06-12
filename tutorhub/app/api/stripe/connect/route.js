import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase";
import { cookies } from "next/headers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST — creates or retrieves Stripe Connect Express account + returns onboarding URL
export async function POST(req) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tutor } = await supabase
    .from("tutors")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "tutor") return NextResponse.json({ error: "Not a tutor" }, { status: 403 });

  let accountId = tutor?.stripe_account_id;

  // Create Express account if not exists
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "GE",
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
      individual: { first_name: profile?.full_name?.split(" ")[0] || "" },
      metadata: { tutor_id: user.id },
    });
    accountId = account.id;
    await supabase.from("tutors").update({ stripe_account_id: accountId }).eq("id", user.id);
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/tutor/settings?stripe=refresh`,
    return_url:  `${origin}/dashboard/tutor/settings?stripe=connected`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}

// GET — returns connection status for current tutor
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false });

  const { data: tutor } = await supabase
    .from("tutors")
    .select("stripe_account_id, stripe_payouts_enabled")
    .eq("id", user.id)
    .single();

  if (!tutor?.stripe_account_id) return NextResponse.json({ connected: false });

  // check live status from Stripe
  try {
    const account = await stripe.accounts.retrieve(tutor.stripe_account_id);
    const payoutsEnabled = account.payouts_enabled;

    if (payoutsEnabled !== tutor.stripe_payouts_enabled) {
      await supabase.from("tutors")
        .update({ stripe_payouts_enabled: payoutsEnabled })
        .eq("id", user.id);
    }

    return NextResponse.json({
      connected:       true,
      payoutsEnabled,
      accountId:       tutor.stripe_account_id,
      detailsSubmitted: account.details_submitted,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
