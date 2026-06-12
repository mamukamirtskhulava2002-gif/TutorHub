"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AdminLayout from "@/components/AdminLayout";

const Section = ({ title, children }) => (
  <div className="card p-6 space-y-5">
    <h2 className="font-bold text-gray-900 text-base border-b border-gray-100 pb-3">{title}</h2>
    {children}
  </div>
);
const Field = ({ label, children }) => (
  <div><label className="label">{label}</label>{children}</div>
);
const Toggle = ({ label, desc, checked, onChange }) => (
  <div className="flex items-center justify-between py-1">
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
    </div>
    <button type="button" onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${checked ? "bg-emerald-500" : "bg-gray-200"}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  </div>
);

export default function AdminSettingsPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("ადმინი");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [newPass, setNewPass]   = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passError, setPassError]     = useState("");

  const [platform, setPlatform] = useState({
    commissionPct: 10, freeTrialMinutes: 15, maxBookingDays: 30, maintenanceMode: false,
  });
  const [notifications, setNotifications] = useState({
    emailNewBooking: true, emailNewTutor: true, emailPayment: true, emailReport: true, smsNewBooking: false,
  });
  const [security, setSecurity] = useState({
    requireEmailVerify: true, adminTwoFactor: false, autoBlockSpam: true,
  });

  useEffect(() => {
    async function fetchAdmin() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { router.push("/auth"); return; }
        const { data: profile } = await supabase
          .from("profiles").select("full_name, phone, role").eq("id", session.user.id).single();
        if (profile?.role !== "admin") { router.push("/dashboard"); return; }
        setFullName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
        setEmail(session.user.email ?? "");
        setAdminName((profile.full_name ?? "Admin").split(" ")[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAdmin();
  }, [router]);

  function showAlert(type, msg) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 3500);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id);
      if (error) throw error;
      setAdminName(fullName.split(" ")[0]);
      showAlert("success", "პროფილი განახლდა ✓");
    } catch {
      showAlert("error", "შეცდომა — სცადეთ თავიდან");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPassError("");
    if (newPass.length < 8) { setPassError("მინ. 8 სიმბოლო"); return; }
    if (newPass !== confirmPass) { setPassError("პაროლები არ ემთხვევა"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      setNewPass(""); setConfirmPass("");
      showAlert("success", "პაროლი შეიცვალა ✓");
    } catch {
      showAlert("error", "პაროლის შეცვლა ვერ მოხერხდა");
    } finally {
      setSaving(false);
    }
  }

  function setPF(k, v) { setPlatform(p => ({ ...p, [k]: v })); }
  function setNF(k, v) { setNotifications(n => ({ ...n, [k]: v })); }
  function setSF(k, v) { setSecurity(s => ({ ...s, [k]: v })); }

  if (loading) {
    return (
      <AdminLayout adminName={adminName}>
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout adminName={adminName}>
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">⚙️ პარამეტრები</h1>
          <p className="text-sm text-gray-400 mt-0.5">პლატფორმის კონფიგურაცია</p>
        </div>

        {alert && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${
            alert.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {alert.msg}
          </div>
        )}

        <div className="space-y-6">
          <Section title="👤 ადმინის პროფილი">
            <div className="grid grid-cols-2 gap-4">
              <Field label="სახელი და გვარი">
                <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} />
              </Field>
              <Field label="ტელეფონი">
                <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+995 5XX XXX XXX" />
              </Field>
            </div>
            <Field label="ელ. ფოსტა">
              <input className="input bg-gray-50 text-gray-500" value={email} disabled />
            </Field>
            <button onClick={saveProfile} disabled={saving} className="btn-primary px-6">
              {saving ? "ინახება..." : "შენახვა"}
            </button>
          </Section>

          <Section title="🔑 პაროლის შეცვლა">
            <div className="grid grid-cols-2 gap-4">
              <Field label="ახალი პაროლი">
                <input type="password" className="input" value={newPass}
                  onChange={e => { setNewPass(e.target.value); setPassError(""); }} placeholder="მინ. 8 სიმბოლო" />
              </Field>
              <Field label="განმეორება">
                <input type="password" className="input" value={confirmPass}
                  onChange={e => { setConfirmPass(e.target.value); setPassError(""); }} placeholder="••••••••" />
              </Field>
            </div>
            {passError && <p className="text-xs text-red-500">{passError}</p>}
            {newPass && confirmPass && newPass === confirmPass && (
              <p className="text-xs text-emerald-600">✓ პაროლები ემთხვევა</p>
            )}
            <button onClick={changePassword} disabled={saving || !newPass} className="btn-primary px-6">
              {saving ? "იცვლება..." : "პაროლის შეცვლა"}
            </button>
          </Section>

          <Section title="🏢 პლატფორმის პარამეტრები">
            <div className="grid grid-cols-2 gap-4">
              <Field label={`კომისია: ${platform.commissionPct}%`}>
                <input type="range" min={0} max={30} step={1} value={platform.commissionPct}
                  onChange={e => setPF("commissionPct", Number(e.target.value))}
                  className="w-full accent-emerald-600 mt-1" />
                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0%</span><span>30%</span></div>
              </Field>
              <Field label={`Trial გაკვეთილი: ${platform.freeTrialMinutes} წთ`}>
                <input type="range" min={0} max={30} step={5} value={platform.freeTrialMinutes}
                  onChange={e => setPF("freeTrialMinutes", Number(e.target.value))}
                  className="w-full accent-emerald-600 mt-1" />
                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0 წთ</span><span>30 წთ</span></div>
              </Field>
            </div>
            <Field label={`მაქს. წინასწარი ჯავშანი: ${platform.maxBookingDays} დღე`}>
              <input type="range" min={7} max={90} step={7} value={platform.maxBookingDays}
                onChange={e => setPF("maxBookingDays", Number(e.target.value))}
                className="w-full accent-emerald-600 mt-1" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>7 დღე</span><span>90 დღე</span></div>
            </Field>
            <div className="pt-2 border-t border-gray-100">
              <Toggle label="🔧 Maintenance Mode" desc="საიტი მიუწვდომელი გახდება ვიზიტორებისთვის"
                checked={platform.maintenanceMode} onChange={v => setPF("maintenanceMode", v)} />
            </div>
          </Section>

          <Section title="🔔 შეტყობინებები">
            <div className="space-y-3">
              {[
                ["emailNewBooking", "ახალი ჯავშანი",       "ელ. ფოსტა ახალი booking-ზე"],
                ["emailNewTutor",   "ახალი მასწავლებელი",  "ვერიფიკაციის მოთხოვნა"],
                ["emailPayment",    "გადახდა",              "გადახდის დადასტ. / ჩავარდნა"],
                ["emailReport",     "შეტყობინებული შეფ.",  "🚩 flagged reviews-ზე"],
                ["smsNewBooking",   "SMS — ახალი ჯავშანი", "SMS შეტყობინება (ფასიანი)"],
              ].map(([k, label, desc]) => (
                <Toggle key={k} label={label} desc={desc} checked={notifications[k]} onChange={v => setNF(k, v)} />
              ))}
            </div>
          </Section>

          <Section title="🛡️ უსაფრთხოება">
            <div className="space-y-3">
              {[
                ["requireEmailVerify", "ელ. ფოსტის ვერიფიკაცია", "ახალ მომხმარებლებს ელ. ფოსტა უნდა დაადასტურონ"],
                ["adminTwoFactor",     "2FA Admin-ისთვის",         "Admin-ის შესვლაზე დამატებითი კოდი"],
                ["autoBlockSpam",      "სპამის ავტო-დაბლოკვა",    "ეჭვიანი ანგარიშები ავტომატურად ბლოკდება"],
              ].map(([k, label, desc]) => (
                <Toggle key={k} label={label} desc={desc} checked={security[k]} onChange={v => setSF(k, v)} />
              ))}
            </div>
          </Section>

          <div className="card p-6 border-red-200 bg-red-50">
            <h2 className="font-bold text-red-700 mb-4">⚠️ Danger Zone</h2>
            <div className="space-y-3">
              {[
                ["ყველა Cache-ის გასუფთავება", "სერვერის cache-ი გასუფთავდება", "გასუფთავება"],
                ["სატესტო მონაცემების წაშლა",  "Seed data — ყველა test user წაიშლება", "წაშლა"],
              ].map(([title, desc, btn]) => (
                <div key={title} className="flex items-center justify-between p-3 bg-white rounded-xl border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{title}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <button className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                    {btn}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
