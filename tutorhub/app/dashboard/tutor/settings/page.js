"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

function passwordStrength(pwd) {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8)           score++;
  if (pwd.length >= 12)          score++;
  if (/[A-Z]/.test(pwd))         score++;
  if (/[0-9]/.test(pwd))         score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { label: "სუსტი",   color: "bg-red-500",     pct: 20 };
  if (score <= 2) return { label: "საშუალო", color: "bg-amber-500",   pct: 50 };
  if (score <= 3) return { label: "კარგი",   color: "bg-blue-500",    pct: 75 };
  return             { label: "ძლიერი",  color: "bg-emerald-500", pct: 100 };
}

function SectionAlert({ alert }) {
  if (!alert) return null;
  return (
    <div className={`text-sm px-4 py-3 rounded-xl mt-4 border ${
      alert.type === "success"
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-red-50 border-red-200 text-red-700"
    }`}>
      {alert.type === "success" ? "✅" : "❌"} {alert.msg}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-emerald-600" : "bg-gray-200"}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function TutorSettingsPage() {
  const router = useRouter();

  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [userId,  setUserId]    = useState(null);
  const [tutorName, setTutorName] = useState("");

  const [passwordAlert, setPasswordAlert] = useState(null);
  const [notifAlert,    setNotifAlert]    = useState(null);
  const [stripeStatus,  setStripeStatus]  = useState(null); // null | {connected, payoutsEnabled}
  const [stripeLoading, setStripeLoading] = useState(false);
  const [signOutModal,  setSignOutModal]  = useState(false);
  const [deleteModal,   setDeleteModal]   = useState(false);
  const [deleteText,    setDeleteText]    = useState("");
  const [deleting,      setDeleting]      = useState(false);
  const [deleteBlock,   setDeleteBlock]   = useState(null); // null | blocker object

  const [form, setForm] = useState({
    newPassword:           "",
    confirmPassword:       "",
    language:              "ka",
    notifications_email:   true,
    notifications_sms:     false,
    notifications_booking: true,
    notifications_payment: true,
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, notifications_email, notifications_sms, notifications_booking, notifications_payment")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "tutor") { router.push("/dashboard"); return; }

      const savedLang = typeof window !== "undefined"
        ? (localStorage.getItem("tutorhub_lang") || "ka")
        : "ka";

      setTutorName(profile?.full_name?.split(" ")[0] || "");
      setForm(f => ({
        ...f,
        notifications_email:   profile?.notifications_email   ?? true,
        notifications_sms:     profile?.notifications_sms     ?? false,
        notifications_booking: profile?.notifications_booking ?? true,
        notifications_payment: profile?.notifications_payment ?? true,
        language:              savedLang,
      }));
      setLoading(false);

      // Stripe Connect status
      fetch("/api/stripe/connect")
        .then(r => r.json())
        .then(d => setStripeStatus(d))
        .catch(() => {});
    }
    fetchData();
  }, []);

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordAlert(null);
    if (form.newPassword.length < 8) {
      setPasswordAlert({ type: "error", msg: "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს." });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setPasswordAlert({ type: "error", msg: "პაროლები არ ემთხვევა." });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: form.newPassword });
    if (error) {
      setPasswordAlert({ type: "error", msg: "პაროლის შეცვლა ვერ მოხერხდა." });
    } else {
      setPasswordAlert({ type: "success", msg: "პაროლი შეიცვალა!" });
      set("newPassword", ""); set("confirmPassword", "");
      setTimeout(() => setPasswordAlert(null), 3000);
    }
    setSaving(false);
  }

  async function handleSaveNotifications() {
    setNotifAlert(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      notifications_email:   form.notifications_email,
      notifications_sms:     form.notifications_sms,
      notifications_booking: form.notifications_booking,
      notifications_payment: form.notifications_payment,
    }).eq("id", userId);
    setNotifAlert(error
      ? { type: "error",   msg: "შენახვა ვერ მოხერხდა." }
      : { type: "success", msg: "შეტყობინებები შენახულია!" });
    setTimeout(() => setNotifAlert(null), 3000);
  }

  function handleLanguageChange(lang) {
    set("language", lang);
    if (typeof window !== "undefined") localStorage.setItem("tutorhub_lang", lang);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleDeleteAccount() {
    if (deleteText !== "DELETE") return;
    setDeleting(true);
    setDeleteBlock(null);
    try {
      const res  = await fetch("/api/user/delete-account", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.blocked) {
          setDeleteBlock(data);
          setDeleteText("");
        } else {
          setDeleteBlock({ error: data.error || "წაშლა ვერ მოხერხდა" });
        }
        setDeleting(false);
        return;
      }
      // Success — auth user deleted server-side, just redirect
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setDeleteBlock({ error: "კავშირის შეცდომა" });
      setDeleting(false);
    }
  }

  const strength = passwordStrength(form.newPassword);

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />

      <main className="p-6 md:p-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-black text-gray-900 mb-6">⚙️ პარამეტრები</h1>

          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                  <div className="h-10 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">

              {/* ─── Stripe Connect ─── */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-gray-900">🏦 გადახდების მიღება</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Stripe-ის ანგარიში — სადაც ჩაირიცხება შენი ჰონორარი</p>
                  </div>
                  {stripeStatus?.connected && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      stripeStatus.payoutsEnabled
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {stripeStatus.payoutsEnabled ? "✓ აქტიური" : "⏳ დასამთავრებელი"}
                    </span>
                  )}
                </div>

                {stripeStatus === null ? (
                  <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                ) : stripeStatus.connected && stripeStatus.payoutsEnabled ? (
                  <div className="space-y-3">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Stripe-ი დაკავშირებულია</p>
                        <p className="text-xs text-emerald-600 mt-0.5">ჯავშნების შემდეგ ჰონორარი ავტომატურად ჩაირიცხება</p>
                      </div>
                    </div>
                    <button
                      disabled={stripeLoading}
                      onClick={async () => {
                        setStripeLoading(true);
                        const r = await fetch("/api/stripe/connect", { method: "POST" });
                        const { url } = await r.json();
                        if (url) window.location.href = url;
                        setStripeLoading(false);
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700 underline">
                      {stripeLoading ? "მიმდინარეობს..." : "Stripe-ის პარამეტრების შეცვლა"}
                    </button>
                  </div>
                ) : stripeStatus.connected && !stripeStatus.payoutsEnabled ? (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">რეგისტრაცია დაუსრულებელია</p>
                        <p className="text-xs text-amber-600 mt-0.5">გააგრძელეთ Stripe-ის ონბორდინგი გადახდების მისაღებად</p>
                      </div>
                    </div>
                    <button
                      disabled={stripeLoading}
                      onClick={async () => {
                        setStripeLoading(true);
                        const r = await fetch("/api/stripe/connect", { method: "POST" });
                        const { url } = await r.json();
                        if (url) window.location.href = url;
                        setStripeLoading(false);
                      }}
                      className="btn-primary w-full py-3 text-sm">
                      {stripeLoading ? "მიმდინარეობს..." : "Stripe-ის ონბორდინგის გაგრძელება →"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        გამოიყენება <strong>Stripe Express</strong> — ულამაზესი ბანკის/ბარათის დამატების ფორმა,
                        სადაც Stripe პირდაპირ ჩარიცხავს ჰონორარს. საჭიროა პირადობის ვერიფიკაცია.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                        {["🔒 უსაფრთხო კავშირი", "🏦 ბანკის ანგარიში ან ბარათი", "⚡ სწრაფი ჩარიცხვა", "✅ ვერიფიკაცია Stripe-ით"].map(f => (
                          <div key={f} className="flex items-center gap-1.5">{f}</div>
                        ))}
                      </div>
                    </div>
                    <button
                      disabled={stripeLoading}
                      onClick={async () => {
                        setStripeLoading(true);
                        const r = await fetch("/api/stripe/connect", { method: "POST" });
                        const { url } = await r.json();
                        if (url) window.location.href = url;
                        setStripeLoading(false);
                      }}
                      className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                      {stripeLoading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> მიმდინარეობს...</>
                      ) : (
                        <><span>🔗</span> Stripe-ის ანგარიშის დაკავშირება</>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* ─── Password ─── */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-5">🔐 პაროლის შეცვლა</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="label">ახალი პაროლი</label>
                    <input type="password" className="input" value={form.newPassword}
                      onChange={e => set("newPassword", e.target.value)}
                      placeholder="მინ. 8 სიმბოლო" required />
                    {strength && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                            style={{ width: `${strength.pct}%` }} />
                        </div>
                        <p className={`text-xs mt-1 font-medium ${
                          strength.pct <= 20 ? "text-red-500" :
                          strength.pct <= 50 ? "text-amber-500" :
                          strength.pct <= 75 ? "text-blue-500" : "text-emerald-600"
                        }`}>{strength.label}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">დადასტურება</label>
                    <input type="password" className="input" value={form.confirmPassword}
                      onChange={e => set("confirmPassword", e.target.value)}
                      placeholder="გაიმეორეთ პაროლი" required />
                    {form.confirmPassword && (
                      <p className={`text-xs mt-1 font-medium ${
                        form.newPassword === form.confirmPassword ? "text-emerald-600" : "text-red-500"
                      }`}>
                        {form.newPassword === form.confirmPassword ? "✓ ემთხვევა" : "✗ არ ემთხვევა"}
                      </p>
                    )}
                  </div>
                  <button type="submit" disabled={saving || !form.newPassword || !form.confirmPassword}
                    className="btn-primary w-full py-3 disabled:opacity-40">
                    {saving ? "იცვლება..." : "პაროლის შეცვლა"}
                  </button>
                </form>
                <SectionAlert alert={passwordAlert} />
              </div>

              {/* ─── Notifications ─── */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-5">🔔 შეტყობინებები</h2>
                <div className="space-y-4 divide-y divide-gray-50">
                  {[
                    { key: "notifications_email",   label: "ელ. ფოსტა",   desc: "ყველა განახლება ფოსტაზე" },
                    { key: "notifications_sms",     label: "SMS",          desc: "მხოლოდ მნიშვნელოვანი" },
                    { key: "notifications_booking", label: "ჯავშნები",    desc: "დადასტ., გაუქმება, შეხსენება" },
                    { key: "notifications_payment", label: "გადახდები",   desc: "გადახდა, ვადა, ჰონორარი" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between pt-3 first:pt-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                      <Toggle value={form[key]} onChange={v => set(key, v)} />
                    </div>
                  ))}
                </div>
                <button type="button" onClick={handleSaveNotifications}
                  className="mt-5 btn-primary w-full py-2.5">
                  შენახვა
                </button>
                <SectionAlert alert={notifAlert} />
              </div>

              {/* ─── Language ─── */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">🌐 ინტერფეისის ენა</h2>
                <div className="flex gap-3">
                  {[
                    { key: "ka", label: "🇬🇪 ქართული" },
                    { key: "en", label: "🇬🇧 English" },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => handleLanguageChange(key)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        form.language === key
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-gray-200 text-gray-600 hover:border-emerald-300"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">ინახება ბრაუზერში</p>
              </div>

              {/* ─── Sign out ─── */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-1">🚪 გასვლა</h2>
                <p className="text-sm text-gray-400 mb-4">გამოსვლა ანგარიშიდან</p>
                <button onClick={() => setSignOutModal(true)}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">
                  გასვლა ანგარიშიდან →
                </button>
              </div>

              {/* ─── Danger zone ─── */}
              <div className="bg-white rounded-2xl p-6 border border-red-100 shadow-sm">
                <h2 className="font-bold text-red-600 mb-1">⚠️ საშიში ზონა</h2>
                <p className="text-sm text-gray-400 mb-4">
                  ანგარიშის წაშლა <strong>შეუქცევადია</strong>. ყველა გაკვეთილი და მონაცემი წაიშლება.
                </p>
                <button onClick={() => setDeleteModal(true)}
                  className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-all">
                  ანგარიშის წაშლა
                </button>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* Sign-out modal */}
      {signOutModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <p className="text-lg font-black text-gray-900 mb-1">ანგარიშიდან გასვლა</p>
            <p className="text-sm text-gray-400 mb-5">ნამდვილად გინდა გამოხვიდე?</p>
            <div className="flex gap-2">
              <button onClick={() => setSignOutModal(false)} className="flex-1 btn-secondary py-2.5">გაუქმება</button>
              <button onClick={handleSignOut}
                className="flex-1 bg-gray-800 hover:bg-gray-900 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors">
                გასვლა
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <p className="text-lg font-black text-red-600 mb-1">⚠️ ანგარიშის წაშლა</p>
            <p className="text-sm text-gray-500 mb-4">
              ეს მოქმედება <strong>შეუქცევადია</strong>. ყველა პერსონალური მონაცემი წაიშლება.
            </p>

            {/* Blocker messages */}
            {deleteBlock && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 space-y-2 text-sm text-red-700">
                {deleteBlock.error && <p>❌ {deleteBlock.error}</p>}

                {deleteBlock.pendingCount > 0 && (
                  <p>⏳ გაქვს <strong>{deleteBlock.pendingCount}</strong> დაუდასტურებელი ჯავშანი — ჯერ გააუქმე ან უარი თქვი ჯავშნებიდან.</p>
                )}

                {deleteBlock.confirmedCount > 0 && deleteBlock.lateCount === 0 && (
                  <p>📅 გაქვს <strong>{deleteBlock.confirmedCount}</strong> დადასტ. ჯავშანი — გააუქმე ჯავშნები (გაკვეთილამდე 24სთ+ — უფასო გაუქმება).</p>
                )}

                {deleteBlock.lateCount > 0 && (
                  <>
                    <p>⚠️ <strong>{deleteBlock.lateCount}</strong> ჯავშანი 24სთ-ში — გაუქმება ჯარიმის გარეშე შეუძლებელია.</p>
                    <p>💸 ჯარიმა: <strong>{deleteBlock.totalPenalty}₾</strong> | ბალანსი: <strong>{deleteBlock.walletBalance}₾</strong></p>
                    {deleteBlock.shortfall > 0 && (
                      <p className="font-semibold">🔴 ჯერ შეავსე ბალანსი <strong>{deleteBlock.shortfall}₾</strong>-ით, გაფარე ჯარიმა, შემდეგ შეეძლება წაშლა.</p>
                    )}
                  </>
                )}

                {deleteBlock.negativeWallet && (
                  <>
                    <p>💸 ბალანსი უარყოფითია: <strong>{deleteBlock.walletBalance}₾</strong></p>
                    <p className="font-semibold">🔴 შეავსე ბალანსი <strong>{deleteBlock.shortfall}₾</strong>-ით და შემდეგ შეეძლება წაშლა.</p>
                  </>
                )}

                <a href="/dashboard/tutor/bookings"
                  className="inline-block mt-1 text-xs text-red-600 underline font-semibold">
                  → ჯავშნების გვერდზე გადასვლა
                </a>
              </div>
            )}

            {/* Confirmation input — only show when no blocker */}
            {!deleteBlock && (
              <>
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                  <p className="text-xs text-red-600 font-medium">
                    დასადასტურებლად ჩაწერეთ: <span className="font-black font-mono">DELETE</span>
                  </p>
                </div>
                <input className="input mb-4 font-mono tracking-widest" value={deleteText}
                  onChange={e => setDeleteText(e.target.value)} placeholder="DELETE" />
              </>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setDeleteModal(false); setDeleteText(""); setDeleteBlock(null); }}
                className="flex-1 btn-secondary py-2.5">დახურვა</button>
              {!deleteBlock && (
                <button onClick={handleDeleteAccount}
                  disabled={deleteText !== "DELETE" || deleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40">
                  {deleting ? "იშლება..." : "წაშლა"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
