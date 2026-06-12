"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AdminLayout from "@/components/AdminLayout";

const DOC_TYPE_LABELS = {
  degree:      "📜 განათლება",
  certificate: "🏅 სერტ.",
  experience:  "💼 გამოცდ.",
  other:       "📎 სხვა",
};

export default function AdminTutorsPage() {
  const router = useRouter();
  const [adminName, setAdminName]   = useState("ადმინი");
  const [tutors, setTutors]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("all");
  const [mainTab, setMainTab]       = useState("tutors");
  const [actionLoading, setActionLoading] = useState(null);
  const [reviewNotes, setReviewNotes]     = useState({});
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0 });

  useEffect(() => { fetchTutors(); }, []);

  async function fetchTutors() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth"); return; }
    const { data: profile } = await supabase
      .from("profiles").select("role, full_name").eq("id", session.user.id).single();
    if (profile?.role !== "admin") { router.push("/dashboard"); return; }
    if (profile?.full_name) setAdminName(profile.full_name);

    const { data, error: fetchErr } = await supabase
      .from("tutors")
      .select(`id, price_per_hour, rating, review_count, is_verified, subject,
               experience_years, city,
               tier, license_status, has_certificate, cert_file_url,
               license_submitted_at, license_notes,
               profiles(full_name, email, created_at)`)
      .order("created_at", { ascending: false, foreignTable: "profiles" });

    if (fetchErr) console.error("Admin tutors fetch error:", fetchErr.message);

    if (data) {
      setTutors(data);
      setStats({
        total:    data.length,
        verified: data.filter(t => t.is_verified).length,
        pending:  data.filter(t => !t.is_verified).length,
      });
    }
    setLoading(false);
  }

  async function approveTutor(id) {
    setActionLoading(id + "_approve");
    const supabase = createClient();
    await supabase.from("tutors").update({ is_verified: true }).eq("id", id);
    setTutors(prev => prev.map(t => t.id === id ? { ...t, is_verified: true } : t));
    setStats(s => ({ ...s, verified: s.verified + 1, pending: Math.max(0, s.pending - 1) }));
    setActionLoading(null);
  }

  async function rejectTutor(id) {
    if (!confirm("დარწმუნებული ხართ? მასწავლებელი წაიშლება.")) return;
    setActionLoading(id + "_reject");
    const supabase = createClient();
    await supabase.from("tutors").delete().eq("id", id);
    setTutors(prev => prev.filter(t => t.id !== id));
    setStats(s => ({ ...s, total: s.total - 1, pending: Math.max(0, s.pending - 1) }));
    setActionLoading(null);
  }

  async function reviewLicense(tutorId, action) {
    setActionLoading(tutorId + "_lic_" + action);
    const notes = reviewNotes[tutorId] || "";
    const res = await fetch("/api/admin/review-license", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ tutorId, action, notes }),
    });
    if (res.ok) {
      setTutors(prev => prev.map(t => {
        if (t.id !== tutorId) return t;
        return action === "approve"
          ? { ...t, tier: t.has_certificate ? "certified" : "expert", license_status: "approved", is_verified: true }
          : { ...t, license_status: "rejected" };
      }));
    }
    setActionLoading(null);
  }

  const filtered = tutors
    .filter(t => filter === "verified" ? t.is_verified : filter === "pending" ? !t.is_verified : true)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (t.profiles?.full_name || "").toLowerCase().includes(q) ||
             (t.profiles?.email || "").toLowerCase().includes(q) ||
             (t.subject || []).join(" ").toLowerCase().includes(q);
    });

  const licensePending = tutors.filter(t => t.license_status === "pending");

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ka-GE", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <AdminLayout adminName={adminName}>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">👨‍🏫 მასწავლებლები</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button onClick={() => setMainTab("tutors")}
          className={`px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
            mainTab === "tutors"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          👨‍🏫 სია
        </button>
        <button onClick={() => setMainTab("license")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
            mainTab === "license"
              ? "border-amber-500 text-amber-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          📋 ლიცენზია
          {licensePending.length > 0 && (
            <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {licensePending.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TUTORS TAB ── */}
      {mainTab === "tutors" && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "სულ",             value: stats.total,    color: "text-gray-900" },
              { label: "ვერიფიცირებული", value: stats.verified, color: "text-emerald-600" },
              { label: "მოლოდინში",       value: stats.pending,  color: "text-amber-600" },
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
                placeholder="სახელი, ელ. ფოსტა, საგანი..."
                className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent" />
              {search && <button onClick={() => setSearch("")} className="px-3 text-gray-300 hover:text-gray-500">✕</button>}
            </div>
            <div className="flex gap-1.5">
              {[["all","ყველა"],["verified","✓ ვერიფ."],["pending","⏳ მოლოდ."]].map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    filter === k ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-500 hover:border-emerald-300"
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16"><p className="text-3xl mb-3">👨‍🏫</p><p className="text-gray-400 text-sm">მასწავლებლები ვერ მოიძებნა</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">მასწავლებელი</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">საგნები</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">ფასი</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">რეიტინგი</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">სტატუსი</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">თარიღი</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(tutor => (
                      <tr key={tutor.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              tutor.tier === "certified"
                                ? "bg-amber-100 text-amber-700 ring-2 ring-amber-400"
                                : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {tutor.profiles?.full_name?.[0] || "?"}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                                {tutor.profiles?.full_name || "—"}
                                {tutor.tier === "certified" && (
                                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">👑</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400">{tutor.profiles?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {(tutor.subject || []).slice(0, 2).map(s => (
                              <span key={s} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{s}</span>
                            ))}
                            {(tutor.subject || []).length > 2 && (
                              <span className="text-xs text-gray-400">+{tutor.subject.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-gray-900">{tutor.price_per_hour} ₾</td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1 text-sm">
                            ⭐ <span className="font-semibold">{tutor.rating ?? "—"}</span>
                            <span className="text-gray-400 text-xs">({tutor.review_count ?? 0})</span>
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            tutor.is_verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {tutor.is_verified ? "✓ ვერიფ." : "⏳ მოლოდ."}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(tutor.profiles?.created_at)}</td>
                        <td className="px-5 py-4">
                          <div className="flex gap-1.5 justify-end">
                            {!tutor.is_verified && tutor.license_status === "pending" ? (
                              <button onClick={() => setMainTab("license")}
                                className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-medium transition-all">
                                📋 დოკ. →
                              </button>
                            ) : !tutor.is_verified ? (
                              <button onClick={() => approveTutor(tutor.id)}
                                disabled={actionLoading === tutor.id + "_approve"}
                                className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium disabled:opacity-50 transition-all">
                                {actionLoading === tutor.id + "_approve" ? "..." : "✓ დადასტ."}
                              </button>
                            ) : null}
                            <button onClick={() => rejectTutor(tutor.id)}
                              disabled={actionLoading === tutor.id + "_reject"}
                              className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 font-medium disabled:opacity-50 transition-all">
                              {actionLoading === tutor.id + "_reject" ? "..." : "წაშლა"}
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
        </>
      )}

      {/* ── LICENSE TAB ── */}
      {mainTab === "license" && (
        <>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
          ) : licensePending.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">📋</p>
              <p className="font-bold text-gray-700 text-lg">განხილვის მოლოდინში არ არის</p>
              <p className="text-sm text-gray-400 mt-1">სერტიფიკაციის ახალი განაცხადი გამოჩნდება აქ</p>
            </div>
          ) : (
            <div className="space-y-5">
              {licensePending.map(tutor => (
                <div key={tutor.id} className="card p-5 border-2 border-amber-100">

                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">
                        {tutor.profiles?.full_name?.[0] || "?"}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{tutor.profiles?.full_name || "—"}</p>
                        <p className="text-xs text-gray-400">{tutor.profiles?.email}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      <p>განაცხადი: {formatDate(tutor.license_submitted_at)}</p>
                      <p className="mt-0.5">⭐ {tutor.rating ?? "—"} ({tutor.review_count ?? 0} შეფ.)</p>
                    </div>
                  </div>

                  {/* Claim + file */}
                  <div className="mb-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        tutor.has_certificate
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {tutor.has_certificate ? "👑 სერტიფიკატი" : "🎓 სტუდ. / დიპლომი"}
                      </span>
                      <span className="text-xs text-gray-400">
                        → მოელის {tutor.has_certificate ? "Certified Tutor" : "Subject Expert"} სტატუსს
                      </span>
                    </div>
                    {tutor.cert_file_url ? (
                      <div className="space-y-2">
                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(tutor.cert_file_url) ? (
                          <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                            <img
                              src={tutor.cert_file_url}
                              alt="სერტიფიკატი"
                              className="w-full max-h-64 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                            <span className="text-4xl">📄</span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-amber-800">PDF დოკუმენტი</p>
                              <p className="text-xs text-amber-600 truncate">
                                {tutor.cert_file_url.split("/").pop()?.split("?")[0] || "ფაილი"}
                              </p>
                            </div>
                          </div>
                        )}
                        <a href={tutor.cert_file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl px-4 py-2.5 transition-all w-full">
                          <span>↗</span>
                          <span>{/\.(jpg|jpeg|png|gif|webp)$/i.test(tutor.cert_file_url) ? "სრულ ზომაში ნახვა" : "PDF-ის ნახვა / ჩამოტვირთვა"}</span>
                        </a>
                      </div>
                    ) : (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>ფაილი ჯერ არ არის ატვირთული</span>
                      </div>
                    )}
                  </div>

                  {/* Notes + actions */}
                  <div className="flex flex-col gap-3 pt-3 border-t border-gray-100">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">შენიშვნა / უარყოფის მიზეზი (არასავ.)</label>
                      <input
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-amber-400 bg-white"
                        placeholder="მაგ: ვერ ვადასტურებთ — დოკუმენტი ვადაგასულია"
                        value={reviewNotes[tutor.id] || ""}
                        onChange={e => setReviewNotes(n => ({ ...n, [tutor.id]: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewLicense(tutor.id, "approve")}
                        disabled={!!actionLoading}
                        className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition-all">
                        {actionLoading === tutor.id + "_lic_approve"
                          ? "..."
                          : tutor.has_certificate
                            ? "👑 Certified Tutor-ად დამტკიცება"
                            : "✓ Subject Expert-ად დამტკიცება"
                        }
                      </button>
                      <button
                        onClick={() => reviewLicense(tutor.id, "reject")}
                        disabled={!!actionLoading}
                        className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm rounded-xl disabled:opacity-50 transition-all">
                        {actionLoading === tutor.id + "_lic_reject" ? "..." : "❌ უარყოფა"}
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </>
      )}

    </AdminLayout>
  );
}
