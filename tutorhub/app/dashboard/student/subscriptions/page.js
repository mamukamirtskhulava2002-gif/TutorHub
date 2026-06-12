"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { Suspense } from "react";

// ─── Status helpers ───────────────────────────────────────────
const STATUS_LABEL = {
  active:    { label: "აქტიური",    cls: "bg-emerald-100 text-emerald-700" },
  past_due:  { label: "⚠️ ჩამოვარდ.", cls: "bg-amber-100  text-amber-700"  },
  suspended: { label: "🔒 გაყინული", cls: "bg-red-100    text-red-700"    },
  cancelled: { label: "გაუქმ.",      cls: "bg-gray-100   text-gray-500"   },
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ka-GE", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function daysUntil(iso) {
  if (!iso) return null;
  const diff = Math.ceil((new Date(iso) - new Date()) / 86400000);
  return diff;
}

// ─── Credit bar ───────────────────────────────────────────────
function CreditBar({ used, total }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{used} გამოყ.</span>
        <span>{total} სულ</span>
      </div>
    </div>
  );
}

// ─── Cancel confirmation modal ────────────────────────────────
function CancelModal({ sub, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-black text-gray-900 mb-2">გამოწერის გაუქმება</h3>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          მიმდინარე პერიოდი ({formatDate(sub.current_period_end)}) ბოლომდე გრძელდება.
          ამ დღის შემდეგ ავტო-ჩამოჭრა შეჩერდება.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
          ⏳ გაუქმება ჩადება {formatDate(sub.current_period_end)}-მდე 3 დღით ადრე.
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors">
            ← უკან
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
            {loading ? "..." : "გაუქმება"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subscription card ────────────────────────────────────────
function SubCard({ sub, onCancel }) {
  const statusInfo = STATUS_LABEL[sub.status] || STATUS_LABEL.cancelled;
  const days = daysUntil(sub.current_period_end);
  const usedCredits = (sub.total_credits_given || 0) - (sub.credits_remaining || 0);

  return (
    <div className={`bg-white rounded-2xl border p-5 shadow-sm ${
      sub.status === "past_due" ? "border-amber-300" :
      sub.status === "cancelled" ? "border-gray-200 opacity-70" :
      "border-gray-200"
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-lg">
            📚
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">
              {sub.tutor_name || "მასწავლებელი"}
            </p>
            <p className="text-xs text-gray-400">{sub.subject || "საგანი"}</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusInfo.cls}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center bg-gray-50 rounded-xl py-2">
          <p className="text-lg font-black text-gray-900">{sub.lessons_per_month}</p>
          <p className="text-xs text-gray-400">გაკვ./თვ.</p>
        </div>
        <div className="text-center bg-gray-50 rounded-xl py-2">
          <p className="text-lg font-black text-emerald-700">{sub.credits_remaining || 0}</p>
          <p className="text-xs text-gray-400">კრედიტი</p>
        </div>
        <div className="text-center bg-gray-50 rounded-xl py-2">
          <p className="text-lg font-black text-gray-900">{sub.price_per_month} ₾</p>
          <p className="text-xs text-gray-400">/ თვე</p>
        </div>
      </div>

      {/* Credits progress */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-1.5">კრედიტების გამოყენება (ამ თვეში)</p>
        <CreditBar used={usedCredits} total={sub.total_credits_given || sub.lessons_per_month} />
      </div>

      {/* Period info */}
      {sub.current_period_end && sub.status !== "cancelled" && (
        <div className={`flex items-center justify-between text-xs rounded-xl p-2.5 mb-4 ${
          days !== null && days <= 5 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-gray-50 text-gray-500"
        }`}>
          <span>
            {sub.cancel_at_period_end ? "🔚 ბოლო პერიოდი:" : "🔄 შემდეგი ჩამოჭრა:"}
          </span>
          <span className="font-semibold">
            {formatDate(sub.current_period_end)}
            {days !== null && days > 0 && ` (${days} დღეში)`}
          </span>
        </div>
      )}

      {/* Package info */}
      <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
        <span>📦 {sub.package_months} თვიანი პაკეტი</span>
        <span>დაწყება: {formatDate(sub.created_at)}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/booking/${sub.tutor_id}`}
          className="flex-1 text-center text-sm font-semibold py-2.5 rounded-xl border border-emerald-500 text-emerald-600 hover:bg-emerald-50 transition-colors"
        >
          📅 გაკვეთილი
        </Link>
        {sub.status === "active" && !sub.cancel_at_period_end && (
          <button
            onClick={() => onCancel(sub)}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            გაუქმება
          </button>
        )}
        {sub.cancel_at_period_end && (
          <div className="flex-1 text-center text-xs text-gray-400 py-2.5 rounded-xl bg-gray-50">
            გაუქმება დაგეგმილია
          </div>
        )}
      </div>

      {/* Past due warning */}
      {sub.status === "past_due" && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <p className="font-bold mb-1">⚠️ გადახდა ვერ მოხდა</p>
          <p>შეავსეთ ბარათი 48 საათში. წინააღმდეგ შემთხვევაში გამოწერა გაიყინება.</p>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">📦</span>
      </div>
      <h3 className="font-bold text-gray-700 mb-2">გამოწერა არ გაქვთ</h3>
      <p className="text-sm text-gray-400 mb-5">
        მასწავლებლის გვერდიდან დაიწყე სწავლა და ნახე პაკეტის ვარიანტები
      </p>
      <Link href="/search"
        className="inline-block bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors text-sm">
        მასწავლებლის ძებნა →
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
function SubscriptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [subs, setSubs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling]     = useState(false);
  const [toast, setToast]       = useState("");
  const [filter, setFilter]     = useState("active"); // "active" | "all"

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (myProfile?.role !== "student") { router.push("/dashboard"); return; }

      // Join with tutors + profiles to get tutor name and subject
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          tutors!tutor_id(
            subject,
            profiles!id(full_name)
          )
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const enriched = data.map(s => ({
          ...s,
          tutor_name: s.tutors?.profiles?.full_name || "მასწ.",
          subject:    Array.isArray(s.tutors?.subject) ? s.tutors.subject[0] : s.tutors?.subject || "",
        }));
        setSubs(enriched);
      }

      setLoading(false);

      // Show success toast if redirected after payment
      if (searchParams.get("payment") === "success") {
        setToast("გამოწერა წარმატებით გააქტიურდა! ✅");
        setTimeout(() => setToast(""), 4000);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: cancelTarget.id }),
      });
      const { success, error: apiErr } = await res.json();
      if (!success) throw new Error(apiErr);

      setSubs(prev => prev.map(s =>
        s.id === cancelTarget.id ? { ...s, cancel_at_period_end: true } : s
      ));
      setToast("გამოწერა გაუქმდება მომდ. პერიოდის ბოლოს");
      setTimeout(() => setToast(""), 4000);
    } catch (e) {
      setToast("შეცდომა: " + e.message);
      setTimeout(() => setToast(""), 4000);
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  }

  const displayed = filter === "active"
    ? subs.filter(s => s.status === "active" || s.status === "past_due")
    : subs;

  // Totals
  const totalMonthly = subs
    .filter(s => s.status === "active" || s.status === "past_due")
    .reduce((sum, s) => sum + (s.price_per_month || 0), 0);
  const totalCredits = subs
    .filter(s => s.status === "active")
    .reduce((sum, s) => sum + (s.credits_remaining || 0), 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar role="student" />

      <main className="flex-1 px-4 py-6 pb-28 md:py-8 md:px-8 max-w-2xl">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg">
            {toast}
          </div>
        )}

        {/* Cancel modal */}
        {cancelTarget && (
          <CancelModal
            sub={cancelTarget}
            onClose={() => setCancelTarget(null)}
            onConfirm={handleCancel}
            loading={cancelling}
          />
        )}

        <h1 className="text-2xl font-black text-gray-900 mb-1">ჩემი გამოწერები</h1>
        <p className="text-sm text-gray-400 mb-6">ყოველთვიური პაკეტები და კრედიტების მართვა</p>

        {/* Summary strip (if active subs) */}
        {subs.some(s => s.status === "active") && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-black text-emerald-700">{totalCredits}</p>
              <p className="text-xs text-gray-400 mt-0.5">ხელმისაწვდ. კრედიტი</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-black text-gray-900">{totalMonthly} ₾</p>
              <p className="text-xs text-gray-400 mt-0.5">/ თვეში (სულ)</p>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {subs.length > 0 && (
          <div className="flex gap-2 mb-5">
            {[["active", "აქტიური"], ["all", "ყველა"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  filter === k ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-400"
                }`}>{l}</button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {displayed.map(sub => (
              <SubCard key={sub.id} sub={sub} onCancel={setCancelTarget} />
            ))}
          </div>
        )}

        {/* Info box */}
        {!loading && subs.length > 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-700 space-y-1.5">
            <p className="font-bold text-sm text-blue-800 mb-2">📋 გამოწერის წესები</p>
            <p>✅ გაუქმება შეგიძლიათ ნებისმიერ დროს — ძალაში შედის მომდ. ჩამოჭრამდე</p>
            <p>⏳ გადახდის ჩავარდნა: 48 სთ შეტყობინება → გაყინვა</p>
            <p>🔄 კრედიტი ავტომ. ემატება ყოველი გადახდის შემდეგ</p>
            <p>💰 თანხა ჩამოეჭრება ყოველ 30 დღეში ავტომატურად</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SubscriptionsContent />
    </Suspense>
  );
}
