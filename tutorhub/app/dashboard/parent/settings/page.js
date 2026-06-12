"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
// შიგნით:
<DashboardSidebar role="student" userName="ანა გელაშვილი" />
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";

const NAV_ITEMS = [
  { icon: "📊", label: "მთავარი",       href: "/dashboard/parent" },
  { icon: "👶", label: "ჩემი შვილები",  href: "/dashboard/parent/children" },
  { icon: "📅", label: "გაკვეთილები",   href: "/dashboard/parent/lessons" },
  { icon: "💬", label: "შეტყობინებები", href: "/dashboard/parent/messages" },
  { icon: "💳", label: "გადახდები",     href: "/dashboard/parent/payments" },
  { icon: "⚙️", label: "პარამეტრები",  href: "/dashboard/parent/settings" },
];

export default function ParentSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [parentName, setParentName] = useState("მშობელი");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    newPassword: "",
    confirmPassword: "",
    notifications_email: true,
    notifications_sms: false,
    language: "ka",
  });

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, birth_date, role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "parent") { router.push("/dashboard"); return; }

      const name = profile?.full_name || "";
      setParentName(name.split(" ")[0]);

      setForm(f => ({
        ...f,
        full_name:  name,
        email:      user.email || "",
        phone:      profile?.phone || "",
        birth_date: profile?.birth_date || "",
      }));

      setLoading(false);
    }
    fetchData();
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError(""); setSuccess("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: err } = await supabase
      .from("profiles")
      .update({ full_name: form.full_name, phone: form.phone, birth_date: form.birth_date || null })
      .eq("id", user.id);

    if (err) {
      setError("შეცდომა. სცადეთ ხელახლა.");
    } else {
      setParentName(form.full_name.split(" ")[0]);
      setSuccess("პროფილი წარმატებით განახლდა!");
      setTimeout(() => setSuccess(""), 3000);
    }
    setSaving(false);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (form.newPassword.length < 8) {
      setError("პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("პაროლები არ ემთხვევა.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password: form.newPassword });

    if (err) {
      setError("პაროლის შეცვლა ვერ მოხერხდა.");
    } else {
      setSuccess("პაროლი წარმატებით შეიცვალა!");
      set("newPassword", "");
      set("confirmPassword", "");
      setTimeout(() => setSuccess(""), 3000);
    }
    setSaving(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">

      {/* Sidebar */}
      <aside className="hidden md:flex bg-white border-r border-gray-100 flex-col py-6">
        <Link href="/" className="text-lg font-black px-6 mb-6 block">
          Tutor<span className="text-emerald-600">Hub</span>
        </Link>
        <div className="flex items-center gap-3 px-4 py-3 mx-3 mb-4 bg-gray-50 rounded-2xl">
          <div className="avatar w-10 h-10 avatar-blue text-sm">
            {parentName.slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold">{parentName}</p>
            <p className="text-xs text-blue-500 font-medium">👨‍👩‍👧 მშობელი</p>
          </div>
        </div>
        <nav className="space-y-0.5 flex-1">
          {NAV_ITEMS.map(({ icon, label, href }) => (
            <Link key={href} href={href}
              className={pathname === href ? "sidebar-item-active" : "sidebar-item"}>
              <span>{icon}</span> {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-100 pt-3 mt-3">
          <button onClick={handleSignOut} className="sidebar-item text-red-400 w-full text-left">
            🚪 გასვლა
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="p-6 md:p-8">
        <h1 className="text-2xl font-black text-gray-900 mb-6">⚙️ პარამეტრები</h1>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
            ❌ {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-5">
            ✅ {success}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                <div className="h-10 bg-gray-200 rounded mb-3" />
                <div className="h-10 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">

            {/* პირადი ინფო */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">👤 პირადი ინფორმაცია</h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">სახელი და გვარი</label>
                    <input
                      className="input"
                      value={form.full_name}
                      onChange={e => set("full_name", e.target.value)}
                      placeholder="მარიამ გელაშვილი"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">ტელეფონი</label>
                    <input
                      className="input"
                      value={form.phone}
                      onChange={e => set("phone", e.target.value)}
                      placeholder="+995 5XX XXX XXX"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">ელ. ფოსტა</label>
                    <input
                      className="input bg-gray-50 cursor-not-allowed"
                      value={form.email}
                      disabled
                    />
                    <p className="text-xs text-gray-400 mt-1">ელ. ფოსტის შეცვლა შეუძლებელია</p>
                  </div>
                  <div>
                    <label className="label">დაბადების თარიღი *</label>
                    <input
                      type="date"
                      className="input"
                      value={form.birth_date}
                      onChange={e => set("birth_date", e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full py-3"
                >
                  {saving ? "ინახება..." : "ცვლილებების შენახვა"}
                </button>
              </form>
            </div>

            {/* პაროლი */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">🔐 პაროლის შეცვლა</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="label">ახალი პაროლი</label>
                  <input
                    type="password"
                    className="input"
                    value={form.newPassword}
                    onChange={e => set("newPassword", e.target.value)}
                    placeholder="მინ. 8 სიმბოლო"
                    required
                  />
                </div>
                <div>
                  <label className="label">პაროლის დადასტურება</label>
                  <input
                    type="password"
                    className="input"
                    value={form.confirmPassword}
                    onChange={e => set("confirmPassword", e.target.value)}
                    placeholder="გაიმეორეთ პაროლი"
                    required
                  />
                  {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">პაროლები არ ემთხვევა</p>
                  )}
                  {form.confirmPassword && form.newPassword === form.confirmPassword && form.newPassword.length >= 8 && (
                    <p className="text-xs text-emerald-600 mt-1">✓ პაროლები ემთხვევა</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full py-3"
                >
                  {saving ? "იცვლება..." : "პაროლის შეცვლა"}
                </button>
              </form>
            </div>

            {/* შეტყობინებები */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">🔔 შეტყობინებები</h2>
              <div className="space-y-4">
                {[
                  { key: "notifications_email", label: "ელ. ფოსტის შეტყობინებები", desc: "შვილების გაკვეთილებისა და გადახდების შესახებ" },
                  { key: "notifications_sms",   label: "SMS შეტყობინებები",        desc: "გაკვეთილის შეხსენება და განახლებები" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                    <button
                      onClick={() => set(key, !form[key])}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        form[key] ? "bg-emerald-600" : "bg-gray-200"
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        form[key] ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ენა */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">🌐 ენა</h2>
              <div className="flex gap-3">
                {[
                  { key: "ka", label: "🇬🇪 ქართული" },
                  { key: "en", label: "🇬🇧 English" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => set("language", key)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      form.language === key
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-gray-200 text-gray-600 hover:border-emerald-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* შვილების მართვა — სწრაფი ლინკი */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-2">👶 შვილების მართვა</h2>
              <p className="text-sm text-gray-400 mb-4">შვილების დამატება, რედაქტირება ან წაშლა</p>
              <Link
                href="/dashboard/parent/children"
                className="w-full py-3 rounded-xl border border-emerald-200 text-emerald-600 text-sm font-medium hover:bg-emerald-50 transition-all text-center block"
              >
                შვილების მართვა →
              </Link>
            </div>

            {/* გასვლა */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-2">🚪 გასვლა</h2>
              <p className="text-sm text-gray-400 mb-4">გამოსვლა ანგარიშიდან</p>
              <button
                onClick={handleSignOut}
                className="w-full py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-all"
              >
                გასვლა ანგარიშიდან
              </button>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}