import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServer } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    }

    const { bookingId, tutorId, tutorName, subject, date, time, totalPrice } =
      await request.json();

    if (!totalPrice || !tutorName || !bookingId) {
      return NextResponse.json({ error: "საჭირო ველები არ არის" }, { status: 400 });
    }

    const origin =
      request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

    // ─── Credit balance check ─────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credit_balance")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError.message);
    }

    const creditBalance = profile?.credit_balance ?? 0;

    // Case 1: Full coverage with credits
    if (creditBalance >= totalPrice) {
      const newBalance = creditBalance - totalPrice;

      const { error: deductErr } = await supabase
        .from("profiles")
        .update({ credit_balance: newBalance })
        .eq("id", user.id);

      if (deductErr) {
        return NextResponse.json({ error: deductErr.message }, { status: 500 });
      }

      // Record the credit transaction
      await supabase
        .from("credit_transactions")
        .insert({
          user_id: user.id,
          amount: -totalPrice,
          reason: "booking_payment",
          booking_id: bookingId,
        })
        .catch((err) => console.error("Credit transaction error:", err.message));

      // Confirm booking immediately
      const { error: bookingErr } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingId);

      if (bookingErr) {
        // Rollback credit deduction on failure
        await supabase
          .from("profiles")
          .update({ credit_balance: creditBalance })
          .eq("id", user.id);
        return NextResponse.json({ error: bookingErr.message }, { status: 500 });
      }

      // Notify student
      await supabase
        .from("notifications")
        .insert({
          user_id: user.id,
          type: "payment",
          title: "ჯავშანი დადასტურდა ✓",
          body: `${totalPrice} ₾ ჩამოიჭრა კრედიტ-ბალანსიდან — ახ. ბალანსი: ${newBalance.toFixed(2)} ₾`,
          link: "/dashboard/student/lessons",
          is_read: false,
        })
        .catch(() => {});

      // Notify tutor
      const { data: bk } = await supabase
        .from("bookings")
        .select("date, time_slot")
        .eq("id", bookingId)
        .single();
      const dateStr = bk ? `${bk.date} ${bk.time_slot}` : "";
      await supabase
        .from("notifications")
        .insert({
          user_id: tutorId,
          type: "booking",
          title: "ახალი ჯავშანი! 📅",
          body: `${dateStr}-ზე ახალი სტუდენტი დაგიჯავშნა გაკვეთილი.`,
          link: "/dashboard/tutor/bookings",
          is_read: false,
        })
        .catch(() => {});

      return NextResponse.json({ paid_with_credits: true, booking_id: bookingId });
    }

    // Case 2: Partial credit coverage
    if (creditBalance > 0 && creditBalance < totalPrice) {
      const remainder = totalPrice - creditBalance;

      // Deduct all available credits
      const { error: deductErr } = await supabase
        .from("profiles")
        .update({ credit_balance: 0 })
        .eq("id", user.id);

      if (deductErr) {
        return NextResponse.json({ error: deductErr.message }, { status: 500 });
      }

      // Record credit transaction
      await supabase
        .from("credit_transactions")
        .insert({
          user_id: user.id,
          amount: -creditBalance,
          reason: "partial_booking_payment",
          booking_id: bookingId,
        })
        .catch((err) => console.error("Credit transaction error:", err.message));

      // Create Stripe session for the remainder
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "gel",
              product_data: {
                name: `გაკვეთილი — ${tutorName}`,
                description: `${subject ?? "გაკვეთილი"} · ${date} · ${time} (კრედიტი გამოყენებულია: ${creditBalance} ₾)`,
              },
              unit_amount: Math.round(remainder * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/dashboard?payment=success&bookingId=${bookingId}`,
        cancel_url: `${origin}/booking/${tutorId}?payment=cancelled`,
        metadata: {
          bookingId: bookingId ?? "",
          tutorId,
          studentId: user.id,
          bookingDate: date,
          creditsUsed: String(creditBalance),
        },
      }).catch(async (stripeErr) => {
        // Rollback credits on Stripe failure
        await supabase
          .from("profiles")
          .update({ credit_balance: creditBalance })
          .eq("id", user.id);
        throw stripeErr;
      });

      return NextResponse.json({ url: session.url, credits_used: creditBalance });
    }

    // Case 3: No credits — normal Stripe flow
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gel",
            product_data: {
              name: `გაკვეთილი — ${tutorName}`,
              description: `${subject ?? "გაკვეთილი"} · ${date} · ${time}`,
            },
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/dashboard?payment=success&bookingId=${bookingId}`,
      cancel_url: `${origin}/booking/${tutorId}?payment=cancelled`,
      metadata: {
        bookingId: bookingId ?? "",
        tutorId,
        studentId: user.id,
        bookingDate: date,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
