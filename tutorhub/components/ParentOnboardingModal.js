"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";

const GRADES = [
  "I კლასი","II კლასი","III კლასი","IV კლასი","V კლასი",
  "VI კლასი","VII კლასი","VIII კლასი","IX კლასი","X კლასი",
  "XI კლასი","XII კლასი","სტუდენტი",
];

const MAX_SHOWS = 3;

export default function ParentOnboardingModal() {
  const pathname   = usePathname();
  const checkedRef = useRef(new Set());

  const [show, setShow]     = useState(false);
  const [userId, setUserId] = useState(null);
  const [mode, setMode]     = useState("choose"); // choose | create | invite
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", grade: "I კლასი",
  });
  const [showPass, setShowPass]       = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  // pathname-ის ყოველ ცვლილებაზე შევამოწმოთ
  useEffect(() => {
    if (!pathname.startsWith("/dashboard/parent")) return;
    if (checkedRef.current.has(pathname)) return;
    checkedRef.current.add(pathname);
    checkAndMaybeShow();
  }, [pathname]);

  async function checkAndMaybeShow() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const uid = session.user.id;
    setUserId(uid);

    const key    = `parent_onboard_${uid}`;
    const stored = JSON.parse(localStorage.getItem(key) || '{"count":0,"done":false}');

    if (stored.done) return;
    if (stored.count >= MAX_SHOWS) return;

    // ვამოწმებთ არის თუ არა შვილი
    const { count } = await supabase
      .from("parent_children")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", uid);

    if (count > 0) {
      localStorage.setItem(key, JSON.stringify({ ...stored, done: true }));
      return;
    }

    // ვაჩვენებთ + ვიმახსოვრებთ
    localStorage.setItem(key, JSON.stringify({ ...stored, count: stored.count + 1 }));
    setMode("choose");
    setMsg({ type: "", text: "" });
    setShow(true);
  }

  function dismiss() {
    setShow(false);
    setMode("choose");
    setMsg({ type: "", text: "" });
  }

  function markDone() {
    if (!userId) return;
    const key = `parent_onboard_${userId}`;
    const stored = JSON.parse(localStorage.getItem(key) || '{"count":0,"done":false}');
    localStorage.setItem(key, JSON.stringify({ ...stored, done: true }));
  }

  // ── ახალი შვილი ──────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    const { firstName, lastName, email, password, phone, grade } = form;
    if (!firstName.trim() || !lastName.trim()) {
      setMsg({ type: "error", text: "სახელი და გვარი სავალდებულოა." }); return;
    }
    if (!email.trim()) {
      setMsg({ type: "error", text: "ელ. ფოსტა სავალდებულოა." }); return;
    }
    if (password.length < 8) {
      setMsg({ type: "error", text: "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს." }); return;
    }

    setSaving(true);
    setMsg({ type: "", text: "" });

    const res  = await fetch("/api/create-child", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ firstName, lastName, email, phone, password, grade }),
    });
    const json = await res.json();

    if (!res.ok) {
      setMsg({ type: "error", text: json.error || "სცადეთ ხელახლა" });
      setSaving(false);
      return;
    }

    markDone();
    setMsg({ type: "success", text: `✅ ${json.fullName}-ის ანგარიში შეიქმნა! მოსწავლის გვერდი ახალ ჩანართში გაიხსნება...` });
    setSaving(false);
    setTimeout(() => {
      window.open(`/auth?email=${encodeURIComponent(json.email)}`, "_blank");
      setShow(false);
      window.location.reload();
    }, 1800);
  }

  // ── მოწვევის გაგზავნა არსებული სტუდენტისთვის ──────────────────────────
  async function handleInvite(e) {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: "", text: "" });

    const res  = await fetch("/api/link-child", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: inviteEmail.trim() }),
    });
    const json = await res.json();

    if (!res.ok) {
      setMsg({ type: "error", text: json.error || "სცადეთ ხელახლა" });
      setSaving(false);
      return;
    }

    // არ ვნიშნავთ done-ად — შვილი ჯერ არ დაადასტურა
    setMsg({
      type: "success",
      text: `✅ მოწვევა გაიგზავნა ${json.studentName}-ს! მათი dashboard-ში გამოჩნდება შეტყობინება — მათი დადასტურების შემდეგ ავტომატურად დაუკავშირდება.`,
    });
    setSaving(false);
    setTimeout(() => dismiss(), 4000);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-[fadeInUp_0.2s_ease]">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-6 rounded-t-2xl text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">👶 შვილის ანგარიშის დამატება</h2>
              <p className="text-emerald-100 text-sm mt-1 leading-relaxed">
                შვილის ანგარიშის დამატების შემდეგ შეძლებ მათი გაკვეთილების,
                პროგრესისა და გადახდების კონტროლს ერთ ადგილიდან.
              </p>
            </div>
            <button onClick={dismiss}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center flex-shrink-0 transition-all">
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">

          {/* Alert */}
          {msg.text && (
            <div className={`text-sm px-4 py-3 rounded-xl mb-4 ${
              msg.type === "error"
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-emerald-50 border border-emerald-200 text-emerald-700"
            }`}>
              {msg.text}
            </div>
          )}

          {/* ── Choose mode ── */}
          {mode === "choose" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-500 mb-4">
                როგორ გსურს შვილის დამატება?
              </p>

              <button onClick={() => setMode("create")}
                className="w-full p-4 border-2 border-gray-100 hover:border-emerald-400 rounded-2xl text-left transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 group-hover:bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-all">
                    ✨
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">ახალი ანგარიშის შექმნა</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      შვილი ჯერ არ არის TutorHub-ზე — მე შევქმნი მის პროფილს
                    </p>
                  </div>
                  <span className="ml-auto text-gray-300 shrink-0">→</span>
                </div>
              </button>

              <button onClick={() => setMode("invite")}
                className="w-full p-4 border-2 border-gray-100 hover:border-blue-400 rounded-2xl text-left transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 group-hover:bg-blue-100 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-all">
                    🔗
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">უკვე სარგებლობს TutorHub-ით</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      შვილს უკვე აქვს ანგარიში — გაუგზავნე მოწვევა email-ით
                    </p>
                  </div>
                  <span className="ml-auto text-gray-300 shrink-0">→</span>
                </div>
              </button>

              <button onClick={dismiss}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-all text-center">
                მოგვიანებით დავამატებ
              </button>
            </div>
          )}

          {/* ── Create new child ── */}
          {mode === "create" && (
            <form onSubmit={handleCreate} className="space-y-3">
              <button type="button" onClick={() => setMode("choose")}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-1">
                ← უკან
              </button>

              {/* სახელი + გვარი */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">სახელი *</label>
                  <input className="input" placeholder="გიორგი" required
                    value={form.firstName}
                    onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="label">გვარი *</label>
                  <input className="input" placeholder="კვარაცხელია" required
                    value={form.lastName}
                    onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
                </div>
              </div>

              {/* ელ. ფოსტა */}
              <div>
                <label className="label">ელ. ფოსტა *</label>
                <input type="email" className="input" placeholder="giorgi@example.com" required
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>

              {/* ტელეფონი */}
              <div>
                <label className="label">
                  ტელეფონი <span className="text-gray-300 font-normal">(არასავ.)</span>
                </label>
                <input type="tel" className="input" placeholder="+995 5XX XXX XXX"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>

              {/* პაროლი */}
              <div>
                <label className="label">პაროლი *</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    className="input pr-10"
                    placeholder="მინ. 8 სიმბოლო"
                    required
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                  <button type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-1.5 flex gap-1">
                    {[1,2,3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                        form.password.length >= i * 4
                          ? i === 1 ? "bg-red-400" : i === 2 ? "bg-amber-400" : "bg-emerald-500"
                          : "bg-gray-200"
                      }`} />
                    ))}
                  </div>
                )}
              </div>

              {/* კლასი */}
              <div>
                <label className="label">კლასი / დონე</label>
                <select className="input" value={form.grade}
                  onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}>
                  {GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="btn-primary flex-1 py-2.5 disabled:opacity-50">
                  {saving ? "იქმნება..." : "ანგარიშის შექმნა →"}
                </button>
                <button type="button" onClick={() => setMode("choose")}
                  className="btn-secondary px-4 py-2.5">
                  უკან
                </button>
              </div>
            </form>
          )}

          {/* ── Invite existing student ── */}
          {mode === "invite" && (
            <form onSubmit={handleInvite} className="space-y-4">
              <button type="button" onClick={() => setMode("choose")}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
                ← უკან
              </button>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                📋 <strong>როგორ მუშაობს:</strong> შვილის email-ს შეიყვანთ → მათ dashboard-ში
                გამოჩნდება შეტყობინება → ის დაადასტურებს → ავტომატურად დაუკავშირდება.
              </div>

              <div>
                <label className="label">შვილის ელ. ფოსტა TutorHub-ზე</label>
                <input type="email" className="input" placeholder="child@example.com" required
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="btn-primary flex-1 py-2.5 disabled:opacity-50">
                  {saving ? "იგზავნება..." : "მოწვევის გაგზავნა →"}
                </button>
                <button type="button" onClick={() => setMode("choose")}
                  className="btn-secondary px-5 py-2.5">
                  უკან
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
