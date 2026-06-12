"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();

      setForm(f => ({
        ...f,
        full_name: profile?.full_name || "",
        email: user.email || "",
        phone: profile?.phone || "",
      }));
      setLoading(false);
    }
    fetchUser();
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: err } = await supabase
      .from("profiles")
      .update({ full_name: form.full_name, phone: form.phone })
      .eq("id", user.id);

    if (err) {
      setError("შეცდომა. სცადეთ ხელახლა.");
    } else {
      setSuccess("პროფილი წარმატებით განახლდა!");
    }
    setSaving(false);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (form.newPassword.length < 8) {
      setError("პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password: form.newPassword });

    if (err) {
      setError("პაროლის შეცვლა ვერ მოხერხდა.");
    } else {
      setSuccess("პაროლი წარმატებით შეიცვალა!");
      setForm(f => ({ ...f, currentPassword: "", newPassword: "" }));
    }
    setSaving(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

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
          <Link href="/dashboard/student/payments" className="sidebar-link">💳 გადახდები</Link>
          <Link href="/dashboard/student/settings" className="sidebar-link active">⚙️ პარამეტრები</Link>
        </div>

        {/* Main */}
        <div className="main-content">
          <h1 className="text-2xl font-black text-gray-900 mb-6">⚙️ პარამეტრები</h1>

          {/* შეტყობინებები */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-5">
              {success}
            </div>
          )}

          {loading ? (
            <div className="card p-6 animate-pulse space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-10 bg-gray-200 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">

              {/* პროფილის რედაქტირება */}
              <div className="card p-6">
                <h2 className="font-bold text-gray-900 mb-4">👤 პროფილის რედაქტირება</h2>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="label">სახელი და გვარი</label>
                    <input
                      className="input"
                      value={form.full_name}
                      onChange={e => set("full_name", e.target.value)}
                      placeholder="ანა გელაშვილი"
                      required
                    />
                  </div>
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
                    <label className="label">ტელეფონი</label>
                    <input
                      className="input"
                      value={form.phone}
                      onChange={e => set("phone", e.target.value)}
                      placeholder="+995 5XX XXX XXX"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary w-full py-3"
                  >
                    {saving ? "ინახება..." : "შენახვა"}
                  </button>
                </form>
              </div>

              {/* პაროლის შეცვლა */}
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
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary w-full py-3"
                  >
                    {saving ? "იცვლება..." : "პაროლის შეცვლა"}
                  </button>
                </form>
              </div>

              {/* გასვლა */}
              <div className="card p-6">
                <h2 className="font-bold text-gray-900 mb-2">🚪 გასვლა</h2>
                <p className="text-sm text-gray-400 mb-4">გამოსვლა ანგარიშიდან</p>
                <button
                  onClick={handleLogout}
                  className="w-full py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-all"
                >
                  გასვლა ანგარიშიდან
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}