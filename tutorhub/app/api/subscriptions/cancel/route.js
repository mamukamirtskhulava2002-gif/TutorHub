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

    const { subscriptionId } = await request.json();

    // Verify subscription belongs to this user
    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id, student_id, status")
      .eq("id", subscriptionId)
      .single();

    if (subErr || !sub) {
      return NextResponse.json({ error: "გამოწერა ვერ მოიძებნა" }, { status: 404 });
    }

    if (sub.student_id !== user.id) {
      return NextResponse.json({ error: "წვდომა შეზღუდულია" }, { status: 403 });
    }

    if (sub.status === "cancelled") {
      return NextResponse.json({ error: "გამოწერა უკვე გაუქმებულია" }, { status: 400 });
    }

    if (sub.stripe_subscription_id) {
      // Cancel at end of current period (not immediately)
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    // Mark in DB
    await supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("id", subscriptionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Subscription cancel error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
