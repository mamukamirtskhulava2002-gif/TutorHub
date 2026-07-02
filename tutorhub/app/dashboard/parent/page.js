"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ParentDashboard() {
  const router = useRouter();

  const [loading, setLoading]             = useState(true);
  const [name, setName]                   = useState("");
  const [parentId, setParentId]           = useState(null);
  const [today, setToday]                 = useState("");
  const [children, setChildren]           = useState([]);
  const [upcomingLessons, setUpcomingLessons] = useState([]);
  const [recentFeedback, setRecentFeedback]   = useState([]);
  const [recentPayments, setRecentPayments]   = useState([]);
  const [walletBalance, setWalletBalance]     = useState(0);
  const [stats, setStats]                     = useState({
    totalChildren: 0, totalLessons: 0, monthlySpend: 0, activeTutors: 0,
  });

  useEffect(() => {
    setToday(new Date().toLocaleDateString("ka-GE", {
      weekday: "long", day: "numeric", month: "long",
    }));

    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setParentId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, wallet_balance")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "parent") { router.push("/dashboard"); return; }
      if (profile?.full_name) setName(profile.full_name.split(" ")[0]);
      setWalletBalance(profile?.wallet_balance || 0);

      // შვილები
      const { data: childrenData } = await supabase
        .from("parent_children")
        .select("id, profiles!child_id(id, full_name, email)")
        .eq("parent_id", user.id);
      const kids = childrenData || [];
      setChildren(kids);

      const childIds = kids.map(c => c.profiles?.id).filter(Boolean);

      if (childIds.length > 0) {
        // მომავალი გაკვეთილები
        const { data: lessons } = await supabase
          .from("bookings")
          .select(`id, start_time, status,
            profiles!student_id(full_name),
            tutors(id, subject, profiles(full_name))`)
          .in("student_id", childIds)
          .in("status", ["confirmed", "pending"])
          .gte("start_time", new Date().toISOString())
          .order("start_time", { ascending: true })
          .limit(4);
        setUpcomingLessons(lessons || []);

        // მასწავლებლის feedback
        const { data: feedback } = await supabase
          .from("lesson_feedback")
          .select(`id, feedback_text, rating, created_at, tutor_id,
            profiles!tutor_id(full_name),
            profiles!student_id(full_name)`)
          .in("student_id", childIds)
          .eq("is_visible_to_parent", true)
          .order("created_at", { ascending: false })
          .limit(4);
        setRecentFeedback(feedback || []);

        // სტატისტიკა
        const { count: totalLessons } = await supabase
          .from("bookings").select("*", { count: "exact", head: true })
          .in("student_id", childIds).eq("status", "done");

        const { data: tutorIds } = await supabase
          .from("bookings").select("tutor_id")
          .in("student_id", childIds).eq("status", "confirmed");
        const uniqueTutors = new Set(tutorIds?.map(t => t.tutor_id)).size;

        const startOfMonth = new Date();
        startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
        const { data: monthPayments } = await supabase
          .from("payments").select("amount")
          .in("student_id", childIds).eq("status", "paid")
          .gte("created_at", startOfMonth.toISOString());
        const monthlySpend = monthPayments?.reduce((s, p) => s + (p.amount || 0), 0) || 0;

        setStats({ totalChildren: kids.length, totalLessons: totalLessons || 0, monthlySpend, activeTutors: uniqueTutors });

        // ბოლო გადახდები
        const { data: payments } = await supabase
          .from("payments")
          .select(`id, amount, status, created_at,
            profiles!student_id(full_name),
            bookings(tutors(subject))`)
          .in("student_id", childIds)
          .order("created_at", { ascending: false })
          .limit(4);
        setRecentPayments(payments || []);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  function fmt(iso) {
    return new Date(iso).toLocaleString("ka-GE", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("ka-GE", { day: "numeric", month: "short" });
  }
  function daysUntil(iso) {
    const diff = new Date(iso) - new Date();
    const days = Math.ceil(diff / 86400000);
    if (days === 0) return "დღეს";
    if (days === 1) return "ხვალ";
    return `${days} დღეში`;
  }

  const AVATAR = ["avatar-blue","avatar-green","avatar-amber","avatar-purple"];

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="parent" userName={name} />

      <main className="p-6 md:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              გამარჯობა, {name || "მშობელო"}! 👋
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{today}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/search" className="btn-primary text-sm px-4 py-2">
              + მასწავლებლის პოვნა
            </Link>
          </div>
        </div>

        {/* ── Wallet + Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* საფულე — გამოკვეთილი */}
          <div className="lg:col-span-1 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-sm">
            <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wide mb-1">ბალანსი</p>
            {loading ? (
              <div className="h-8 bg-white/20 rounded-xl animate-pulse w-24 mb-3" />
            ) : (
              <p className="text-3xl font-black mb-3">{walletBalance.toFixed(2)} ₾</p>
            )}
            <Link href="/dashboard/parent/payments"
              className="inline-block text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-all">
              + თანხის შევსება
            </Link>
          </div>

          {/* სტატ-ბარათები */}
          {[
            { icon: "👶", label: "შვილები",          value: stats.totalChildren },
            { icon: "📚", label: "ჩატარებული გაკვ.", value: stats.totalLessons },
            { icon: "👨‍🏫", label: "მასწავლებელი",    value: stats.activeTutors },
          ].map((s, i) => (
            <div key={i} className="stat-card p-5">
              {loading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-7 bg-gray-200 rounded w-1/2" />
                </div>
              ) : (
                <>
                  <p className="text-2xl mb-2">{s.icon}</p>
                  <p className="text-2xl font-black text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.label}</p>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ── შვილები overview ── */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg">👶 ჩემი შვილები</h2>
            <Link href="/dashboard/parent/children"
              className="text-sm text-emerald-600 font-medium hover:underline">
              მართვა →
            </Link>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : children.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">👶</p>
              <p className="text-sm text-gray-400 mb-4">შვილი ჯერ არ გყავს დამატებული</p>
              <Link href="/dashboard/parent/children" className="btn-primary text-sm px-5 py-2.5">
                + შვილის დამატება
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {children.map((child, i) => {
                const profile = child.profiles;
                const initials = (profile?.full_name || "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
                return (
                  <div key={child.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all">
                    <div className={`avatar w-11 h-11 text-sm flex-shrink-0 ${AVATAR[i % AVATAR.length]}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{profile?.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{profile?.email}</p>
                    </div>
                    <Link href={`/dashboard/parent/lessons?child=${profile?.id}`}
                      className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl font-medium hover:bg-emerald-100 transition-all flex-shrink-0">
                      📅 გაკვეთილები
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── მომავალი გაკვ. + Feedback ── */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* მომავალი გაკვეთილები */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">📅 მომავალი გაკვეთილები</h2>
              <Link href="/dashboard/parent/lessons" className="text-sm text-emerald-600 hover:underline">
                ყველა →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : upcomingLessons.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-gray-400">მომავალი გაკვეთილები არ არის</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingLessons.map(lesson => (
                  <div key={lesson.id}
                    className="flex items-start justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {lesson.profiles?.full_name}
                        {lesson.tutors?.subject?.[0] && <span className="text-gray-500"> · {lesson.tutors.subject[0]}</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        👨‍🏫{" "}
                        <Link href={`/tutor/${lesson.tutors?.id}`} className="hover:underline hover:text-emerald-600">
                          {lesson.tutors?.profiles?.full_name}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmt(lesson.start_time)}</p>
                    </div>
                    <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg flex-shrink-0 ml-2">
                      {daysUntil(lesson.start_time)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* მასწავლებლის Feedback */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">📝 მასწ. შეფასება</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">გაკვეთილის შემდეგ</span>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : recentFeedback.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-sm text-gray-400">შეფასებები ჯერ არ არის</p>
                <p className="text-xs text-gray-400 mt-1">გაკვეთილის შემდეგ მასწ. დატოვებს კომენტარს</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentFeedback.map(fb => (
                  <div key={fb.id} className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-blue-700">
                        👨‍🏫{" "}
                        <Link href={`/tutor/${fb.tutor_id}`} className="hover:underline">
                          {fb["profiles!tutor_id"]?.full_name || fb.profiles?.full_name}
                        </Link>
                      </p>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={`text-xs ${i < (fb.rating || 0) ? "text-amber-400" : "text-gray-300"}`}>★</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{fb.feedback_text}</p>
                    <p className="text-xs text-gray-400 mt-1.5">{fmtDate(fb.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── ბოლო გადახდები ── */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">💳 ბოლო გადახდები</h2>
            <Link href="/dashboard/parent/payments" className="text-sm text-emerald-600 hover:underline">
              ყველა + თანხის დაბრუნება →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : recentPayments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">გადახდები არ არის</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map(p => (
                <div key={p.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {p.profiles?.full_name}
                      {p.bookings?.tutors?.subject?.[0] && ` · ${p.bookings.tutors.subject[0]}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      p.status === "paid"    ? "bg-emerald-50 text-emerald-700" :
                      p.status === "pending" ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-500"
                    }`}>
                      {p.status === "paid" ? "გადახდილი" : p.status === "pending" ? "მოლოდინში" : "გაუქმ."}
                    </span>
                    <span className="font-black text-gray-900">{p.amount} ₾</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
