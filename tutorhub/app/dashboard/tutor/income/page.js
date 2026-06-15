"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const COMMISSION   = 0.10;   // 10%
const MIN_WITHDRAW = 20;
const MONTHS = ["იანვ","თებ","მარ","აპრ","მაი","ივნ","ივლ","აგვ","სექ","ოქტ","ნოე","დეკ"];

function gel(n) { return `${Math.round(n).toLocaleString()} ₾`; }
function fdate(iso) {
  return new Date(iso).toLocaleDateString("ka-GE", { day:"numeric", month:"short", year:"numeric" });
}

const TYPE_LABEL = {
  trial: "🧪 საცდელი", single: "📗 ერთჯ.",
  package: "📦 პაკეტი", group: "👥 ჯგუფი", recurring: "🔄 რეგულ.",
};

// ─── Withdraw Modal ────────────────────────────────────────────────────────────
function WithdrawModal({ available, iban, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const val   = parseFloat(amount) || 0;
  const valid = val >= MIN_WITHDRAW && val <= available;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="font-black text-gray-900 text-lg mb-1">💸 თანხის გატანა</h3>
        <p className="text-sm text-gray-400 mb-4">
          ხელმისაწვდ.: <span className="font-bold text-emerald-600">{gel(available)}</span>
        </p>

        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-gray-400 mb-0.5">IBAN</p>
          <p className="text-sm font-mono font-semibold text-gray-700">{iban}</p>
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">თანხა (₾)</label>
          <input
            type="number" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`მინ. ${MIN_WITHDRAW} ₾`}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {amount && !valid && (
            <p className="text-xs text-red-500 mt-1">
              {val < MIN_WITHDRAW ? `მინიმუმი ${MIN_WITHDRAW} ₾` : `მაქს. ${gel(available)}`}
            </p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700 leading-relaxed">
          💡 თანხა ანგარიშზე აისახება <strong>1-2 სამ. დღეში</strong>.<br />
          მინ. გასატანი: <strong>{MIN_WITHDRAW} ₾</strong>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
            გაუქმება
          </button>
          <button onClick={() => valid && onSubmit(val)} disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-40">
            გატანა 💸
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function TutorIncomePage() {
  const router = useRouter();

  const [tutorId, setTutorId]   = useState(null);
  const [tutorName, setTutorName] = useState("მასწავლებელი");
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);

  const [bookings, setBookings]       = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);

  const [iban, setIban]         = useState("");
  const [ibanEdit, setIbanEdit] = useState(false);
  const [ibanInput, setIbanInput] = useState("");
  const [savingIban, setSavingIban] = useState(false);

  const [chartPeriod, setChartPeriod] = useState("month");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [txSearch, setTxSearch] = useState("");
  const [txStatus, setTxStatus] = useState("all");

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setTutorId(user.id);

      const [{ data: profile }, { data: tutorData }] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
        supabase.from("tutors").select("bank_iban, price_per_hour").eq("id", user.id).single(),
      ]);
      if (profile?.role !== "tutor") { router.push("/dashboard"); return; }
      if (profile?.full_name) setTutorName(profile.full_name.split(" ")[0]);
      if (tutorData?.bank_iban) { setIban(tutorData.bank_iban); setIbanInput(tutorData.bank_iban); }

      // bookings
      const { data: bData } = await supabase
        .from("bookings")
        .select(`
          id, date, time_slot, status, total_price, booking_type,
          duration_hours, created_at, package_id,
          profiles!student_id(full_name, id)
        `)
        .eq("tutor_id", user.id)
        .order("date", { ascending: false });
      setBookings(bData || []);

      // withdrawals — table may not exist yet
      const { data: wData } = await supabase
        .from("withdrawals")
        .select("id, amount, status, created_at")
        .eq("tutor_id", user.id)
        .order("created_at", { ascending: false });
      setWithdrawals(wData || []);

      setLoading(false);
    }
    fetchData();
  }, [router]);

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const next30     = new Date(now.getTime() + 30 * 86400000);

  const done      = useMemo(() => bookings.filter(b => b.status === "done"), [bookings]);
  const confirmed = useMemo(() => bookings.filter(b => b.status === "confirmed" || b.status === "pending"), [bookings]);

  const totalWithdrawn = useMemo(() =>
    withdrawals.filter(w => w.status === "completed").reduce((s, w) => s + w.amount, 0)
  , [withdrawals]);

  const grossEarned  = useMemo(() => done.reduce((s, b) => s + (b.total_price || 0), 0), [done]);
  const netEarned    = useMemo(() => grossEarned * (1 - COMMISSION), [grossEarned]);
  const available    = useMemo(() => Math.max(0, netEarned - totalWithdrawn), [netEarned, totalWithdrawn]);
  const pendingNet   = useMemo(() => confirmed.reduce((s, b) => s + (b.total_price || 0) * (1 - COMMISSION), 0), [confirmed]);
  const thisMonth    = useMemo(() =>
    done.filter(b => new Date(b.date) >= monthStart)
      .reduce((s, b) => s + (b.total_price || 0) * (1 - COMMISSION), 0)
  , [done]);

  const forecast = useMemo(() => {
    const upcoming = bookings.filter(b => {
      const d = new Date(b.date);
      return b.status === "confirmed" && d > now && d <= next30;
    });
    return {
      net: upcoming.reduce((s, b) => s + (b.total_price || 0) * (1 - COMMISSION), 0),
      count: upcoming.length,
      byPackage: (() => {
        const map = {};
        upcoming.filter(b => b.package_id).forEach(b => {
          if (!map[b.package_id]) map[b.package_id] = { name: b.profiles?.full_name, count: 0, net: 0 };
          map[b.package_id].count++;
          map[b.package_id].net += (b.total_price || 0) * (1 - COMMISSION);
        });
        return Object.values(map);
      })(),
    };
  }, [bookings]);

  // ─── Chart ─────────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (chartPeriod === "week") {
      const days = Array(7).fill(0).map((_, i) => {
        const d = new Date(now); d.setDate(d.getDate() - 6 + i);
        return { label: ["კვ","ორ","სა","ოთ","ხუ","პა","შა"][d.getDay()],
                 date: d.toLocaleDateString("en-CA"), net: 0, lessons: 0 };
      });
      done.forEach(b => {
        const idx = days.findIndex(d => d.date === b.date);
        if (idx >= 0) { days[idx].net += (b.total_price||0)*(1-COMMISSION); days[idx].lessons++; }
      });
      return days;
    }
    if (chartPeriod === "month") {
      const months = Array(12).fill(0).map((_, i) => ({ label: MONTHS[i], net: 0, lessons: 0 }));
      done.forEach(b => {
        const d = new Date(b.date);
        if (d.getFullYear() === now.getFullYear()) {
          months[d.getMonth()].net += (b.total_price||0)*(1-COMMISSION);
          months[d.getMonth()].lessons++;
        }
      });
      return months;
    }
    // year
    const yrs = {};
    done.forEach(b => {
      const y = new Date(b.date).getFullYear();
      if (!yrs[y]) yrs[y] = { label: String(y), net: 0, lessons: 0 };
      yrs[y].net += (b.total_price||0)*(1-COMMISSION); yrs[y].lessons++;
    });
    return Object.values(yrs).sort((a,b) => a.label - b.label);
  }, [bookings, chartPeriod]);

  const maxChart = Math.max(...chartData.map(d => d.net), 1);
  const currentBarIdx = chartPeriod === "month" ? now.getMonth() : chartData.length - 1;

  // ─── Transactions ───────────────────────────────────────────────────────────
  const transactions = useMemo(() =>
    bookings
      .filter(b => b.total_price > 0)
      .filter(b => {
        if (txStatus === "done")      return b.status === "done";
        if (txStatus === "pending")   return b.status === "confirmed" || b.status === "pending";
        if (txStatus === "cancelled") return b.status === "cancelled";
        return true;
      })
      .filter(b => !txSearch || (b.profiles?.full_name||"").toLowerCase().includes(txSearch.toLowerCase()))
  , [bookings, txSearch, txStatus]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function saveIban() {
    if (!ibanInput.trim()) return;
    setSavingIban(true);
    const supabase = createClient();
    const { error } = await supabase.from("tutors")
      .update({ bank_iban: ibanInput.trim() }).eq("id", tutorId);
    if (error) { showToast("IBAN ვერ შეინახა", "error"); }
    else { setIban(ibanInput.trim()); setIbanEdit(false); showToast("IBAN შენახულია ✓"); }
    setSavingIban(false);
  }

  async function submitWithdraw(amount) {
    const supabase = createClient();
    const { error } = await supabase.from("withdrawals").insert({
      tutor_id: tutorId, amount, iban, status: "pending",
    });
    setShowWithdraw(false);
    if (error) { showToast("გატანა ვერ მოხდა", "error"); return; }
    showToast(`${gel(amount)} — გატანის მოთხოვნა გაიგზავნა! 1-2 სამ. დღე.`);
    const { data } = await supabase.from("withdrawals")
      .select("id, amount, status, created_at").eq("tutor_id", tutorId)
      .order("created_at", { ascending: false });
    setWithdrawals(data || []);
  }

  // ─── helpers ───────────────────────────────────────────────────────────────
  function statusBadge(s) {
    return s === "done"
      ? { l: "✅ შესრულებული", c: "bg-emerald-50 text-emerald-700" }
      : s === "confirmed" || s === "pending"
      ? { l: "⏳ მოლოდინში",   c: "bg-amber-50 text-amber-700" }
      : { l: "❌ გაუქმ.",       c: "bg-red-50 text-red-500" };
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-5 py-3 rounded-2xl shadow-lg border font-medium ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>{toast.msg}</div>
      )}

      {showWithdraw && (
        <WithdrawModal
          available={available} iban={iban}
          onClose={() => setShowWithdraw(false)}
          onSubmit={submitWithdraw}
        />
      )}

      <main className="p-6 md:p-8">
        <h1 className="text-2xl font-black text-gray-900 mb-0.5">💰 შემოსავლები</h1>
        <p className="text-sm text-gray-400 mb-6">ყველა ფინანსური მონაცემი ერთ ადგილზე</p>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-1/4 mb-3" />
                <div className="h-7 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (<>

          {/* ── KPI cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "💵 ხელმისაწვდომი", value: gel(available),  sub: "გასატანად მზადაა", border: "border-emerald-100", color: "text-emerald-600" },
              { label: "⏳ მოლოდინში",     value: gel(pendingNet),  sub: "გაკვეთ. შემდეგ",  border: "border-amber-100",   color: "text-amber-600" },
              { label: "📅 ამ თვეში",      value: gel(thisMonth),   sub: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`, border: "border-blue-100", color: "text-blue-600" },
              { label: "🏆 სულ",           value: gel(netEarned),   sub: "რეგისტრ. დღიდან", border: "border-gray-100",    color: "text-gray-900" },
            ].map((s, i) => (
              <div key={i} className={`bg-white rounded-2xl border ${s.border} p-5 shadow-sm`}>
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Payout + Forecast ─────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">

            {/* Payout */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4">🏦 თანხის გატანა</h2>

              {/* IBAN */}
              <p className="text-xs text-gray-400 mb-1 font-medium">ქართული IBAN</p>
              {ibanEdit ? (
                <div className="flex gap-2 mb-4">
                  <input
                    value={ibanInput}
                    onChange={e => setIbanInput(e.target.value.toUpperCase())}
                    placeholder="GE00TB0000000000000000"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button onClick={saveIban} disabled={savingIban}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
                    {savingIban ? "..." : "✓"}
                  </button>
                  <button onClick={() => { setIbanEdit(false); setIbanInput(iban); }}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                    {iban
                      ? <p className="text-sm font-mono text-gray-700 tracking-wide">{iban}</p>
                      : <p className="text-sm text-gray-300 italic">IBAN არ არის — დაამატე</p>
                    }
                  </div>
                  <button onClick={() => setIbanEdit(true)}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 text-sm">✏️</button>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700 leading-relaxed">
                💡 თანხა ანგარიშზე აისახება <strong>1-2 სამ. დღეში</strong> ·
                მინ. <strong>{MIN_WITHDRAW} ₾</strong> ·
                კომ. <strong>{COMMISSION * 100}%</strong> (უკვე ჩამოჭრილია)
              </div>

              <button
                onClick={() => {
                  if (!iban) { showToast("ჯერ IBAN მიაბი", "error"); return; }
                  if (available < MIN_WITHDRAW) { showToast(`მინ. ${MIN_WITHDRAW} ₾ საჭიროა`, "error"); return; }
                  setShowWithdraw(true);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors">
                💸 თანხის გატანა · {gel(available)}
              </button>

              {/* withdrawal history */}
              {withdrawals.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
                  <p className="text-xs font-semibold text-gray-400">ბოლო გატანები</p>
                  {withdrawals.slice(0, 4).map(w => (
                    <div key={w.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{fdate(w.created_at)}</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        w.status === "completed" ? "bg-emerald-50 text-emerald-600"
                        : w.status === "rejected" ? "bg-red-50 text-red-500"
                        : "bg-amber-50 text-amber-600"
                      }`}>
                        {w.status === "completed" ? "✓ გატანილი"
                        : w.status === "rejected"  ? "✕ უარყ."
                        : "⏳ მუშავდება"}
                      </span>
                      <span className="font-bold text-gray-700">{gel(w.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Forecast */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 shadow-sm text-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔮</span>
                <h2 className="font-bold">30 დღის პროგნოზი</h2>
              </div>

              <p className="text-4xl font-black mb-0.5">{gel(forecast.net)}</p>
              <p className="text-emerald-200 text-sm mb-4">
                გარანტ. მინიმუმი · {forecast.count} გაკვეთილი
              </p>

              <div className="bg-white/15 rounded-xl px-4 py-3 text-xs text-emerald-100 leading-relaxed mb-3">
                💡 გათვლა ეფუძნება დადასტ. ჯავშნებს მომავალი 30 დღის განმავლობაში.
                პაკეტებში ყოველი გაკვეთილი ცალ-ცალკეა გათვლილი.
              </div>

              {forecast.byPackage.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-emerald-300 font-medium mb-1">📦 პაკეტები</p>
                  {forecast.byPackage.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-emerald-100">{p.name || "სტ."} · {p.count} გაკვ.</span>
                      <span className="font-bold">{gel(p.net)}</span>
                    </div>
                  ))}
                </div>
              )}

              {forecast.count === 0 && (
                <p className="text-emerald-300 text-xs">დადასტ. ჯავშნები 30 დღეში არ გაქვს</p>
              )}
            </div>
          </div>

          {/* ── Chart ─────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h2 className="font-bold text-gray-900">📈 შემოსავლების დინამიკა</h2>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {[["week","კვირა"],["month","თვე"],["year","წელი"]].map(([k,l]) => (
                  <button key={k} onClick={() => setChartPeriod(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      chartPeriod === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}>{l}</button>
                ))}
              </div>
            </div>

            {chartData.every(d => d.net === 0) ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-gray-300 text-sm">მონაცემი ჯერ არ არის</p>
              </div>
            ) : (<>
              <div className="flex items-end gap-1.5 h-40 mb-2">
                {chartData.map((d, i) => (
                  <div key={i} className="flex-1 h-full flex items-end group relative">
                    <div className="w-full rounded-t-lg transition-all"
                      style={{
                        height: `${Math.max((d.net / maxChart) * 100, d.net > 0 ? 3 : 0)}%`,
                        backgroundColor: i === currentBarIdx ? "#059669" : "#D1FAE5",
                      }}
                    />
                    {d.net > 0 && (
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                        <p className="font-bold">{gel(d.net)}</p>
                        <p className="text-gray-300 text-center">{d.lessons} გაკვ.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                {chartData.map((d, i) => (
                  <div key={i} className="flex-1 text-center text-[10px] text-gray-400 truncate">{d.label}</div>
                ))}
              </div>
            </>)}
          </div>

          {/* ── Transaction history ───────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-bold text-gray-900">📋 ტრანზაქციები</h2>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={txSearch} onChange={e => setTxSearch(e.target.value)}
                  placeholder="🔍 სტუდენტი..."
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50 w-36"
                />
                <div className="flex gap-1">
                  {[["all","ყველა"],["done","შესრ."],["pending","მოლ."],["cancelled","გაუქმ."]].map(([k,l]) => (
                    <button key={k} onClick={() => setTxStatus(k)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        txStatus === k
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-gray-200 text-gray-500 hover:border-emerald-300"
                      }`}>{l}</button>
                  ))}
                </div>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-14">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm text-gray-400">ტრანზაქცია ვერ მოიძებნა</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="pb-2 pr-3 font-medium">თარიღი</th>
                      <th className="pb-2 pr-3 font-medium">სტუდენტი</th>
                      <th className="pb-2 pr-3 font-medium">ტიპი</th>
                      <th className="pb-2 pr-3 font-medium text-right">Gross</th>
                      <th className="pb-2 pr-3 font-medium text-right">კომ. {COMMISSION*100}%</th>
                      <th className="pb-2 pr-3 font-medium text-right">Net</th>
                      <th className="pb-2 font-medium">სტატუსი</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map(b => {
                      const gross      = b.total_price || 0;
                      const comm       = Math.round(gross * COMMISSION * 100) / 100;
                      const net        = gross - comm;
                      const badge = statusBadge(b.status);
                      return (
                        <tr key={b.id} className={`hover:bg-gray-50/60 transition-colors ${gross === 0 ? "opacity-50" : ""}`}>
                          <td className="py-3 pr-3">
                            <p className="text-xs text-gray-700 font-medium">{b.date}</p>
                            <p className="text-[10px] text-gray-400">{(b.time_slot||"").slice(0,5)}</p>
                          </td>
                          <td className="py-3 pr-3">
                            <p className="text-xs font-semibold text-gray-800">
                              {b.profiles?.full_name || "სტ."}
                            </p>
                          </td>
                          <td className="py-3 pr-3 text-xs text-gray-500 whitespace-nowrap">
                            {TYPE_LABEL[b.booking_type] || b.booking_type || "—"}
                          </td>
                          <td className="py-3 pr-3 text-right text-xs font-semibold text-gray-700">
                            {gross > 0 ? `${gross} ₾` : "—"}
                          </td>
                          <td className="py-3 pr-3 text-right text-xs text-red-400">
                            {gross > 0 ? `−${comm % 1 === 0 ? comm : comm.toFixed(2)} ₾` : "—"}
                          </td>
                          <td className="py-3 pr-3 text-right text-xs font-black text-emerald-600">
                            {gross > 0 ? `${net % 1 === 0 ? net : net.toFixed(2)} ₾` : "—"}
                          </td>
                          <td className="py-3">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badge.c}`}>
                              {badge.l}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100">
                      <td colSpan={3} className="pt-3 text-xs text-gray-400">{transactions.length} ჩანაწერი</td>
                      <td className="pt-3 text-right text-xs font-bold text-gray-700">
                        {transactions.reduce((s,b)=>s+(b.total_price||0),0)} ₾
                      </td>
                      <td className="pt-3 text-right text-xs font-bold text-red-400">
                        −{transactions.reduce((s,b)=>s+(b.total_price||0)*COMMISSION,0).toFixed(0)} ₾
                      </td>
                      <td className="pt-3 text-right text-xs font-black text-emerald-600">
                        {transactions.reduce((s,b)=>s+(b.total_price||0)*(1-COMMISSION),0).toFixed(0)} ₾
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </>)}
      </main>
    </div>
  );
}
