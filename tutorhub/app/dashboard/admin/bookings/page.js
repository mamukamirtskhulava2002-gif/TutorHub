"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AdminLayout from "@/components/AdminLayout";

const STATUS_MAP = {
  pending:   { label: "მოლოდინში", cls: "bg-amber-50 text-amber-700" },
  confirmed: { label: "დადასტ.",   cls: "bg-emerald-50 text-emerald-700" },
  done:      { label: "დასრულ.",   cls: "bg-gray-100 text-gray-500" },
  cancelled: { label: "გაუქმ.",    cls: "bg-red-50 text-red-500" },
  disputed:  { label: "დავა",      cls: "bg-orange-50 text-orange-600" },
};

export default function AdminBookingsPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("ადმინი");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState(null);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, done: 0 });

  useEffect(() => { fetchBookings(); }, []);

  async function fetchBookings() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth"); return; }
    const { data: profile } = await supabase
      .from("profiles").select("role, full_name").eq("id", session.user.id).single();
    if (profile?.role !== "admin") { router.push("/dashboard"); return; }
    if (profile?.full_name) setAdminName(profile.full_name);

    const { data } = await supabase
      .from("bookings")
      .select("id, status, start_time, end_time, total_price, created_at, profiles!student_id(full_name), tutors!tutor_id(subject, profiles(full_name))")
      .order("created_at", { ascending: false });

    if (data) {
      setBookings(data);
      setStats({
        total:     data.length,
        confirmed: data.filter(b => b.status === "confirmed").length,
        pending:   data.filter(b => b.status === "pending").length,
        done:      data.filter(b => b.status === "done").length,
      });
    }
    setLoading(false);
  }

  async function updateStatus(id, status) {
    setActionLoading(id + "_" + status);
    const supabase = createClient();
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    setStats(prev => {
      const old = bookings.find(b => b.id === id)?.status;
      const next = { ...prev };
      if (old && next[old] !== undefined) next[old] = Math.max(0, next[old] - 1);
      if (next[status] !== undefined) next[status]++;
      return next;
    });
    setActionLoading(null);
  }

  const filtered = bookings
    .filter(b => filter === "all" || b.status === filter)
    .filter(b => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (b.profiles?.full_name || "").toLowerCase().includes(q) ||
             (b.tutors?.profiles?.full_name || "").toLowerCase().includes(q) ||
             (b.tutors?.subject || []).join(" ").toLowerCase().includes(q);
    });

  function formatDateTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ka-GE", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
  }

  return (
    <AdminLayout adminName={adminName}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">📅 ჯავშნები</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "სულ",        value: stats.total,     color: "text-gray-900" },
          { label: "დადასტ.",    value: stats.confirmed, color: "text-emerald-600" },
          { label: "მოლოდინში", value: stats.pending,   color: "text-amber-600" },
          { label: "დასრულ.",   value: stats.done,      color: "text-blue-600" },
        ].map((s, i) => (
          <div key={i} className="stat-card p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white min-w-[200px] focus-within:border-emerald-400 transition-colors">
          <span className="pl-4 flex items-center text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="სტუდენტი, მასწავლებელი, საგანი..."
            className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent" />
          {search && <button onClick={() => setSearch("")} className="px-3 text-gray-300 hover:text-gray-500">✕</button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[["all","ყველა"],["pending","⏳ მოლოდ."],["confirmed","✓ დადასტ."],["done","✅ დასრულ."],["cancelled","✕ გაუქმ."]].map(([k, l]) => (
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
          <div className="text-center py-16"><p className="text-3xl mb-3">📅</p><p className="text-gray-400 text-sm">ჯავშნები ვერ მოიძებნა</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">სტუდენტი</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">მასწავლებელი</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">საგანი</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">დრო</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">თანხა</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">სტატუსი</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(b => {
                  const st = STATUS_MAP[b.status] || STATUS_MAP.pending;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-medium text-gray-900">{b.profiles?.full_name || "—"}</td>
                      <td className="px-5 py-4 text-gray-600">{b.tutors?.profiles?.full_name || "—"}</td>
                      <td className="px-5 py-4 text-gray-400">{b.tutors?.subject?.[0] || "—"}</td>
                      <td className="px-5 py-4 text-gray-400 text-xs">{formatDateTime(b.start_time)}</td>
                      <td className="px-5 py-4 font-black text-gray-900">{b.total_price ? `${b.total_price} ₾` : "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1.5 justify-end">
                          {b.status === "pending" && (
                            <>
                              <button onClick={() => updateStatus(b.id, "confirmed")} disabled={!!actionLoading}
                                className="text-xs px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium disabled:opacity-50 transition-all">
                                {actionLoading === b.id + "_confirmed" ? "..." : "✓"}
                              </button>
                              <button onClick={() => updateStatus(b.id, "cancelled")} disabled={!!actionLoading}
                                className="text-xs px-2.5 py-1.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 font-medium disabled:opacity-50 transition-all">
                                {actionLoading === b.id + "_cancelled" ? "..." : "✕"}
                              </button>
                            </>
                          )}
                          {b.status === "confirmed" && (
                            <button onClick={() => updateStatus(b.id, "done")} disabled={!!actionLoading}
                              className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 font-medium disabled:opacity-50 transition-all">
                              {actionLoading === b.id + "_done" ? "..." : "✅ დასრულება"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3 text-right">{filtered.length} ჩანაწერი</p>
    </AdminLayout>
  );
}
