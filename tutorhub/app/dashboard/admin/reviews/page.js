"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AdminLayout from "@/components/AdminLayout";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ka-GE", { day:"numeric", month:"short", year:"numeric" });
}
function Stars({ rating }) {
  return (
    <div className="flex">
      {Array(5).fill(0).map((_, i) => (
        <span key={i} className={i < rating ? "text-amber-400" : "text-gray-200"}>★</span>
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("ადმინი");
  const [reviews, setReviews]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("all");
  const [search, setSearch]             = useState("");
  const [starFilter, setStarFilter]     = useState("all");
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast]               = useState(null);
  const [stats, setStats]               = useState({ total:0, avgRating:0, reported:0, pendingAppeals:0 });

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => { fetchReviews(); }, []);

  async function fetchReviews() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth"); return; }
    const { data: profile } = await supabase
      .from("profiles").select("role, full_name").eq("id", session.user.id).single();
    if (profile?.role !== "admin") { router.push("/dashboard"); return; }
    if (profile?.full_name) setAdminName(profile.full_name);

    const { data } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, is_reported, report_reason, tutor_reply, is_appealed, appeal_reason, appeal_status, hidden, profiles!student_id(full_name), tutors!tutor_id(profiles(full_name), subject)")
      .order("created_at", { ascending: false });

    if (data) {
      setReviews(data);
      const visible = data.filter(r => !r.hidden);
      setStats({
        total:          data.length,
        avgRating:      visible.length > 0
          ? Math.round((visible.reduce((s, r) => s + r.rating, 0) / visible.length) * 10) / 10
          : 0,
        reported:       data.filter(r => r.is_reported).length,
        pendingAppeals: data.filter(r => r.is_appealed && r.appeal_status === "pending").length,
      });
    }
    setLoading(false);
  }

  async function deleteReview(id) {
    setActionLoading(id + "_del");
    const supabase = createClient();
    await supabase.from("reviews").delete().eq("id", id);
    setReviews(prev => prev.filter(r => r.id !== id));
    showToast("შეფასება წაიშალა", "error");
    setActionLoading(null);
  }

  async function hideReview(id) {
    setActionLoading(id + "_hide");
    await createClient().from("reviews").update({ hidden: true }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, hidden: true } : r));
    showToast("შეფასება დაიმალა");
    setActionLoading(null);
  }

  async function unhideReview(id) {
    setActionLoading(id + "_unhide");
    await createClient().from("reviews").update({ hidden: false }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, hidden: false } : r));
    showToast("შეფასება გამოჩნდა");
    setActionLoading(null);
  }

  async function clearReport(id) {
    setActionLoading(id + "_clr");
    await createClient().from("reviews").update({ is_reported: false, report_reason: null }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, is_reported: false } : r));
    setStats(s => ({ ...s, reported: Math.max(0, s.reported - 1) }));
    showToast("შეტყობინება გასუფთავდა");
    setActionLoading(null);
  }

  async function approveAppeal(id) {
    setActionLoading(id + "_apv");
    await createClient().from("reviews").update({ appeal_status:"approved", hidden:true }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, appeal_status:"approved", hidden:true } : r));
    setStats(s => ({ ...s, pendingAppeals: Math.max(0, s.pendingAppeals - 1) }));
    showToast("გასაჩივრება დაკმაყოფილდა — შეფასება დაიმალა!");
    setActionLoading(null);
  }

  async function rejectAppeal(id) {
    setActionLoading(id + "_rjt");
    await createClient().from("reviews").update({ appeal_status:"rejected" }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, appeal_status:"rejected" } : r));
    setStats(s => ({ ...s, pendingAppeals: Math.max(0, s.pendingAppeals - 1) }));
    showToast("გასაჩივრება უარყოფილია", "error");
    setActionLoading(null);
  }

  const filtered = reviews
    .filter(r => {
      if (tab === "reported") return r.is_reported;
      if (tab === "appeals")  return r.is_appealed && r.appeal_status === "pending";
      if (tab === "hidden")   return r.hidden;
      return !r.hidden;
    })
    .filter(r => {
      if (starFilter === "low") return r.rating <= 2;
      if (starFilter !== "all") return r.rating === parseInt(starFilter);
      return true;
    })
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (r.profiles?.full_name || "").toLowerCase().includes(q) ||
             (r.tutors?.profiles?.full_name || "").toLowerCase().includes(q) ||
             (r.comment || "").toLowerCase().includes(q);
    });

  const TABS = [
    { key: "all",      label: "ყველა",       badge: null },
    { key: "reported", label: "🚩 შეტყობ.",   badge: stats.reported },
    { key: "appeals",  label: "⚖️ გასაჩივ.",  badge: stats.pendingAppeals },
    { key: "hidden",   label: "🙈 დამალ.",    badge: reviews.filter(r => r.hidden).length },
  ];

  return (
    <AdminLayout adminName={adminName}>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-5 py-3 rounded-2xl shadow-lg border font-medium ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.msg}
        </div>
      )}

      <h1 className="text-2xl font-black text-gray-900 mb-6">⭐ შეფასებების მართვა</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "სულ შეფასება",     value: stats.total,              color: "text-gray-900" },
          { label: "საშ. რეიტინგი",    value: `⭐ ${stats.avgRating}`,   color: "text-amber-600" },
          { label: "🚩 შეტყობინებული", value: stats.reported,           color: "text-red-500" },
          { label: "⚖️ განსახილველი",   value: stats.pendingAppeals,     color: stats.pendingAppeals > 0 ? "text-amber-600" : "text-gray-400" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
            {t.badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {t.badge > 9 ? "9+" : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 სტუდენტი, მასწ., კომენტ..."
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 flex-1 min-w-[200px] bg-white" />
        <div className="flex gap-1 flex-wrap">
          {[["all","ყველა"],["5","⭐×5"],["4","⭐×4"],["3","⭐×3"],["low","⭐×1-2"]].map(([k, l]) => (
            <button key={k} onClick={() => setStarFilter(k)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                starFilter === k ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-500 hover:border-emerald-300"
              }`}>{l}</button>
          ))}
        </div>
      </div>

      {tab === "appeals" && stats.pendingAppeals > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 mb-5 text-sm text-amber-800 font-medium">
          ⚖️ {stats.pendingAppeals} გასაჩივრება განხილვას ელოდება
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-200 rounded w-full mb-2" />
            <div className="h-3 bg-gray-200 rounded w-4/5" />
          </div>
        ))}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">⭐</p>
          <p className="text-gray-400 text-sm">
            {tab === "appeals" ? "განსახილველი გასაჩივრება არ არის" :
             tab === "reported" ? "შეტყობინებული შეფასება არ არის" :
             "შეფასებები ვერ მოიძებნა"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(r => {
            const al = actionLoading;
            const isPending = r.appeal_status === "pending";
            return (
              <div key={r.id} className={`bg-white rounded-2xl border p-5 shadow-sm ${
                isPending ? "border-amber-300 bg-amber-50/20" :
                r.is_reported ? "border-red-200 bg-red-50/20" :
                r.hidden ? "border-gray-200 opacity-60" : "border-gray-100"
              }`}>
                <div className="flex items-start gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {r.profiles?.full_name?.[0] || "?"}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{r.profiles?.full_name || "სტ."}</span>
                    <span className="text-gray-300 text-sm">→</span>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {r.tutors?.profiles?.full_name?.[0] || "?"}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{r.tutors?.profiles?.full_name || "მასწ."}</span>
                    {r.tutors?.subject?.[0] && <span className="text-xs text-gray-400">· {r.tutors.subject[0]}</span>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    {r.is_reported && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">🚩 შეტყობ.</span>}
                    {r.hidden      && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">🙈 დამ.</span>}
                    {r.is_appealed && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.appeal_status === "pending"  ? "bg-amber-100 text-amber-700" :
                        r.appeal_status === "approved" ? "bg-emerald-100 text-emerald-700" :
                        "bg-red-100 text-red-600"
                      }`}>
                        ⚖️ {r.appeal_status === "pending" ? "განხილვაში" : r.appeal_status === "approved" ? "დაკმ." : "უარყ."}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Stars rating={r.rating} />
                  <span className="text-sm font-bold text-gray-700">{r.rating}/5</span>
                  <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                </div>

                {r.comment && (
                  <p className="text-sm text-gray-600 bg-gray-50 px-4 py-3 rounded-xl mb-3 leading-relaxed">"{r.comment}"</p>
                )}
                {r.tutor_reply && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 mb-3">
                    <p className="text-xs text-emerald-600 font-medium mb-0.5">↩ მასწ. პასუხი</p>
                    <p className="text-sm text-gray-700">{r.tutor_reply}</p>
                  </div>
                )}

                {r.is_appealed && r.appeal_reason && (
                  <div className={`rounded-xl px-4 py-3 mb-3 ${isPending ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-100"}`}>
                    <p className="text-xs font-semibold text-gray-600 mb-1">⚖️ გასაჩივრების მიზეზი:</p>
                    <p className="text-sm text-gray-700">{r.appeal_reason}</p>
                    {isPending && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => approveAppeal(r.id)} disabled={!!al}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                          {al === r.id + "_apv" ? "..." : "✅ დაკმაყოფილება"}
                        </button>
                        <button onClick={() => rejectAppeal(r.id)} disabled={!!al}
                          className="flex-1 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors">
                          {al === r.id + "_rjt" ? "..." : "❌ უარყოფა"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {r.is_reported && r.report_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-3 text-xs text-red-700">
                    <span className="font-semibold">🚩 შეტყობ. მიზეზი: </span>{r.report_reason}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap mt-1">
                  {r.is_reported && (
                    <button onClick={() => clearReport(r.id)} disabled={!!al}
                      className="text-xs px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-medium disabled:opacity-50 transition-all">
                      {al === r.id + "_clr" ? "..." : "🚩 გასუფთ."}
                    </button>
                  )}
                  {!r.hidden ? (
                    <button onClick={() => hideReview(r.id)} disabled={!!al}
                      className="text-xs px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 font-medium disabled:opacity-50 transition-all">
                      {al === r.id + "_hide" ? "..." : "🙈 დამალვა"}
                    </button>
                  ) : (
                    <button onClick={() => unhideReview(r.id)} disabled={!!al}
                      className="text-xs px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-medium disabled:opacity-50 transition-all">
                      {al === r.id + "_unhide" ? "..." : "👁 გამოჩენა"}
                    </button>
                  )}
                  <button onClick={() => deleteReview(r.id)} disabled={!!al}
                    className="text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 font-medium disabled:opacity-50 transition-all">
                    {al === r.id + "_del" ? "..." : "🗑 წაშლა"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-4 text-right">{filtered.length} ჩანაწერი</p>
    </AdminLayout>
  );
}
