"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AdminLayout from "@/components/AdminLayout";

export default function AdminStudentsPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("ადმინი");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, new: 0 });

  useEffect(() => { fetchStudents(); }, []);

  async function fetchStudents() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth"); return; }
    const { data: profile } = await supabase
      .from("profiles").select("role, full_name").eq("id", session.user.id).single();
    if (profile?.role !== "admin") { router.push("/dashboard"); return; }
    if (profile?.full_name) setAdminName(profile.full_name);

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (data) {
      const enriched = await Promise.all(
        data.map(async s => {
          const { count } = await supabase
            .from("bookings").select("*", { count:"exact", head:true }).eq("student_id", s.id);
          return { ...s, lessonCount: count || 0 };
        })
      );
      setStudents(enriched);
      const now = new Date();
      const thisMonth = enriched.filter(s => {
        const d = new Date(s.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      setStats({ total: enriched.length, active: enriched.filter(s => s.lessonCount > 0).length, new: thisMonth });
    }
    setLoading(false);
  }

  async function deleteStudent(id) {
    if (!confirm("დარწმუნებული ხართ? სტუდენტი წაიშლება.")) return;
    setActionLoading(id);
    const supabase = createClient();
    await supabase.from("profiles").delete().eq("id", id);
    setStudents(prev => prev.filter(s => s.id !== id));
    setStats(s => ({ ...s, total: s.total - 1 }));
    setActionLoading(null);
  }

  const filtered = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.full_name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
  });

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("ka-GE", { day:"numeric", month:"short", year:"numeric" });
  }

  return (
    <AdminLayout adminName={adminName}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">🎓 სტუდენტები</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "სულ სტუდენტი",   value: stats.total,  color: "text-gray-900" },
          { label: "აქტიური",         value: stats.active, color: "text-emerald-600" },
          { label: "ამ თვეს დაემატა", value: stats.new,    color: "text-blue-600" },
        ].map((s, i) => (
          <div key={i} className="stat-card p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white mb-5 focus-within:border-emerald-400 transition-colors">
        <span className="pl-4 flex items-center text-gray-400 text-sm">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="სახელი ან ელ. ფოსტა..."
          className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent" />
        {search && <button onClick={() => setSearch("")} className="px-3 text-gray-300 hover:text-gray-500">✕</button>}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16"><p className="text-3xl mb-3">🎓</p><p className="text-gray-400 text-sm">სტუდენტები ვერ მოიძებნა</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">სტუდენტი</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">ტელეფონი</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">გაკვეთილები</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">რეგ. თარიღი</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {s.full_name?.[0] || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{s.full_name || "—"}</p>
                          <p className="text-xs text-gray-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-sm">{s.phone || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-semibold ${s.lessonCount > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                        {s.lessonCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(s.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1.5 justify-end">
                        <Link href={`/messages?user=${s.id}`}
                          className="text-xs px-3 py-1.5 border border-gray-200 text-gray-500 rounded-xl hover:border-emerald-300 hover:text-emerald-600 transition-all">
                          💬 წერა
                        </Link>
                        <button onClick={() => deleteStudent(s.id)}
                          disabled={actionLoading === s.id}
                          className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 font-medium disabled:opacity-50 transition-all">
                          {actionLoading === s.id ? "..." : "წაშლა"}
                        </button>
                      </div>
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
