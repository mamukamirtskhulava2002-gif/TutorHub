import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const PENALTY_PCT   = 0.20;
const FREE_CANCEL_H = 24;

export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    const userId = session.user.id;

    const admin = createAdminClient();

    // Must be a tutor
    const { data: profile } = await admin
      .from("profiles")
      .select("role, wallet_balance, full_name")
      .eq("id", userId)
      .single();

    if (!profile || profile.role !== "tutor") {
      return NextResponse.json({ error: "წვდომა აკრძალულია" }, { status: 403 });
    }

    // ── 1. Check for active bookings ──────────────────────────────────────────
    const { data: activeBookings } = await admin
      .from("bookings")
      .select("id, status, date, time_slot, total_price")
      .eq("tutor_id", userId)
      .in("status", ["pending", "confirmed"]);

    if (activeBookings?.length > 0) {
      const now = Date.now();
      const pending   = activeBookings.filter(b => b.status === "pending");
      const confirmed = activeBookings.filter(b => b.status === "confirmed");

      // Calculate potential penalty for late confirmed cancellations
      let totalPenalty = 0;
      const lateConfirmed = confirmed.filter(b => {
        const t = new Date(`${b.date}T${b.time_slot || "00:00"}:00`);
        return (t - now) / 3600000 < FREE_CANCEL_H;
      });

      lateConfirmed.forEach(b => {
        totalPenalty += Math.round(Number(b.total_price || 0) * PENALTY_PCT * 100) / 100;
      });

      const walletBalance = Number(profile.wallet_balance || 0);
      const shortfall     = totalPenalty > 0 ? Math.max(0, totalPenalty - walletBalance) : 0;

      return NextResponse.json({
        blocked:       true,
        pendingCount:  pending.length,
        confirmedCount: confirmed.length,
        lateCount:     lateConfirmed.length,
        totalPenalty,
        walletBalance,
        shortfall,
      }, { status: 400 });
    }

    // ── 2. Check wallet balance is not negative ───────────────────────────────
    const walletBalance = Number(profile.wallet_balance || 0);
    if (walletBalance < 0) {
      return NextResponse.json({
        blocked:      true,
        negativeWallet: true,
        walletBalance,
        shortfall: Math.abs(walletBalance),
      }, { status: 400 });
    }

    // ── 3. All clear — delete account ─────────────────────────────────────────
    // Notify admins
    try {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
      if (admins?.length) {
        await admin.from("notifications").insert(admins.map(a => ({
          user_id: a.id, type: "system",
          title:   "👤 მასწავლებელი წაშლილია",
          body:    `${profile.full_name || "მასწავლებელი"} (${userId.slice(0, 8)}) წაშალა ანგარიში.`,
          is_read: false,
        })));
      }
    } catch {}

    // Delete tutor and profile rows (bookings kept for records)
    await admin.from("tutors").delete().eq("id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    // Delete auth user
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("auth deleteUser error:", authErr.message);
      return NextResponse.json({ error: "ანგარიშის წაშლა ვერ მოხერხდა" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("delete-account error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
