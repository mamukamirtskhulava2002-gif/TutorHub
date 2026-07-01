"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

// ─── helpers ────────────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ka-GE", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function avatarColor(name) {
  const colors = [
    "bg-emerald-100 text-emerald-800",
    "bg-blue-100 text-blue-800",
    "bg-purple-100 text-purple-800",
    "bg-amber-100 text-amber-800",
    "bg-orange-100 text-orange-800",
  ];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
}

function monthLabel(date) {
  return date.toLocaleDateString("ka-GE", { month: "short" });
}

function exportCSV(payments) {
  const rows = [
    ["თარიღი", "მასწავლებელი", "საგანი", "თანხა", "სტატუსი"],
    ...payments.map(p => [
      formatDate(p.created_at),
      p.bookings?.tutors?.profiles?.full_name || "—",
      p.bookings?.tutors?.subject?.[0] || p.bookings?.tutors?.subject || "—",
      p.amount,
      p.status === "paid" ? "გადახდილი" : p.status === "pending" ? "მოლოდინში" : "გაუქმებული",
    ]),
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const DATE_FILTERS = [
  { key: "month",  label: "ამ თვეს" },
  { key: "3month", label: "ბოლო 3 თვე" },
  { key: "all",    label: "ყველა" },
];

// ─── component ───────────────────────────────────────────────────────────────
export default function StudentPaymentsPage() {
  const router = useRouter();

  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState("history");
  const [dateFilter, setDateFilter] = useState("all");
  const [stats, setStats]           = useState({ thisMonth: 0, total: 0, pending: 0, count: 0 });
  const [chartData, setChartData]   = useState([]);
  const [userName, setUserName]     = useState("");
  const [userId, setUserId]         = useState(null);

  useEffect(() => {
    async function fetchPayments() {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setUserId(user.id);

      const [{ data: profileData }, { data }] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
        supabase
          .from("payments")
          .select("id, amount, status, created_at, booking_id, bookings(id, tutor_id, tutors(profiles(full_name), subject))")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (profileData?.role !== "student") { router.push("/dashboard"); return; }
      if (profileData?.full_name) setUserName(profileData.full_name.split(" ")[0]);

      if (data) {
        setPayments(data);

        const now = new Date();
        let thisMonth = 0, total = 0, pending = 0, count = 0;

        // last 4 months chart
        const months = Array.from({ length: 4 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1);
          return { label: monthLabel(d), year: d.getFullYear(), month: d.getMonth(), amount: 0 };
        });

        data.forEach(p => {
          if (p.status === "paid") {
            total += p.amount || 0;
            count++;
            const d = new Date(p.created_at);
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
              thisMonth += p.amount || 0;
            }
            const slot = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
            if (slot) slot.amount += p.amount || 0;
          }
          if (p.status === "pending") pending += p.amount || 0;
        });

        setStats({ thisMonth, total, pending, count });
        setChartData(months);
      }

      setLoading(false);
    }
    fetchPayments();
  }, []);

  // ─── filtering ───
  const now = new Date();
  const dateFilterFn = (p) => {
    if (dateFilter === "month") {
      const d = new Date(p.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (dateFilter === "3month") {
      return new Date(p.created_at) >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
    }
    return true;
  };

  const filtered = payments.filter(p => {
    const tabMatch =
      tab === "history"  ? (p.status === "paid" || p.status === "cancelled") :
      tab === "upcoming" ? p.status === "pending" : true;
    return tabMatch && dateFilterFn(p);
  });

  const maxChart = Math.max(...chartData.map(m => m.amount), 1);

  // ─── render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="student" userName={userName} />

      <main className="p-6 md:p-8">
        <div className="max-w-3xl">

          {/* Header */}
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h1 className="text-2xl font-black text-gray-900">💳 გადახდები</h1>
            {!loading && payments.filter(p => p.status === "paid").length > 0 && (
              <button
                onClick={() => exportCSV(payments.filter(p => p.status === "paid"))}
                className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-all flex items-center gap-1.5">
                ⬇️ CSV
              </button>
            )}
          </div>
          {userName && <p className="text-sm text-gray-400 mb-5">გამარჯობა, {userName}!</p>}

          {/* Stats */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-2/3 mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "ამ თვეს",      value: `${stats.thisMonth}₾`, icon: "📅", color: "text-emerald-600" },
                { label: "სულ",          value: `${stats.total}₾`,     icon: "📊", color: "text-gray-800" },
                { label: "მოლოდინში",   value: `${stats.pending}₾`,   icon: "⏳", color: "text-amber-600" },
                { label: "გადახდა",     value: `${stats.count}`,       icon: "✅", color: "text-gray-800" },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                  <p className="text-xl mb-0.5">{s.icon}</p>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Mini chart */}
          {!loading && chartData.some(m => m.amount > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                ბოლო 4 თვის ხარჯი
              </p>
              <div className="flex items-end gap-3 h-20">
                {chartData.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-xs font-semibold text-gray-600">{m.amount > 0 ? `${m.amount}₾` : ""}</p>
                    <div className="w-full rounded-t-lg bg-emerald-500 transition-all"
                      style={{ height: `${Math.max((m.amount / maxChart) * 60, m.amount > 0 ? 4 : 0)}px` }} />
                    <p className="text-[11px] text-gray-400">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs + date filter */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {[
                { key: "history",  label: "ისტორია" },
                { key: "upcoming", label: "მოლოდინში",
                  badge: payments.filter(p => p.status === "pending").length },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {t.label}
                  {t.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {DATE_FILTERS.map(f => (
                <button key={f.key} onClick={() => setDateFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    dateFilter === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">💳</p>
              <p className="text-gray-600 font-semibold mb-1">
                {tab === "upcoming" ? "მოლოდინში გადახდები არ არის" : "გადახდების ისტორია ცარიელია"}
              </p>
              {tab === "history" && (
                <Link href="/search"
                  className="inline-block mt-3 btn-primary text-sm px-5 py-2.5">
                  მასწავლებლის ძიება →
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(payment => {
                const tutorName = payment.bookings?.tutors?.profiles?.full_name || "მასწავლებელი";
                const subject   = Array.isArray(payment.bookings?.tutors?.subject)
                  ? payment.bookings.tutors.subject[0]
                  : payment.bookings?.tutors?.subject || "გაკვეთილი";
                const isPending   = payment.status === "pending";
                const isPaid      = payment.status === "paid";
                const isCancelled = payment.status === "cancelled";

                return (
                  <div key={payment.id}
                    className={`bg-white rounded-2xl p-4 border shadow-sm transition-all ${
                      isPending   ? "border-amber-200 bg-amber-50/20" :
                      isCancelled ? "border-gray-100 opacity-60" :
                      "border-gray-100"
                    }`}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor(tutorName)}`}>
                        {getInitials(tutorName)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link href={`/tutors/${payment.bookings?.tutor_id}`} className="font-semibold text-gray-900 text-sm hover:underline hover:text-emerald-700">
                              {tutorName}
                            </Link>
                            <p className="text-xs text-gray-400">{subject}</p>
                          </div>
                          <p className={`font-black text-base shrink-0 ${
                            isPaid ? "text-gray-900" : isPending ? "text-amber-700" : "text-gray-400 line-through"
                          }`}>
                            {payment.amount}₾
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-400">{formatDate(payment.created_at)}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isPaid      ? "bg-emerald-50 text-emerald-700" :
                              isPending   ? "bg-amber-50 text-amber-700" :
                              "bg-gray-100 text-gray-500"
                            }`}>
                              {isPaid ? "✅ გადახდილი" : isPending ? "⏳ მოლოდინში" : "❌ გაუქმებული"}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            {payment.bookings?.id && (
                              <Link href={`/dashboard/student/lessons`}
                                className="text-xs text-gray-400 hover:text-emerald-600 transition-colors">
                                გაკვეთილი →
                              </Link>
                            )}
                            {isPending && payment.bookings?.tutor_id && (
                              <Link
                                href={`/booking/${payment.bookings.tutor_id}`}
                                className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                                💳 გადახდა
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary footer */}
          {!loading && filtered.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-400">
              <p>{filtered.length} გადახდა</p>
              <p className="font-semibold text-gray-700">
                სულ: {filtered.reduce((s, p) => s + (p.amount || 0), 0)}₾
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
