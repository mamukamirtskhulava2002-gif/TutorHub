"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const TABS = [
  { key: "all",     label: "ყველა" },
  { key: "paid",    label: "გადახდილი" },
  { key: "pending", label: "მოლოდინში" },
];

export default function ParentPaymentsPage() {
  const router = useRouter();

  const [loading, setLoading]           = useState(true);
  const [parentName, setParentName]     = useState("მშობელი");
  const [parentId, setParentId]         = useState(null);
  const [payments, setPayments]         = useState([]);
  const [children, setChildren]         = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedChild, setSelectedChild] = useState("");
  const [tab, setTab]                   = useState("all");
  const [stats, setStats]               = useState({ totalSpend: 0, monthlySpend: 0, pending: 0 });

  // refund modal state
  const [refundModal, setRefundModal]   = useState(null); // { paymentId, bookingId, studentId, label }
  const [refundReason, setRefundReason] = useState("");
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState("");
  const [refundError, setRefundError]   = useState("");
  const [sentRefunds, setSentRefunds]   = useState(new Set());

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setParentId(user.id);

      const { data: profile } = await supabase
        .from("profiles").select("full_name, role, wallet_balance").eq("id", user.id).single();
      if (profile?.role !== "parent") { router.push("/dashboard"); return; }
      if (profile?.full_name) setParentName(profile.full_name.split(" ")[0]);
      setWalletBalance(profile?.wallet_balance || 0);

      const { data: childrenData } = await supabase
        .from("parent_children")
        .select("id, profiles!child_id(id, full_name)")
        .eq("parent_id", user.id);
      const kids = childrenData || [];
      setChildren(kids);

      const childIds = selectedChild
        ? [selectedChild]
        : kids.map(c => c.profiles?.id).filter(Boolean);

      if (childIds.length > 0) {
        let q = supabase
          .from("payments")
          .select(`id, amount, status, created_at, booking_id,
            profiles!student_id(id, full_name),
            bookings(id, tutors(id, subject, profiles(full_name)))`)
          .in("student_id", childIds)
          .order("created_at", { ascending: false });
        if (tab !== "all") q = q.eq("status", tab);
        const { data: pData } = await q;
        setPayments(pData || []);

        const { data: all } = await supabase
          .from("payments").select("amount, status, created_at").in("student_id", childIds);
        const paid = all?.filter(p => p.status === "paid") || [];
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
        setStats({
          totalSpend:   paid.reduce((s, p) => s + (p.amount || 0), 0),
          monthlySpend: paid.filter(p => new Date(p.created_at) >= startOfMonth)
                            .reduce((s, p) => s + (p.amount || 0), 0),
          pending:      all?.filter(p => p.status === "pending")
                            .reduce((s, p) => s + (p.amount || 0), 0) || 0,
        });

        // უკვე გაგზავნილი refund requests
        const { data: existing } = await supabase
          .from("refund_requests").select("booking_id").eq("requester_id", user.id);
        setSentRefunds(new Set((existing || []).map(r => r.booking_id)));
      }

      setLoading(false);
    }
    fetchData();
  }, [tab, selectedChild]);

  async function sendRefund(e) {
    e.preventDefault();
    if (!refundModal || !refundReason.trim()) return;
    setRefundSaving(true);
    setRefundError("");

    const supabase = createClient();
    const { error } = await supabase.from("refund_requests").insert({
      booking_id:    refundModal.bookingId,
      requester_id:  parentId,
      student_id:    refundModal.studentId,
      reason:        refundReason.trim(),
    });

    if (error) {
      setRefundError("შეცდომა: " + error.message);
      setRefundSaving(false);
      return;
    }

    setSentRefunds(prev => new Set([...prev, refundModal.bookingId]));
    setRefundSuccess("მოთხოვნა გაიგზავნა! ადმინი 24 საათში განიხილავს.");
    setRefundModal(null);
    setRefundReason("");
    setRefundSaving(false);
  }

  function fmt(iso) {
    return new Date(iso).toLocaleDateString("ka-GE", { day: "numeric", month: "long", year: "numeric" });
  }

  const AVATAR = ["avatar-blue","avatar-green","avatar-amber","avatar-purple"];

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="parent" userName={parentName} />

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => { setRefundModal(null); setRefundReason(""); setRefundError(""); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg mb-1">↩ თანხის დაბრუნების მოთხოვნა</h3>
            <p className="text-sm text-gray-400 mb-4">
              <span className="font-medium text-gray-700">{refundModal.label}</span>
            </p>
            {refundError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                {refundError}
              </div>
            )}
            <form onSubmit={sendRefund} className="space-y-4">
              <div>
                <label className="label">პრობლემის აღწერა</label>
                <textarea className="input resize-none" rows={4}
                  placeholder="მაგ: გაკვეთილი გაუქმდა, ფული არ დაბრუნებია..."
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  required />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={refundSaving || !refundReason.trim()}
                  className="btn-primary flex-1 py-2.5 disabled:opacity-50">
                  {refundSaving ? "იგზავნება..." : "გაგზავნა ადმინთან"}
                </button>
                <button type="button"
                  onClick={() => { setRefundModal(null); setRefundReason(""); setRefundError(""); }}
                  className="btn-secondary px-5 py-2.5">
                  გაუქმება
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="p-6 md:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">💳 გადახდები</h1>
            <p className="text-sm text-gray-400 mt-0.5">ფინანსური ისტორია და ბალანსი</p>
          </div>
        </div>

        {refundSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
            ✅ {refundSuccess}
          </div>
        )}

        {/* Stats + Wallet */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-sm">
            <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wide mb-1">ბალანსი</p>
            <p className="text-3xl font-black mb-3">{walletBalance.toFixed(2)} ₾</p>
            <button className="text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-all">
              + შევსება
            </button>
          </div>
          {[
            { icon: "💸", label: "სულ გადახდილი",   value: `${stats.totalSpend.toFixed(2)} ₾` },
            { icon: "📅", label: "ამ თვის ხარჯი",   value: `${stats.monthlySpend.toFixed(2)} ₾` },
            { icon: "⏳", label: "მოლოდინში",        value: `${stats.pending.toFixed(2)} ₾` },
          ].map((s, i) => (
            <div key={i} className="stat-card p-5">
              {loading ? <div className="animate-pulse space-y-2"><div className="h-3 bg-gray-200 rounded" /><div className="h-7 bg-gray-200 rounded w-2/3" /></div> : (
                <>
                  <p className="text-2xl mb-1">{s.icon}</p>
                  <p className="text-xl font-black text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.label}</p>
                </>
              )}
            </div>
          ))}
        </div>

        {/* შვილების ფილტრი */}
        {children.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedChild("")}
              className={`text-sm px-4 py-2 rounded-xl border transition-all ${
                selectedChild === "" ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-500 hover:border-emerald-300"
              }`}>ყველა შვილი</button>
            {children.map((child, i) => (
              <button key={child.id}
                onClick={() => setSelectedChild(child.profiles?.id || "")}
                className={`text-sm px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
                  selectedChild === child.profiles?.id ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-500 hover:border-emerald-300"
                }`}>
                <span className={`avatar w-5 h-5 text-xs ${AVATAR[i%4]}`}>
                  {child.profiles?.full_name?.[0]}
                </span>
                {child.profiles?.full_name}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-all ${
                tab === t.key
                  ? "text-emerald-600 border-b-2 border-emerald-600 -mb-px"
                  : "text-gray-400 hover:text-gray-600"
              }`}>{t.label}</button>
          ))}
        </div>

        {/* Payment list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="card p-5 h-20 animate-pulse" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">💳</p>
            <p className="text-gray-500 font-medium">გადახდები არ არის</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map(p => {
              const bookingId = p.bookings?.id || p.booking_id;
              const alreadySent = sentRefunds.has(bookingId);

              return (
                <div key={p.id} className="card p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          👶 {p.profiles?.full_name}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        <Link href={`/tutor/${p.bookings?.tutors?.id}`} className="hover:underline hover:text-emerald-700">
                          {p.bookings?.tutors?.profiles?.full_name || "მასწავლებელი"}
                        </Link>
                        {p.bookings?.tutors?.subject?.[0] && (
                          <span className="text-gray-400 font-normal"> · {p.bookings.tutors.subject[0]}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmt(p.created_at)}</p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        p.status === "paid"    ? "bg-emerald-50 text-emerald-700" :
                        p.status === "pending" ? "bg-amber-50 text-amber-700" :
                        "bg-red-50 text-red-500"
                      }`}>
                        {p.status === "paid" ? "გადახდილი" : p.status === "pending" ? "მოლოდინში" : "გაუქმებული"}
                      </span>
                      <span className="font-black text-gray-900 text-lg">{p.amount} ₾</span>

                      {/* Refund button */}
                      {p.status === "paid" && bookingId && (
                        alreadySent ? (
                          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">
                            ✓ გაგზავნილია
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setRefundModal({
                                bookingId,
                                studentId: p.profiles?.id,
                                label: `${p.profiles?.full_name} · ${p.bookings?.tutors?.profiles?.full_name || "მასწ."} · ${p.amount}₾`,
                              });
                              setRefundError("");
                            }}
                            className="text-xs text-red-500 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-all font-medium">
                            ↩ თანხის დაბრუნება
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
