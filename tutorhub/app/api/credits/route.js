import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// ─── GET: return credit balance + last 10 transactions ───────────────────────
export async function GET(request) {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    }

    // Get credit balance
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credit_balance")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Get last 10 credit transactions
    const { data: transactions, error: txError } = await supabase
      .from("credit_transactions")
      .select("id, amount, reason, booking_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    return NextResponse.json({
      credit_balance: profile?.credit_balance ?? 0,
      transactions: transactions ?? [],
    });
  } catch (err) {
    console.error("GET /api/credits error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST: internal use — add/deduct credits ─────────────────────────────────
// Body: { userId, amount, reason, bookingId, internalSecret }
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, amount, reason, bookingId, internalSecret } = body;

    // Internal secret check
    if (!internalSecret || internalSecret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!userId || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "userId და amount საჭიროა" },
        { status: 400 }
      );
    }

    // Use server client (bypasses RLS for internal ops with service role)
    const supabase = await createSupabaseServer();

    // Get current balance
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credit_balance")
      .eq("id", userId)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const currentBalance = profile?.credit_balance ?? 0;
    const newBalance = currentBalance + amount;

    if (newBalance < 0) {
      return NextResponse.json(
        { error: "არასაკმარისი კრედიტი" },
        { status: 400 }
      );
    }

    // Update credit balance
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credit_balance: newBalance })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Insert credit transaction
    const { data: tx, error: txError } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: userId,
        amount,
        reason: reason ?? (amount > 0 ? "credit_added" : "credit_deducted"),
        booking_id: bookingId ?? null,
      })
      .select()
      .single();

    if (txError) {
      console.error("Credit transaction insert error:", txError.message);
    }

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
      transaction: tx ?? null,
    });
  } catch (err) {
    console.error("POST /api/credits error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
