import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "stripe-signature header აკლია" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const supabase = createClient();

  try {
    switch (event.type) {

      // ─────────────────────────────────────────────────────────────
      // Checkout completed — handles both one-time and subscription
      // ─────────────────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;

        // ── Subscription mode ──────────────────────────────────────
        if (session.mode === "subscription") {
          const meta    = session.metadata ?? {};
          const subMeta = session.subscription
            ? (await stripe.subscriptions.retrieve(session.subscription)).metadata
            : {};
          const m = { ...meta, ...subMeta };

          const studentId     = m.studentId;
          const tutorId       = m.tutorId;
          const packageMonths = parseInt(m.packageMonths   || "1", 10);
          const lessons       = parseInt(m.lessonsPerMonth || "4", 10);
          const pricePerMonth = parseFloat(m.pricePerMonth || "0");
          const firstDate     = m.firstBookingDate   || null;
          const firstTime     = m.firstBookingTime   || null;
          const firstDur      = parseFloat(m.firstBookingDuration || "1");
          const firstFmt      = m.firstBookingFormat || "online";
          const note          = m.note               || null;

          let periodEnd = null;
          const stripeSubId = session.subscription;
          if (stripeSubId) {
            const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
            periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
          }

          const { data: newSub } = await supabase.from("subscriptions").insert({
            student_id:             studentId,
            tutor_id:               tutorId,
            status:                 "active",
            package_months:         packageMonths,
            lessons_per_month:      lessons,
            price_per_month:        pricePerMonth,
            stripe_subscription_id: stripeSubId,
            stripe_customer_id:     session.customer,
            current_period_end:     periodEnd,
            credits_remaining:      lessons,
            total_credits_given:    lessons,
          }).select().single();

          // Create first booking auto-confirmed
          if (firstDate && firstTime && newSub) {
            await supabase.from("bookings").insert({
              student_id:      studentId,
              tutor_id:        tutorId,
              date:            firstDate,
              time_slot:       firstTime,
              duration_hours:  firstDur,
              format:          firstFmt,
              total_price:     Math.round((pricePerMonth / lessons) * 100) / 100,
              note:            note,
              status:          "confirmed",
              subscription_id: newSub.id,
            });
          }

          // Notify student
          if (studentId) {
            const { data: tp } = await supabase.from("profiles").select("full_name").eq("id", tutorId).single();
            await supabase.from("notifications").insert({
              user_id: studentId, type: "payment",
              title:   "გამოწერა გააქტიურდა ✅",
              body:    `${tp?.full_name || "მასწ."} — ${lessons} გაკვ./თვ. · ავტო-განახლება 30 დღეში`,
              is_read: false, link: "/dashboard/student/subscriptions",
            });
          }
          // Notify tutor
          if (tutorId) {
            await supabase.from("notifications").insert({
              user_id: tutorId, type: "payment",
              title:   "ახალი გამოწერა! 🎉",
              body:    `${packageMonths} თვე · ${lessons} გაკვ./თვ. · ${pricePerMonth} ₾/თვ.`,
              is_read: false, link: "/dashboard/tutor/bookings",
            });
          }
          break;
        }

        // ── One-time payment mode ──────────────────────────────────
        const { bookingId, tutorId, studentId } = session.metadata ?? {};
        if (!bookingId) { console.warn("bookingId metadata-ში არ არის"); break; }

        await supabase.from("bookings").update({
          status:                "confirmed",
          stripe_session_id:     session.id,
          stripe_payment_intent: session.payment_intent,
        }).eq("id", bookingId);

        const { data: bk } = await supabase
          .from("bookings").select("date, time_slot").eq("id", bookingId).single();
        const dateStr = bk ? `${bk.date} ${bk.time_slot}` : "";

        if (studentId) {
          await supabase.from("notifications").insert({
            user_id: studentId, type: "booking",
            title: "ჯავშანი დადასტურდა ✓",
            body:  `გაკვეთილი ${dateStr}-ზე წარმატებით დაჯავშნა!`, is_read: false,
          });
        }
        if (tutorId) {
          await supabase.from("notifications").insert({
            user_id: tutorId, type: "booking",
            title: "ახალი ჯავშანი! 📅",
            body:  `${dateStr}-ზე ახალი სტუდენტი დაგიჯავშნა გაკვეთილი.`, is_read: false,
          });
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // One-time checkout expired / payment failed → cancel booking
      // ─────────────────────────────────────────────────────────────
      case "checkout.session.expired":
      case "payment_intent.payment_failed": {
        const obj = event.data.object;
        const bookingId =
          obj.metadata?.bookingId ??
          (obj.charges?.data?.[0]?.metadata?.bookingId ?? null);
        if (!bookingId) break;

        await supabase.from("bookings")
          .update({ status: "cancelled" })
          .eq("id", bookingId).eq("status", "pending");

        const sid = obj.metadata?.studentId;
        if (sid) {
          await supabase.from("notifications").insert({
            user_id: sid, type: "payment",
            title: "გადახდა ვერ მოხერხდა",
            body:  "ჯავშანი გაუქმდა — სცადეთ თავიდან.", is_read: false,
          });
        }
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // Monthly subscription renewal succeeded → add credits
      // ─────────────────────────────────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.billing_reason !== "subscription_cycle") break;

        const stripeSubId = invoice.subscription;
        if (!stripeSubId) break;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_subscription_id", stripeSubId)
          .single();
        if (!sub) break;

        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        const newPeriodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();

        await supabase.from("subscriptions").update({
          credits_remaining:   (sub.credits_remaining || 0) + sub.lessons_per_month,
          total_credits_given: (sub.total_credits_given || 0) + sub.lessons_per_month,
          current_period_end:  newPeriodEnd,
          status:              "active",
          payment_failed_at:   null,
          suspended_at:        null,
        }).eq("id", sub.id);

        await supabase.from("notifications").insert({
          user_id: sub.student_id, type: "payment",
          title:   "გამოწერა განახლდა ✅",
          body:    `${sub.lessons_per_month} ახალი კრედიტი დაემატა · ${sub.price_per_month} ₾ ჩამოიჭრა`,
          is_read: false, link: "/dashboard/student/subscriptions",
        });
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // Monthly payment failed → 48h warning
      // ─────────────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        if (!stripeSubId) break;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_subscription_id", stripeSubId)
          .single();
        if (!sub) break;

        await supabase.from("subscriptions").update({
          status:            "past_due",
          payment_failed_at: new Date().toISOString(),
        }).eq("id", sub.id);

        await supabase.from("notifications").insert({
          user_id: sub.student_id, type: "payment",
          title:   "⚠️ გადახდა ვერ მოხდა",
          body:    `${sub.price_per_month} ₾ ჩამოჭრა ვერ მოხდა. შეავსეთ ბარათი 48 სთ-ში — წინააღმდეგ შემთხვევაში სესიები გაიყინება.`,
          is_read: false, link: "/dashboard/student/subscriptions",
        });
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // Subscription cancelled / expired
      // ─────────────────────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object;
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_subscription_id", stripeSub.id)
          .single();
        if (!sub) break;

        await supabase.from("subscriptions").update({
          status:            "cancelled",
          credits_remaining: 0,
        }).eq("id", sub.id);

        // Cancel future pending bookings from this subscription
        await supabase.from("bookings")
          .update({ status: "cancelled" })
          .eq("subscription_id", sub.id)
          .eq("status", "pending")
          .gte("date", new Date().toISOString().slice(0, 10));

        await supabase.from("notifications").insert({
          user_id: sub.student_id, type: "payment",
          title:   "გამოწერა დასრულდა",
          body:    `${sub.lessons_per_month} გაკვ./თვ. პაკეტი გაუქმდა. მომავალი ჯავშნები გაუქმდა.`,
          is_read: false, link: "/dashboard/student/subscriptions",
        });
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // Refund processed
      // ─────────────────────────────────────────────────────────────
      case "charge.refunded": {
        const charge = event.data.object;
        const bookingId = charge.metadata?.bookingId;
        if (!bookingId) break;

        await supabase.from("bookings")
          .update({ status: "cancelled" }).eq("id", bookingId);

        const sid = charge.metadata?.studentId;
        if (sid) {
          await supabase.from("notifications").insert({
            user_id: sid, type: "payment",
            title:   "თანხა დაბრუნდა",
            body:    `გადახდილი თანხა დაბრუნდება 5–10 სამუშაო დღეში.`, is_read: false,
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
