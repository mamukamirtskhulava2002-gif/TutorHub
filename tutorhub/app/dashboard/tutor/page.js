"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import DashboardSidebar from "@/components/DashboardSidebar";

const WEEK_DAYS = ["ორ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"];

// ─── helpers ────────────────────────────────────────────────────────────────
function relativeTime(date, time) {
  if (!date) return null;
  const d = new Date(`${date}T${time || "00:00"}`);
  const diffMin = Math.round((d - new Date()) / 60000);
  const diffHrs = Math.floor((d - new Date()) / 3600000);
  const diffDays = Math.floor((d - new Date()) / 86400000);
  if (diffMin <= 0) return null;
  if (diffMin < 60) return `${diffMin} წუთში`;
  if (diffHrs < 24) return `${diffHrs} საათში`;
  if (diffDays === 1) return `ხვალ ${(time || "").slice(0, 5)}`;
  return null;
}

function profileCompleteness(t) {
  const checks = [
    { key: "bio",             label: "ბიო",           done: t?.bio && t.bio.length >= 30 },
    { key: "photo",           label: "ფოტო",          done: !!t?.photo_url },
    { key: "city",            label: "ქალაქი",        done: !!t?.city },
    { key: "experience",      label: "გამოცდ.",       done: (t?.experience_years || 0) > 0 },
    { key: "subject",         label: "საგანი",        done: t?.subject?.length > 0 },
    { key: "price",           label: "ფასი",          done: (t?.price_per_hour || 0) > 0 },
  ];
  const done = checks.filter(c => c.done).length;
  return { pct: Math.round((done / checks.length) * 100), checks };
}

// ─── component ───────────────────────────────────────────────────────────────
export default function TutorDashboard() {
  const router = useRouter();

  const [tutorName, setTutorName]       = useState("მასწავლებელი");
  const [loading, setLoading]           = useState(true);
  const [today, setToday]               = useState("");
  const [todayBookings, setTodayBookings] = useState([]);
  const [nextLesson, setNextLesson]     = useState(null);
  const [reviews, setReviews]           = useState([]);
  const [weekIncome, setWeekIncome]     = useState([0,0,0,0,0,0,0]);
  const [stats, setStats]               = useState({ revenue: 0, lessons: 0, students: 0, rating: 0, totalRevenue: 0, totalLessons: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [profile, setProfile]           = useState(null);
  const [toast, setToast]               = useState(null);

  function showToast(msg, type = "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleUpdateStatus(bookingId, newStatus) {
    const supabase = createClient();
    const { error } = await supabase
      .from("bookings").update({ status: newStatus }).eq("id", bookingId);
    if (error) {
      showToast("სტატუსის განახლება ვერ მოხერხდა");
    } else {
      setTodayBookings(prev =>
        prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
      );
      if (newStatus === "confirmed") {
        setPendingCount(p => Math.max(0, p - 1));
        showToast("ჯავშანი დადასტურდა!", "success");
      }
    }
  }

  useEffect(() => {
    setToday(new Date().toLocaleDateString("ka-GE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }));

    const supabase = createClient();
    let uid = null;
    let active = true;

    async function loadData(userId) {
      try {
        const todayStr = new Date().toLocaleDateString("en-CA");

        const [
          { data: profileData },
          { data: tutorData },
          { data: bookings },
          { data: nextData },
          { data: allBookings },
          { data: allReviews },
          { data: reviewsData },
          { count: pending },
        ] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", userId).single(),
          supabase.from("tutors").select("price_per_hour, bio, photo_url, city, experience_years, subject, onboarding_completed").eq("id", userId).single(),
          supabase.from("bookings")
            .select("id, time_slot, format, duration_hours, status, total_price, profiles!student_id(full_name), tutors(subject)")
            .eq("tutor_id", userId).eq("date", todayStr)
            .in("status", ["confirmed", "pending"])
            .order("time_slot", { ascending: true }),
          supabase.from("bookings")
            .select("id, date, time_slot, duration_hours, format, total_price, profiles!student_id(full_name), tutors(subject)")
            .eq("tutor_id", userId).eq("status", "confirmed")
            .gte("date", todayStr)
            .order("date", { ascending: true }).order("time_slot", { ascending: true })
            .limit(1),
          supabase.from("bookings")
            .select("student_id, duration_hours, total_price, status, date")
            .eq("tutor_id", userId),
          supabase.from("reviews").select("rating").eq("tutor_id", userId),
          supabase.from("reviews")
            .select("rating, comment, created_at, profiles!student_id(full_name)")
            .eq("tutor_id", userId).order("created_at", { ascending: false }).limit(3),
          supabase.from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("tutor_id", userId).eq("status", "pending"),
        ]);

        if (profileData?.full_name) setTutorName(profileData.full_name);
        setProfile(tutorData);
        setTodayBookings(bookings || []);
        setNextLesson(nextData?.[0] || null);
        setPendingCount(pending || 0);

        const pricePerHour = tutorData?.price_per_hour || 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear  = now.getFullYear();

        const d2 = new Date();
        const dayIdx = d2.getDay();
        const mondayDiff = d2.getDate() - dayIdx + (dayIdx === 0 ? -6 : 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), mondayDiff);
        startOfWeek.setHours(0, 0, 0, 0);

        let monthRevenue = 0, monthLessons = 0, totalRevenue = 0, totalLessons = 0;
        const uniqueStudents = new Set();
        const weekArr = [0,0,0,0,0,0,0];

        (allBookings || []).forEach(b => {
          const bDate = new Date(b.date);
          const income = b.total_price || (b.duration_hours || 1) * pricePerHour;

          if (b.status === "done") {
            totalRevenue += income;
            totalLessons++;
            if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
              monthRevenue += income;
              monthLessons++;
            }
          }
          if (b.status === "confirmed" || b.status === "done") {
            uniqueStudents.add(b.student_id);
            const bd = new Date(b.date); bd.setHours(0,0,0,0);
            const diff = Math.floor((bd - startOfWeek) / 86400000);
            if (diff >= 0 && diff < 7) weekArr[diff] += income;
          }
        });

        const avgRating = allReviews?.length > 0
          ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1)
          : 0;

        setStats({ revenue: monthRevenue, lessons: monthLessons, students: uniqueStudents.size, rating: avgRating, totalRevenue, totalLessons });
        setWeekIncome(weekArr);
        setReviews((reviewsData || []).map(r => ({
          name:  r.profiles?.full_name || "სტუდენტი",
          stars: r.rating,
          text:  r.comment || "",
          date:  r.created_at ? new Date(r.created_at).toLocaleDateString("ka-GE") : "ახლახან",
        })));

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) { router.replace("/auth"); return; }
      uid = session.user.id;

      const [{ data: profileData }, { data: tutorOnboarding }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", uid).single(),
        supabase.from("tutors").select("onboarding_completed").eq("id", uid).single(),
      ]);
      if (!active) return;
      if (profileData?.role !== "tutor") { router.replace("/dashboard"); return; }
      if (tutorOnboarding?.onboarding_completed === false) {
        router.replace("/onboarding/tutor");
        return;
      }

      await loadData(uid);
    }

    init();

    const channel = supabase.channel("tutor_dash_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => { if (uid) loadData(uid); })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxIncome    = Math.max(...weekIncome, 1);
  const weekTotal    = weekIncome.reduce((a, b) => a + b, 0);
  const completion   = profileCompleteness(profile);
  const todayDayIdx  = new Date().getDay(); // 0=კვი, 1=ორ...

  // ─── render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />

      <main className="p-6 md:p-8">
        <div className="max-w-5xl">

          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 text-sm px-5 py-3 rounded-2xl shadow-lg border font-medium transition-all ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {toast.type === "success" ? "✅" : "❌"} {toast.msg}
            </div>
          )}

          {/* Header */}
          <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-gray-900">
                გამარჯობა, {tutorName.split(" ")[0]} 👋
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">{today}</p>
            </div>
            <Link href="/dashboard/tutor/schedule" className="btn-primary text-sm">
              + განრიგის დამატება
            </Link>
          </div>

          {/* ─── Pending banner ─── */}
          {!loading && pendingCount > 0 && (
            <Link href="/dashboard/tutor/bookings"
              className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 mb-5 hover:bg-amber-100 transition-colors group">
              <div className="flex items-center gap-3">
                <span className="text-xl">⏳</span>
                <div>
                  <p className="text-sm font-bold text-amber-800">
                    {pendingCount} ჯავშანი დადასტურებას ელოდება
                  </p>
                  <p className="text-xs text-amber-600">სტუდენტები პასუხს ელოდებიან</p>
                </div>
              </div>
              <span className="text-amber-500 font-bold group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          )}

          {/* ─── Next lesson banner ─── */}
          {!loading && nextLesson && (() => {
            const rel  = relativeTime(nextLesson.date, nextLesson.time_slot);
            const subj = Array.isArray(nextLesson.tutors?.subject)
              ? nextLesson.tutors.subject[0] : nextLesson.tutors?.subject;
            return (
              <div className={`rounded-2xl p-4 mb-5 flex items-center justify-between gap-3 shadow-md ${
                rel?.includes("წუთ") ? "bg-emerald-700" : "bg-emerald-600"
              }`}>
                <div>
                  <p className="text-xs font-medium text-emerald-200 mb-0.5">შემდეგი გაკვეთილი</p>
                  <p className="font-bold text-white">
                    {nextLesson.profiles?.full_name} · {subj}
                  </p>
                  <p className="text-sm text-emerald-200 mt-0.5">
                    {nextLesson.time_slot?.slice(0,5)} · {nextLesson.format === "online" ? "🌐 ონლაინ" : "🏠 პირისპირ"} · {nextLesson.duration_hours}სთ
                    {rel && <span className="ml-2 font-bold">· {rel} ⚡</span>}
                  </p>
                </div>
                {nextLesson.format === "online" && (
                  <Link href={`/lesson/${nextLesson.id}`}
                    className="shrink-0 bg-white text-emerald-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-emerald-50 transition-colors">
                    შეერთება →
                  </Link>
                )}
              </div>
            );
          })()}

          {/* ─── Stats ─── */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                  <div className="h-7 bg-gray-200 rounded w-1/2 mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                {
                  value: `${stats.revenue}₾`,
                  label: "ამ თვის შემოს.",
                  sub: stats.totalRevenue > 0 ? `სულ: ${stats.totalRevenue}₾` : "პირველი თვე",
                  color: "text-emerald-600",
                },
                {
                  value: stats.lessons,
                  label: "გაკვეთ. (თვე)",
                  sub: `სულ: ${stats.totalLessons}`,
                  color: "text-gray-800",
                },
                {
                  value: stats.students,
                  label: "სტუდენტი",
                  sub: "ამ თვეში",
                  color: "text-gray-800",
                },
                {
                  value: stats.rating > 0 ? `⭐ ${stats.rating}` : "—",
                  label: "რეიტინგი",
                  sub: "საერთო",
                  color: "text-amber-600",
                },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* ─── Quick actions ─── */}
          {!loading && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { icon: "📅", label: "ჯავშნები", href: "/dashboard/tutor/bookings", badge: pendingCount },
                { icon: "🕐", label: "განრიგი",  href: "/dashboard/tutor/schedule" },
                { icon: "👤", label: "პროფილი",  href: "/dashboard/tutor/profile" },
                { icon: "💬", label: "შეტყობ.",  href: "/messages" },
              ].map(({ icon, label, href, badge }) => (
                <Link key={href} href={href}
                  className="relative bg-white rounded-2xl p-3 border border-gray-100 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all text-center">
                  <p className="text-2xl mb-1">{icon}</p>
                  <p className="text-xs font-medium text-gray-600">{label}</p>
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-6">

            {/* ─── Today's bookings ─── */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">📋 დღევანდელი</h2>
                <span className="badge-green">
                  {todayBookings.filter(b => b.status === "confirmed").length} გაკვ.
                </span>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1,2].map(i => (
                    <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : todayBookings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">☀️</p>
                  <p className="text-sm text-gray-400 mb-3">დღეს გაკვეთილები არ არის</p>
                  <Link href="/dashboard/tutor/schedule"
                    className="text-xs text-emerald-600 hover:underline font-medium">
                    + განრიგის დამატება
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayBookings.map(b => {
                    const initials = b.profiles?.full_name
                      ?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
                    const income = b.total_price || 0;
                    return (
                      <div key={b.id}
                        className={`flex items-center gap-3 p-3 rounded-xl ${
                          b.status === "pending" ? "bg-amber-50 border border-amber-100" : "bg-gray-50"
                        }`}>
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                          {initials}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{b.profiles?.full_name}</p>
                          <p className="text-xs text-gray-400">
                            {b.time_slot?.slice(0,5)} · {b.format === "online" ? "🌐" : "🏠"} · {b.duration_hours}სთ
                            {income > 0 && <span className="ml-1 text-emerald-600 font-medium">{income}₾</span>}
                          </p>
                        </div>

                        {/* Actions */}
                        {b.status === "pending" ? (
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => handleUpdateStatus(b.id, "confirmed")}
                              className="w-7 h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
                              title="დადასტ.">✓</button>
                            <button onClick={() => handleUpdateStatus(b.id, "cancelled")}
                              className="w-7 h-7 bg-rose-500 hover:bg-rose-600 text-white rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
                              title="გაუქმება">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="badge-green text-xs">დადასტ.</span>
                            {b.format === "online" && (
                              <button onClick={() => router.push(`/lesson/${b.id}`)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2 py-1 rounded-lg font-medium transition-colors">
                                →
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Weekly income chart ─── */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">📊 კვირის შემოს.</h2>
                <span className="text-lg font-black text-emerald-600">{weekTotal}₾</span>
              </div>
              <div className="flex items-end gap-1.5 h-24 mb-2">
                {weekIncome.map((v, i) => {
                  const isToday = (todayDayIdx === 0 ? 6 : todayDayIdx - 1) === i;
                  return (
                    <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                      {v > 0 && (
                        <p className="text-[9px] text-gray-400 leading-none">{v}₾</p>
                      )}
                      <div className="w-full rounded-t-md transition-all duration-500"
                        style={{
                          height: `${(v / maxIncome) * 80}%`,
                          minHeight: v > 0 ? "4px" : "0",
                          backgroundColor: isToday ? "#059669" : "#D1FAE5",
                        }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                {WEEK_DAYS.map((d, i) => {
                  const isToday = (todayDayIdx === 0 ? 6 : todayDayIdx - 1) === i;
                  return (
                    <div key={i} className={`flex-1 text-center text-xs ${
                      isToday ? "text-emerald-600 font-bold" : "text-gray-400"
                    }`}>{d}</div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">

            {/* ─── Reviews ─── */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">📝 გამოხმაურებები</h2>
                <Link href="/dashboard/tutor/reviews"
                  className="text-xs text-emerald-600 hover:underline font-medium">
                  ყველა →
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">⭐</p>
                  <p className="text-sm text-gray-400">შეფასებები ჯერ არ არის</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">{r.name}</span>
                        <div className="flex">
                          {Array(5).fill(0).map((_, idx) => (
                            <span key={idx} className={idx < r.stars ? "text-amber-400" : "text-gray-200"}>★</span>
                          ))}
                        </div>
                      </div>
                      {r.text && <p className="text-xs text-gray-500 line-clamp-2">{r.text}</p>}
                      <p className="text-[10px] text-gray-300 text-right mt-1">{r.date}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Profile completeness ─── */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">👤 პროფილის სისრულე</h2>
                <span className={`text-sm font-black ${
                  completion.pct === 100 ? "text-emerald-600" :
                  completion.pct >= 60  ? "text-amber-600" : "text-red-500"
                }`}>
                  {completion.pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  completion.pct === 100 ? "bg-emerald-500" :
                  completion.pct >= 60  ? "bg-amber-500" : "bg-red-400"
                }`} style={{ width: `${completion.pct}%` }} />
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                {completion.checks.map(c => (
                  <div key={c.key} className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                      c.done ? "bg-emerald-500" : "bg-gray-200"
                    }`}>
                      {c.done && <span className="text-white text-[9px] font-bold">✓</span>}
                    </div>
                    <span className={`text-sm ${c.done ? "text-gray-600" : "text-gray-400"}`}>
                      {c.label}
                    </span>
                    {!c.done && (
                      <Link href="/dashboard/tutor/profile"
                        className="ml-auto text-xs text-emerald-600 hover:underline shrink-0">
                        + დამატება
                      </Link>
                    )}
                  </div>
                ))}
              </div>

              {completion.pct === 100 ? (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <p className="text-xs text-emerald-700 font-medium text-center">
                    ✅ პროფილი სრულია — სტუდენტები უკეთ გნახავენ!
                  </p>
                </div>
              ) : (
                <Link href="/dashboard/tutor/profile"
                  className="mt-4 block text-center btn-primary py-2.5 text-sm">
                  პროფილის შევსება →
                </Link>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
