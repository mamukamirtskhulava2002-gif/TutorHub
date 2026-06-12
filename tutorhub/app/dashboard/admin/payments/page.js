"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AdminLayout from "@/components/AdminLayout";

const MONTHS = ["იანვ","თებ","მარ","აპრ","მაი","ივნ","ივლ","აგვ","სექ","ოქტ","ნოე","დეკ"];

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("ადმინი");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, pending: 0, count: 0 });
  const [monthlyData, setMonthlyData] = useState(Array(12).fill(0));

  useEffect(() => { fetchPayments(); }, []);

  async function fetchPayments() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth"); return; }
    const { data: profile } = await supabase
      .from("profiles").select("role, full_name").eq("id", session.user.id).single();
    if (profile?.role !== "admin") { router.push("/dashboard"); return; }
    if (profile?.full_name) setAdminName(profile.full_name);

    const { data } = await supabase
      .from("payments")
      .select("id, amount, status, created_at, profiles!student_id(full_name), bookings(tutors(subject, profiles(full_name)))")
      .order("created_at", { ascending: false });

    if (data) {
      setPayments(data);
      const now = new Date();
      const monthly = Array(12).fill(0);
      let total = 0, thisMonth = 0, pending = 0;
      data.forEach(p => {
        if (p.status === "paid") {
          const d = new Date(p.created_at);
          monthly[d.getMonth()] += p.amount || 0;
          total += p.amount || 0;
          if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())
            thisMonth += p.amount || 0;
        }
        if (p.status === "pending") pending += p.amount || 0;
      });
      setMonthlyData(monthly);
      setStats({ total, thisMonth, pending, count: data.length });
    }
    setLoading(false);
  }

  async function updateStatus(id, status) {
    const supabase = createClient();
    await supabase.from("payments").update({ status }).eq("id", id);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    setStats(prev => {
      const payment = payments.find(p => p.id === id);
      if (!payment) return prev;
      const next = { ...prev };
      if (payment.status === "pending" && status === "paid") {
        next.pending    = Math.max(0, next.pending - (payment.amount || 0));
        next.total     += payment.amount || 0;
        const d = new Date(payment.created_at);
        const now = new Date();
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())
          next.thisMonth += payment.amount || 0;
      }
      return next;
    });
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("ka-GE", { day:"numeric", month:"short", year:"numeric" });
  }

  const filtered = payments
    .filter(p => filter === "all" || p.status === filter)
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (p.profiles?.full_name || "").toLowerCase().includes(q) ||
             (p.bookings?.tutors?.profiles?.full_name || "").toLowerCase().includes(q);
    });

  const maxBar = Math.max(...monthlyData, 1);

  return (
    <AdminLayout adminName={adminName}>
      <h1 className="text-2xl font-black text-gray-900 mb-6">💰 გადახდები</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "სულ შემოსავალი",  value: `${stats.total} ₾`,     color: "text-emerald-600" },
          { label: "ამ თვე",          value: `${stats.thisMonth} ₾`,  color: "text-blue-600" },
          { label: "მოლოდინში",       value: `${stats.pending} ₾`,   color: "text-amber-600" },
          { label: "ტრანზაქციები",    value: stats.count,             color: "text-gray-900" },
        ].map((s, i) => (
          <div key={i} className="stat-card p-5">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-4">📈 წლიური შემოსავალი</h2>
        <div className="flex items-end gap-1.5 h-28 mb-2">
          {monthlyData.map((v, i) => (
            <div key={i} className="flex-1 h-full flex items-end group relative">
              <div className="w-full rounded-t-md transition-all"
                style={{ height: `${(v / maxBar) * 100}%`, minHeight: v > 0 ? "4px" : "0",
                  backgroundColor: i === new Date().getMonth() ? "#059669" : "#D1FAE5" }} />
              {v > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                  {v} ₾
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          {MONTHS.map((m, i) => <div key={i} className="flex-1 text-center text-xs text-gray-400">{m}</div>)}
        </div>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white min-w-[200px] focus-within:border-emerald-400 transition-colors">
          <span className="pl-4 flex items-center text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="სტუდენტი ან მასწავლებელი..."
            className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent" />
          {search && <button onClick={() => setSearch("")} className="px-3 text-gray-300 hover:text-gray-500">✕</button>}
        </div>
        <div className="flex gap-1.5">
          {[["all","ყველა"],["paid","✓ გადახდ."],["pending","⏳ მოლოდ."],["cancelled","✕ გაუქმ."]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                filter === k ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-500 hover:border-emerald-300"
              }`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16"><p className="text-3xl mb-3">💰</p><p className="text-gray-400 text-sm">გადახდები ვერ მოიძებნა</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">სტუდენტი</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">მასწავლებელი</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">საგანი</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">თარიღი</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">სტატუსი</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">თანხა</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900">{p.profiles?.full_name || "—"}</td>
                    <td className="px-5 py-4 text-gray-600">{p.bookings?.tutors?.profiles?.full_name || "—"}</td>
                    <td className="px-5 py-4 text-gray-400">{p.bookings?.tutors?.subject?.[0] || "—"}</td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        p.status === "paid"    ? "bg-emerald-50 text-emerald-700" :
                        p.status === "pending" ? "bg-amber-50 text-amber-700" :
                        "bg-red-50 text-red-500"
                      }`}>
                        {p.status === "paid" ? "გადახდილი" : p.status === "pending" ? "მოლოდინში" : "გაუქმებული"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-black text-gray-900">{p.amount} ₾</td>
                    <td className="px-5 py-4">
                      {p.status === "pending" && (
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => updateStatus(p.id, "paid")}
                            className="text-xs px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-all">
                            ✓ დადასტ.
                          </button>
                          <button onClick={() => updateStatus(p.id, "cancelled")}
                            className="text-xs px-2.5 py-1.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 font-medium transition-all">
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3 text-right">{filtered.length} ჩანაწერი</p>
    </AdminLayout>
  );
}
