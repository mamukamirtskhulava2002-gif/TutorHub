"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const AVATAR_COLORS = ["avatar-blue","avatar-green","avatar-amber","avatar-purple","avatar-coral"];

const GRADES = [
  "I კლასი","II კლასი","III კლასი","IV კლასი","V კლასი",
  "VI კლასი","VII კლასი","VIII კლასი","IX კლასი","X კლასი",
  "XI კლასი","XII კლასი","სტუდენტი",
];

const TABS = [
  { key: "children",  label: "შვილები" },
  { key: "pending",   label: "მოლოდინში" },
];

export default function ChildrenPage() {
  const router = useRouter();

  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [tab, setTab]                 = useState("children");
  const [children, setChildren]       = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [parentId, setParentId]       = useState(null);
  const [parentName, setParentName]   = useState("მშობელი");
  const [mode, setMode]               = useState(null); // "create" | "invite"
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const [removeId, setRemoveId]       = useState(null);

  const [createForm, setCreateForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", grade: "I კლასი",
  });
  const [showCreatePass, setShowCreatePass] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setParentId(user.id);

      const { data: profile } = await supabase
        .from("profiles").select("full_name, role").eq("id", user.id).single();
      if (profile?.role !== "parent") { router.push("/dashboard"); return; }
      if (profile?.full_name) setParentName(profile.full_name.split(" ")[0]);

      await Promise.all([
        loadChildren(user.id, supabase),
        loadInvitations(user.id, supabase),
      ]);
      setLoading(false);
    }
    fetchData();
  }, []);

  async function loadChildren(pid, client) {
    const supabase = client || createClient();
    const { data } = await supabase
      .from("parent_children")
      .select(`id, profiles!child_id(id, full_name, email, student_level, preferred_subjects)`)
      .eq("parent_id", pid);
    setChildren(data || []);
  }

  async function loadInvitations(pid, client) {
    const supabase = client || createClient();
    const { data } = await supabase
      .from("parent_invitations")
      .select(`id, status, created_at, profiles!student_id(id, full_name, email, student_level)`)
      .eq("parent_id", pid)
      .order("created_at", { ascending: false });
    setInvitations(data || []);
  }

  // ── ახალი შვილის შექმნა ──────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    const { firstName, lastName, email, phone, password, grade } = createForm;
    if (!firstName.trim() || !lastName.trim()) {
      setError("სახელი და გვარი სავალდებულოა."); return;
    }
    if (!email.trim()) {
      setError("ელ. ფოსტა სავალდებულოა."); return;
    }
    if (password.length < 8) {
      setError("პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს."); return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const res  = await fetch("/api/create-child", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ firstName, lastName, email, phone, password, grade }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "სცადეთ ხელახლა");
      setSaving(false);
      return;
    }

    setSuccess(`✅ ${json.fullName}-ის ანგარიში შეიქმნა! მოსწავლის გვერდი ახალ ჩანართში გაიხსნება...`);
    setCreateForm({ firstName: "", lastName: "", email: "", phone: "", password: "", grade: "I კლასი" });
    setMode(null);
    await loadChildren(parentId);
    setSaving(false);
    window.open(`/auth?email=${encodeURIComponent(json.email)}`, "_blank");
  }

  // ── მოწვევის გაგზავნა არსებული სტუდენტისთვის ──────────────────────────
  async function handleInvite(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const res  = await fetch("/api/link-child", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: inviteEmail.trim() }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "სცადეთ ხელახლა");
      setSaving(false);
      return;
    }

    setSuccess(`✅ მოწვევა გაიგზავნა ${json.studentName}-ს! მათი დადასტურების შემდეგ ავტომატურად დაუკავშირდება.`);
    setInviteEmail("");
    setMode(null);
    setTab("pending");
    await loadInvitations(parentId);
    setSaving(false);
  }

  async function handleRemoveChild(linkId, name) {
    if (!confirm(`ნამდვილად გსურს ${name}-ის წაშლა?`)) return;
    setRemoveId(linkId);
    const supabase = createClient();
    await supabase.from("parent_children").delete().eq("id", linkId);
    setChildren(prev => prev.filter(c => c.id !== linkId));
    setRemoveId(null);
  }

  async function cancelInvitation(invId) {
    const supabase = createClient();
    await supabase.from("parent_invitations").delete().eq("id", invId);
    setInvitations(prev => prev.filter(i => i.id !== invId));
  }

  function setC(k, v) { setCreateForm(p => ({ ...p, [k]: v })); }

  const pendingCount = invitations.filter(i => i.status === "pending").length;

  function statusBadge(status) {
    if (status === "pending")  return <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">⏳ მოლოდინში</span>;
    if (status === "accepted") return <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">✅ მიღებულია</span>;
    return <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full">❌ უარყოფილია</span>;
  }

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="parent" userName={parentName} />

      <main className="p-6 md:p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">👶 ჩემი შვილები</h1>
            <p className="text-sm text-gray-400 mt-0.5">შვილების პროფილები და პროგრესი</p>
          </div>
          {!mode && (
            <div className="flex gap-2">
              <button onClick={() => { setMode("create"); setError(""); setSuccess(""); }}
                className="btn-primary text-sm px-4 py-2">
                + ახალი შვილი
              </button>
              <button onClick={() => { setMode("invite"); setError(""); setSuccess(""); }}
                className="btn-secondary text-sm px-4 py-2">
                ✉️ მოწვევა
              </button>
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">❌ {error}</div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-5">✅ {success}</div>
        )}

        {/* ── ახალი შვილი ── */}
        {mode === "create" && (
          <div className="card p-6 mb-6 border-2 border-emerald-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">👶 ახალი შვილის ანგარიში</h2>
                <p className="text-sm text-gray-400 mt-0.5">შეიყვანე შვილის ინფორმაცია</p>
              </div>
              <button onClick={() => { setMode(null); setError(""); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">სახელი *</label>
                  <input className="input" placeholder="გიორგი" required
                    value={createForm.firstName} onChange={e => setC("firstName", e.target.value)} />
                </div>
                <div>
                  <label className="label">გვარი *</label>
                  <input className="input" placeholder="კვარაცხელია" required
                    value={createForm.lastName} onChange={e => setC("lastName", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">ელ. ფოსტა *</label>
                <input type="email" className="input" placeholder="giorgi@example.com" required
                  value={createForm.email} onChange={e => setC("email", e.target.value)} />
              </div>
              <div>
                <label className="label">ტელეფონი <span className="text-gray-300 font-normal">(არასავ.)</span></label>
                <input type="tel" className="input" placeholder="+995 5XX XXX XXX"
                  value={createForm.phone} onChange={e => setC("phone", e.target.value)} />
              </div>
              <div>
                <label className="label">პაროლი *</label>
                <div className="relative">
                  <input
                    type={showCreatePass ? "text" : "password"}
                    className="input pr-10"
                    placeholder="მინ. 8 სიმბოლო"
                    required
                    value={createForm.password}
                    onChange={e => setC("password", e.target.value)} />
                  <button type="button"
                    onClick={() => setShowCreatePass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    {showCreatePass ? "🙈" : "👁️"}
                  </button>
                </div>
                {createForm.password && (
                  <div className="mt-1.5 flex gap-1">
                    {[1,2,3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                        createForm.password.length >= i * 4
                          ? i === 1 ? "bg-red-400" : i === 2 ? "bg-amber-400" : "bg-emerald-500"
                          : "bg-gray-200"
                      }`} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label">კლასი / დონე</label>
                <select className="input" value={createForm.grade} onChange={e => setC("grade", e.target.value)}>
                  {GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5">
                  {saving ? "იქმნება..." : "ანგარიშის შექმნა →"}
                </button>
                <button type="button" onClick={() => { setMode(null); setError(""); }} className="btn-secondary px-6 py-2.5">
                  გაუქმება
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── მოწვევა email-ით ── */}
        {mode === "invite" && (
          <div className="card p-6 mb-6 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-gray-900">✉️ მოწვევის გაგზავნა</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  სტუდენტი მიიღებს შეტყობინებას და დაადასტურებს კავშირს
                </p>
              </div>
              <button onClick={() => { setMode(null); setError(""); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-xs text-blue-700">
              📋 <strong>პროცესი:</strong> შვილის email → სტუდენტის dashboard-ში ჩნდება შეტყობინება → სტუდენტი ადასტურებს → ავტომატური კავშირი
            </div>
            <form onSubmit={handleInvite} className="flex gap-3">
              <input type="email" className="input flex-1" placeholder="child@example.com"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
              <button type="submit" disabled={saving} className="btn-primary px-6 flex-shrink-0">
                {saving ? "ეძებს..." : "გაგზავნა"}
              </button>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100 mb-5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-1.5 ${
                tab === t.key
                  ? "text-emerald-600 border-b-2 border-emerald-600 -mb-px"
                  : "text-gray-400 hover:text-gray-600"
              }`}>
              {t.label}
              {t.key === "pending" && pendingCount > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── შვილები ── */}
        {tab === "children" && (
          loading ? (
            <div className="space-y-4">
              {[1,2].map(i => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : children.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">👶</p>
              <p className="text-gray-600 font-semibold text-lg mb-1">შვილები ჯერ არ გყავს დამატებული</p>
              <p className="text-gray-400 text-sm mb-6">შექმენი მოსწავლის ანგარიში შვილისთვის ან თუ შვილი უკვე რეგისტრირებულია გაუგზავნე მოწვევა email-ით</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setMode("create")} className="btn-primary px-6 py-3">
                  + ახალი ანგარიში
                </button>
                <button onClick={() => setMode("invite")} className="btn-secondary px-6 py-3">
                  ✉️ მოწვევა
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {children.map((child, i) => {
                const profile  = child.profiles;
                const name     = profile?.full_name || "სტუდენტი";
                const initials = name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
                const color    = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const subjects = profile?.preferred_subjects || [];

                return (
                  <div key={child.id} className="card p-5">
                    <div className="flex items-center gap-4">
                      <div className={`avatar w-12 h-12 text-base flex-shrink-0 ${color}`}>{initials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900">{name}</p>
                          {profile?.student_level && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              {profile.student_level}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5">{profile?.email}</p>
                        {subjects.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1.5">
                            {subjects.slice(0,4).map(s => (
                              <span key={s} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                        <Link href={`/dashboard/parent/lessons?child=${profile?.id}`}
                          className="text-sm px-3 py-2 border border-gray-200 text-gray-600 rounded-xl hover:border-emerald-300 hover:text-emerald-600 transition-all font-medium">
                          📅 გაკვეთილები
                        </Link>
                        <Link href="/search" className="btn-primary text-sm px-3 py-2">+ მასწ.</Link>
                        <button
                          onClick={() => handleRemoveChild(child.id, name)}
                          disabled={removeId === child.id}
                          className="text-sm px-3 py-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="წაშლა">
                          {removeId === child.id ? "..." : "✕"}
                        </button>
                      </div>
                    </div>
                    <ChildStats childId={profile?.id} />
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── მოწვევები ── */}
        {tab === "pending" && (
          invitations.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-3">✉️</p>
              <p className="text-gray-500 font-medium">გაგზავნილი მოწვევები არ არის</p>
              <p className="text-gray-400 text-sm mt-1 mb-5">
                "მოწვევა" ღილაკით გაგზავნე შვილს
              </p>
              <button onClick={() => { setMode("invite"); setTab("children"); }}
                className="btn-primary px-6 py-2.5">
                ✉️ მოწვევის გაგზავნა
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map(inv => {
                const student = inv.profiles;
                const name    = student?.full_name || "სტუდენტი";
                const initials = name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();

                return (
                  <div key={inv.id} className="card p-5">
                    <div className="flex items-center gap-4">
                      <div className="avatar w-11 h-11 text-sm avatar-blue flex-shrink-0">{initials}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{name}</p>
                        <p className="text-sm text-gray-400">{student?.email}</p>
                        {student?.student_level && (
                          <span className="text-xs text-gray-400">{student.student_level}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {statusBadge(inv.status)}
                        {inv.status === "pending" && (
                          <button onClick={() => cancelInvitation(inv.id)}
                            className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl transition-all">
                            გაუქმება
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 mt-2 pl-15">
                      გაიგზავნა {new Date(inv.created_at).toLocaleDateString("ka-GE")}
                    </p>
                  </div>
                );
              })}
            </div>
          )
        )}

      </main>
    </div>
  );
}

function ChildStats({ childId }) {
  const [stats, setStats]       = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!childId) return;
    async function fetchStats() {
      const supabase = createClient();
      const [
        { count: total },
        { count: upcoming },
        { data: tutorIds },
        { data: lastFeedback },
      ] = await Promise.all([
        supabase.from("bookings").select("*", { count: "exact", head: true })
          .eq("student_id", childId).eq("status", "done"),
        supabase.from("bookings").select("*", { count: "exact", head: true })
          .eq("student_id", childId).in("status", ["confirmed","pending"]),
        supabase.from("bookings").select("tutor_id")
          .eq("student_id", childId).eq("status", "confirmed"),
        supabase.from("lesson_feedback")
          .select("feedback_text, rating, created_at, profiles!tutor_id(full_name)")
          .eq("student_id", childId)
          .order("created_at", { ascending: false }).limit(1),
      ]);

      const tutors = new Set(tutorIds?.map(t => t.tutor_id)).size;
      setStats({ total: total || 0, upcoming: upcoming || 0, tutors });
      if (lastFeedback?.[0]) setFeedback(lastFeedback[0]);
    }
    fetchStats();
  }, [childId]);

  if (!stats) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex gap-6 mb-3">
        {[
          { label: "ჩატარდა",      value: stats.total,    icon: "📚" },
          { label: "მომავალი",     value: stats.upcoming, icon: "📅" },
          { label: "მასწ. რაოდ.", value: stats.tutors,   icon: "👨‍🏫" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span>{s.icon}</span>
            <div>
              <p className="text-sm font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      {feedback && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-blue-700">
              📝 {feedback["profiles!tutor_id"]?.full_name || "მასწავლებელი"}
            </span>
            <div className="flex gap-0.5">
              {Array.from({length:5}).map((_,i) => (
                <span key={i} className={`text-xs ${i < (feedback.rating||0) ? "text-amber-400" : "text-gray-300"}`}>★</span>
              ))}
            </div>
          </div>
          <p className="text-gray-700">{feedback.feedback_text}</p>
        </div>
      )}
    </div>
  );
}
