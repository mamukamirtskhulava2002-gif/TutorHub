"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AdminLayout from "@/components/AdminLayout";

function formatDate(iso) {
  return new Date(iso).toLocaleString("ka-GE", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function countdown(expires) {
  const ms = new Date(expires) - Date.now();
  if (ms <= 0) return "ვადა ამოიწ.";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}სთ ${m}წთ`;
}

export default function AdminRecordingsPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("ადმინი");
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role, full_name").eq("id", session.user.id).single();
      if (profile?.role !== "admin") { router.push("/dashboard"); return; }
      if (profile?.full_name) setAdminName(profile.full_name);

      const res = await fetch("/api/lesson-recordings");
      const json = await res.json();
      setRecordings(json.data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  return (
    <AdminLayout adminName={adminName}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">🎥 გაკვეთილის ჩანაწერები</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            ჩანაწერები ინახება 24 საათი, შემდეგ ავტომატ. იშლება
          </p>
        </div>
        <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-xl font-medium">
          {recordings.length} აქტიური
        </span>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 text-sm text-amber-800">
        <p className="font-semibold mb-1">ℹ️ Jitsi ჩანაწერების შესახებ</p>
        <p className="text-amber-700 text-xs leading-relaxed">
          მოცემული სია ასახავს ბოლო 24 საათის გაკვეთილების Jitsi ოთახებს.
          <strong> ბმული</strong> — ოთახის URL (free Jitsi არ ინახავს ვიდეოს).
          სრული ვიდეო ჩანაწერისთვის საჭიროა JaaS ან Jibri ინტეგრაცია.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">🎥</p>
          <p className="text-xl font-bold text-gray-700 mb-2">ჩანაწერი არ არის</p>
          <p className="text-sm text-gray-400">ბოლო 24 საათში გაკვეთილი არ ჩატარებულა</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recordings.map(r => {
            const b = r.bookings;
            const tutor   = b?.tutors?.profiles?.full_name || "—";
            const student = b?.profiles?.full_name || "—";
            const subject = b?.tutors?.subject?.[0] || "—";
            const msLeft  = new Date(r.expires_at) - now;
            const urgent  = msLeft < 4 * 3600000; // < 4h

            return (
              <div key={r.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm ${
                  urgent ? "border-red-200 bg-red-50/10" : "border-gray-100"
                }`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-gray-900">{tutor}</span>
                      <span className="text-gray-400 text-sm">vs</span>
                      <span className="font-bold text-gray-900">{student}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {subject}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      📅 {b?.date} {b?.time_slot?.slice(0, 5)} · ⏱ {b?.duration_hours}სთ
                      {b?.total_price > 0 && ` · ${b.total_price}₾`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      შეიქმნა: {formatDate(r.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`block text-xs font-bold px-3 py-1.5 rounded-full mb-2 ${
                      urgent
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}>
                      ⏳ {countdown(r.expires_at)}
                    </span>
                    <a
                      href={r.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 underline">
                      Jitsi ოთახი →
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4 text-right">
        ჩანაწერები ავტ. იშლება ყოველ 4 საათში (cron)
      </p>
    </AdminLayout>
  );
}
