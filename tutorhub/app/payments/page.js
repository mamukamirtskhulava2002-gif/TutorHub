"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("history");

  const stats = [
    { id: 1, label: "ამ თვის ხარჯი", value: "120 ₾", icon: "💳" },
    { id: 2, label: "სულ გადახდილი", value: "340 ₾", icon: "📊" },
    { id: 3, label: "მომავალი გადახდა", value: "40 ₾", icon: "📅" },
  ];

  useEffect(() => {
    async function fetchPayments() {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      const { data } = await supabase
        .from("payments")
        .select("id, amount, status, created_at, bookings(id, tutors(profiles(full_name), subject))")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      setPayments(data || []);
      setLoading(false);
    }
    fetchPayments();
  }, []);

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("ka-GE", {
      day: "numeric", month: "long", year: "numeric",
    });
  }

  const tabs = [
    { key: "history",  label: "ისტორია" },
    { key: "upcoming", label: "მომავალი" },
  ];

  return (
    <div>
      <Navbar />
      <div className="dash-container">

        {/* Sidebar */}
        <div className="sidebar">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">მენიუ</p>
          </div>
          <Link href="/dashboard/student" className="sidebar-link">📊 დაშბორდი</Link>
          <Link href="/search" className="sidebar-link">🔍 მასწავლებლები</Link>
          <Link href="/dashboard/student/lessons" className="sidebar-link">📅 ჩემი გაკვეთილები</Link>
          <Link href="/messages" className="sidebar-link">💬 შეტყობინებები</Link>
          <Link href="/favorites" className="sidebar-link">❤️ ფავორიტები</Link>
          <Link href="/dashboard/student/payments" className="sidebar-link active">💳 გადახდები</Link>
          <Link href="/dashboard/student/settings" className="sidebar-link">⚙️ პარამეტრები</Link>
        </div>

        {/* Main */}
        <div className="main-content">
          <h1 className="text-2xl font-black text-gray-900 mb-6">💳 გადახდები</h1>

          {/* Stats */}
          <div className="stats-grid mb-6">
            {stats.map(stat => (
              <div key={stat.id} className="stat-card p-5">
                <p className="text-2xl mb-1">{stat.icon}</p>
                <h3 className="text-2xl font-black text-gray-900">{stat.value}</h3>
                <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-100">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
                  tab === t.key
                    ? "bg-white border border-b-white border-gray-100 text-emerald-600 -mb-px"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-3">💳</p>
              <p className="text-gray-500 font-medium">გადახდები არ არის</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map(payment => (
                <div key={payment.id} className="card p-5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {payment.bookings?.tutors?.profiles?.full_name || "მასწავლებელი"}
                      {" · "}
                      {payment.bookings?.tutors?.subject?.[0] || "გაკვეთილი"}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{formatDate(payment.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      payment.status === "paid"    ? "bg-emerald-50 text-emerald-700" :
                      payment.status === "pending" ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-500"
                    }`}>
                      {payment.status === "paid"    ? "გადახდილი" :
                       payment.status === "pending" ? "მოლოდინში" : "გაუქმებული"}
                    </span>
                    <span className="font-black text-gray-900">{payment.amount} ₾</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}