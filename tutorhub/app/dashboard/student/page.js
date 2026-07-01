"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const SUBJECT_ICONS = {
  "მათემატიკა":"📐","ფიზიკა":"⚛️","ქიმია":"🧪","ბიოლოგია":"🌿",
  "გეოგრაფია":"🌍","ისტორია":"🏛️","ქართული ენა და ლიტერატურა":"📖",
  "სამოქალაქო განათლება":"🏛","ინფორმატიკა":"🖥️","ეკონომიკა":"📈",
  "ინგლისური ენა":"🇬🇧","გერმანული ენა":"🇩🇪","ფრანგული ენა":"🇫🇷",
  "ესპანური ენა":"🇪🇸","რუსული ენა":"🇷🇺","ჩინური ენა":"🇨🇳",
  "იაპონური ენა":"🇯🇵","არაბული ენა":"🇸🇦",
  "Python":"🐍","JavaScript":"🟨","Java":"☕","C# / C++":"⚙️","Swift":"🍎",
  "UI/UX დიზაინი":"🎨","გრაფიკული დიზაინი":"🖌️","3D მოდელირება":"🧊",
  "კიბერუსაფრთხოება":"🔐","Cloud Computing":"☁️","მონაცემთა ბაზები (SQL)":"🗄️",
  "ციფრული მარკეტინგი":"📣","SMM და SEO":"📱","ბუღალტერია":"🧾",
  "ფინანსური მოდელირება":"💹","პროექტების მართვა (Agile/Scrum)":"📋",
  "ფორტეპიანო":"🎹","გიტარა":"🎸","ვიოლინო":"🎻","დრამი":"🥁",
  "სოლფეჯიო":"🎼","მუსიკალური თეორია":"🎵",
  "ხატვა":"🖼️","ფოტოგრაფია":"📷","კინომონტაჟი":"🎬",
  "იოგა და მედიტაცია":"🧘","კულინარია":"🍳","ჭადრაკი":"♟️",
  "საჯარო გამოსვლები":"🎤","სწრაფი კითხვა":"📚","მართვის მოწმობის თეორია":"🚗",
};

const SUBJECT_COLORS = {
  "მათემატიკა": { bar:"#378ADD", bg:"#E6F1FB" },
  "ფიზიკა":     { bar:"#EF9F27", bg:"#FAEEDA" },
  "ქიმია":      { bar:"#E24B4A", bg:"#FCEBEB" },
  "ბიოლოგია":   { bar:"#1D9E75", bg:"#E1F5EE" },
  "ქართული":    { bar:"#7F77DD", bg:"#EEEDFE" },
  "ინგლისური":  { bar:"#1D9E75", bg:"#E1F5EE" },
  "ისტორია":    { bar:"#D85A30", bg:"#FAECE7" },
  "პროგრამირება":{ bar:"#7F77DD", bg:"#EEEDFE" },
};
const DEFAULT_COLOR = { bar:"#378ADD", bg:"#E6F1FB" };

const LESSON_GOAL = 20;

function getRank(count) {
  if (count >= 20) return "ალმასი 💎";
if (count >= 15) return "პლატინა 💿";
if (count >= 10) return "ოქრო 🥇";
if (count >= 5)  return "ვერცხლი 🥈";
return "ბრინჯაო 🥉";
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ka-GE", {
    weekday:"short", day:"numeric", month:"short",
    hour:"2-digit", minute:"2-digit",
  });
}

export default function StudentDashboard() {
  const router = useRouter();
  const [name, setName]                 = useState("");
  const [today, setToday]               = useState("");
  const [loading, setLoading]           = useState(true);
  const [upcomingLessons, setUpcoming]  = useState([]);
  const [recentMessages, setMessages]   = useState([]);
const [unreadCount, setUnreadCount]   = useState(0);
  const [progress, setProgress]         = useState([]);
  const [packages, setPackages] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [stats, setStats]               = useState({ totalLessons:0, activeTutors:0, totalHours:0 });
  const [creditBalance, setCreditBalance] = useState(null);
  const [invitations, setInvitations]   = useState([]);
  const [invLoading, setInvLoading]     = useState({});

  useEffect(() => {
    setToday(new Date().toLocaleDateString("ka-GE", {
      weekday:"long", day:"numeric", month:"long",
    }));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let uid = null;
    let active = true; // guard against Strict Mode double-mount

    // Loads dynamic data only — no auth/redirect logic, safe to call from realtime
    async function loadData(userId) {
      const { data: lessons } = await supabase
        .from("bookings")
        .select("id,date,time_slot,duration_hours,status,format,tutors(id,profiles(full_name),subject)")
        .eq("student_id", userId)
        .in("status", ["confirmed","pending"])
        .order("date", { ascending:true })
        .limit(10);
      if (lessons) {
        const cutoff = Date.now() - 3 * 3600000; // 3 hours ago
        const filtered = lessons.filter(l => {
          if (!l.date || !l.time_slot) return true;
          const end = new Date(`${l.date}T${l.time_slot}`).getTime()
            + (l.duration_hours || 1) * 3600000;
          return end > cutoff;
        });
        setUpcoming(filtered.slice(0, 3));
      }

      const { data: doneLessons } = await supabase
        .from("bookings")
        .select("duration_hours,tutors(subject,profiles(full_name))")
        .eq("student_id", userId)
        .eq("status", "done");

      if (doneLessons) {
        const subjectMap = {};
        let totalMinutes = 0;
        doneLessons.forEach(b => {
          const subjectData = b.tutors?.subject;
          const tutorName   = b.tutors?.profiles?.full_name || "";
          totalMinutes += (b.duration_hours || 1) * 60;
          if (subjectData) {
            const arr = Array.isArray(subjectData) ? subjectData : [subjectData];
            arr.forEach(s => {
              if (!subjectMap[s]) subjectMap[s] = { count:0, tutorName };
              subjectMap[s].count += 1;
            });
          }
        });
        setProgress(
          Object.entries(subjectMap)
            .map(([subject, val]) => ({ subject, ...val }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
        );
        const { data: tutorIds } = await supabase
          .from("bookings").select("tutor_id")
          .eq("student_id", userId).eq("status", "confirmed");
        const uniqueTutors = new Set(tutorIds?.map(t => t.tutor_id)).size;
        setStats({
          totalLessons: doneLessons.length,
          activeTutors: uniqueTutors,
          totalHours: Math.round(totalMinutes / 60),
        });
      }

      const { data: activePackages } = await supabase
        .from("packages").select("*")
        .eq("student_id", userId).eq("status", "active");
      if (activePackages) setPackages(activePackages);

      const { data: messages } = await supabase
        .from("messages")
        .select("id,content,created_at,seen,sender_id,profiles!messages_sender_id_fkey(full_name)")
        .eq("receiver_id", userId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (messages) {
        setMessages(messages);
        setUnreadCount(messages.filter(m => !m.seen).length);
      }

      setLoading(false);
    }

    // Runs ONCE on mount: verifies auth, checks onboarding, then loads data
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) { router.replace("/auth"); return; }
      const user = session.user;
      uid = user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, onboarding_completed, student_level, preferred_subjects, preferred_format, credit_balance")
        .eq("id", user.id).single();

      if (!active) return;

      // Profile missing: send to onboarding to create it
      if (!profile) {
        router.replace("/onboarding/student");
        return;
      }

      if (profile.role !== "student") { router.replace("/dashboard"); return; }

      if (!profile.onboarding_completed) {
        router.replace("/onboarding/student");
        return;
      }

      if (profile.full_name) setName(profile.full_name.split(" ")[0]);
      setCreditBalance(profile.credit_balance ?? 0);

      // Parent invitations
      const { data: invData } = await supabase
        .from("parent_invitations")
        .select(`id, status, created_at, profiles!parent_id(id, full_name)`)
        .eq("student_id", user.id)
        .eq("status", "pending");
      if (invData) setInvitations(invData);

      // Personalized recommendations
      if (profile.preferred_subjects?.length > 0) {
        let query = supabase
          .from("tutors")
          .select("id, photo_url, price_per_hour, rating, review_count, subject, is_online, is_offline, city, profiles!id(full_name, avatar_url)")
          .eq("is_verified", true)
          .overlaps("subject", profile.preferred_subjects)
          .order("rating", { ascending: false })
          .limit(6);
        if (profile.preferred_format === "online")  query = query.eq("is_online", true);
        if (profile.preferred_format === "offline") query = query.eq("is_offline", true);
        const { data: recs } = await query;
        if (recs) setRecommended(recs);
      }

      await loadData(user.id);
    }

    init();

    const channel = supabase
      .channel("student_inv_realtime")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"parent_invitations" }, () => { init(); })
      .subscribe();

    const dataChannel = supabase
      .channel("student_dash_realtime")
      .on("postgres_changes", { event:"*",    schema:"public", table:"bookings" }, () => { if (uid) loadData(uid); })
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages" }, () => { if (uid) loadData(uid); })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(dataChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respondToInvitation(inv, accept) {
    setInvLoading(p => ({ ...p, [inv.id]: true }));

    await fetch("/api/respond-invitation", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ invitationId: inv.id, accept }),
    });

    setInvitations(prev => prev.filter(i => i.id !== inv.id));
    setInvLoading(p => ({ ...p, [inv.id]: false }));
  }

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">

      <DashboardSidebar role="student" userName={name} />

      <main className="p-6 md:p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              გამარჯობა, {name || "სტუდენტო"}! 🎓
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{today}</p>
          </div>
          <Link href="/search" className="btn-primary">
            + მასწავლებლის პოვნა
          </Link>
        </div>

        {/* Parent invitation banners */}
        {invitations.length > 0 && (
          <div className="space-y-3 mb-6">
            {invitations.map(inv => {
              const parentName = inv.profiles?.full_name || "მშობელი";
              const busy = invLoading[inv.id];
              return (
                <div key={inv.id}
                  className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      👨‍👩‍👧
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">
                        მშობელი <span className="text-blue-700">{parentName}</span> ითხოვს თქვენს ანგარიშთან დაკავშირებას
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        დადასტურების შემდეგ მშობელს შეეძლება შენი გაკვეთილების ნახვა
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => respondToInvitation(inv, true)}
                      disabled={busy}
                      className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all disabled:opacity-50">
                      {busy ? "..." : "✓ დადასტურება"}
                    </button>
                    <button
                      onClick={() => respondToInvitation(inv, false)}
                      disabled={busy}
                      className="text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all disabled:opacity-50">
                      ✕ უარი
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {loading
            ? Array(4).fill(0).map((_,i) => (
                <div key={i} className="stat-card animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-7 bg-gray-200 rounded w-1/3 mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              ))
            : <>
                {[
                  { value: stats.totalLessons,    label:"ჩატარებული გაკვეთ.", sub:"📚" },
                  { value: stats.activeTutors,    label:"აქტ. მასწავლებელი",  sub:"👨‍🏫" },
                  { value:`${stats.totalHours}სთ`,label:"სასწავლო საათი",     sub:"⏱️" },
                ].map((s,i) => (
                  <div key={i} className="stat-card">
                    <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                    <p className="text-2xl font-black text-gray-900">{s.value}</p>
                    <p className="text-lg mt-0.5">{s.sub}</p>
                  </div>
                ))}
                <div className="stat-card border-emerald-200 bg-emerald-50">
                  <p className="text-xs text-emerald-600 mb-1">კრედიტ-საფულე</p>
                  <p className="text-2xl font-black text-emerald-700">
                    {creditBalance !== null ? `${Number(creditBalance).toFixed(2)} ₾` : "—"}
                  </p>
                  <p className="text-lg mt-0.5">💳</p>
                </div>
              </>
          }
        </div>
{/* Next Lesson Hero */}
{!loading && upcomingLessons.length > 0 && (
  <div className="card p-6 mb-8 bg-gradient-to-r from-emerald-500 to-emerald-600 text-black">
    <p className="text-sm opacity-90 mb-2">
      🎯 შემდეგი გაკვეთილი
    </p>

    <h2 className="text-2xl font-black mb-2">
      {Array.isArray(upcomingLessons[0]?.tutors?.subject)
        ? upcomingLessons[0].tutors.subject[0]
        : upcomingLessons[0]?.tutors?.subject}
    </h2>

    <p className="text-lg">
      👨‍🏫{" "}
      <Link href={`/tutors/${upcomingLessons[0]?.tutors?.id}`} className="hover:underline">
        {upcomingLessons[0]?.tutors?.profiles?.full_name}
      </Link>
    </p>

    <p className="mt-2 opacity-90">
      📅 {upcomingLessons[0]?.date} • ⏰ {upcomingLessons[0]?.time_slot}
    </p>
    {/* ─── სასწავლო პროგრესი — Variant A ─── */}

    <div className="mt-5">
      <Link
        href="/dashboard/student/lessons"
        className="bg-white text-emerald-600 px-4 py-2 rounded-xl font-semibold"
      >
        დეტალების ნახვა →
      </Link>
    </div>
  </div>
)}
        <div className="grid md:grid-cols-2 gap-6 mb-6">

          {/* მომავალი გაკვეთილები */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">📅 მომავალი გაკვეთილები</h2>
              <Link href="/dashboard/student/lessons" className="text-sm text-emerald-600">ყველა →</Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : upcomingLessons.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">გაკვეთილები არ არის</p>
                <Link href="/search" className="text-emerald-600 text-sm font-medium mt-2 block">
                  მასწავლებლის პოვნა →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingLessons.map(l => (
                  <div key={l.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {Array.isArray(l.tutors?.subject)
                          ? l.tutors.subject[0]
                          : l.tutors?.subject} —{" "}
                        <Link href={`/tutors/${l.tutors?.id}`} className="hover:underline hover:text-emerald-700">
                          {l.tutors?.profiles?.full_name}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {l.date} {l.time_slot}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={l.status === "confirmed" ? "badge-green" : "badge-blue"}>
                        {l.status === "confirmed" ? "დადასტ." : "მოლოდ."}
                      </span>
                      {l.status === "confirmed" && l.format === "online" && (
                        <button
                          onClick={() => router.push(`/lesson/${l.id}`)}
                          className="btn-primary text-xs py-1 px-2"
                        >
                          შეერთება →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* შეტყობინებები */}
          <div className="card p-6">
           <div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    <h2 className="font-bold text-gray-900">💬 შეტყობინებები</h2>
    {unreadCount > 0 && (
      <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
        {unreadCount}
      </span>
    )}
  </div>
  <Link href="/messages" className="text-sm text-emerald-600">ყველა →</Link>
</div>
            {loading ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : recentMessages.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">შეტყობინებები არ არის</p>
            ) : (
              <div className="space-y-3">
                {recentMessages.map(msg => {
  const senderName = msg.profiles?.full_name || msg["profiles!messages_sender_id_fkey"]?.full_name || "უცნობი";
  return (
    <Link key={msg.id} href="/messages"
      className={`flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50 transition-colors ${
        !msg.seen ? "bg-blue-50 border border-blue-100" : "bg-gray-50"
      }`}>
      <div className="relative flex-shrink-0">
        <div className="avatar w-8 h-8 avatar-green text-xs">
          {senderName?.[0] || "?"}
        </div>
        {!msg.seen && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${!msg.seen ? "text-gray-900" : "text-gray-500"}`}>
          {senderName}
        </p>
        <p className="text-xs text-gray-400 truncate mt-0.5">{msg.content}</p>
      </div>
      {!msg.seen && (
        <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-1" />
      )}
    </Link>
  );
})}
              </div>
            )}
          </div>
        </div>
{/* Quick Actions */}
<div className="grid sm:grid-cols-3 gap-4 mb-6">

  <Link
    href="/search"
    className="card p-5 text-center hover:shadow-lg transition"
  >
    <div className="text-3xl mb-2">➕</div>
    <p className="font-bold">ახალი გაკვეთილი</p>
  </Link>

  <Link
    href="/dashboard/student/lessons"
    className="card p-5 text-center hover:shadow-lg transition"
  >
    <div className="text-3xl mb-2">🔄</div>
    <p className="font-bold">ჩემი განრიგი</p>
  </Link>

  <Link
    href="/dashboard/student/payments"
    className="card p-5 text-center hover:shadow-lg transition"
  >
    <div className="text-3xl mb-2">💳</div>
    <p className="font-bold">გადახდები</p>
  </Link>

</div>
{/* Active Packages */}
{packages.length > 0 && (
  <div className="card p-6 mb-6">
    <h2 className="font-bold text-gray-900 mb-4">
      📦 აქტიური პაკეტები
    </h2>

    <div className="space-y-4">
      {packages.map(pkg => {
        const percent =
          pkg.total_sessions > 0
            ? Math.round((pkg.sessions_used / pkg.total_sessions) * 100)
            : 0;

        return (
          <div key={pkg.id}>
            <div className="flex justify-between text-sm mb-2">
              <span>{pkg.months} თვიანი პაკეტი</span>
              <span>
                {pkg.sessions_used} / {pkg.total_sessions}
              </span>
            </div>

            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${percent}%` }}
              />
            </div>

            <p className="text-xs text-gray-500 mt-2">
              აქტიურია: {pkg.ends_at}
            </p>
          </div>
        );
      })}
    </div>
  </div>
)}
        {/* ─── სასწავლო პროგრესი — Variant A ─── */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-gray-900">📈 სასწავლო პროგრესი</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                მიზანი: {LESSON_GOAL} გაკვეთილი თითო საგანში
              </p>
            </div>
            <Link href="/dashboard/student/lessons"
              className="text-sm text-emerald-600 font-medium">
              ისტორია →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-5">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="flex gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-gray-200" />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1.5">
                        <div className="h-3.5 bg-gray-200 rounded w-1/4" />
                        <div className="h-3.5 bg-gray-200 rounded w-1/6" />
                      </div>
                      <div className="h-2.5 bg-gray-200 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : progress.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                🌱
              </div>
              <p className="font-semibold text-gray-700 mb-1">სწავლა ჯერ არ დაწყებულა</p>
              <p className="text-sm text-gray-400 mb-5">
                პირველი გაკვეთილის შემდეგ პროგრესი გამოჩნდება
              </p>
              <Link href="/search" className="btn-primary px-6">
                მასწავლებლის პოვნა →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5">
              {progress.map(({ subject, count, tutorName }) => {
                const pct   = Math.min(Math.round((count / LESSON_GOAL) * 100), 100);
                const icon  = SUBJECT_ICONS[subject] || "📘";
                const color = SUBJECT_COLORS[subject] || DEFAULT_COLOR;
                const rank  = getRank(count);
                const done  = count >= LESSON_GOAL;

                return (
                  <div key={subject}>
                    {/* Icon + name row */}
                    <div className="flex items-center gap-3 mb-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: color.bg }}
                      >
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {subject}
                            </span>
                            {tutorName && (
                              <span className="text-xs text-gray-400 truncate hidden sm:inline">
                                · {tutorName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-400">
                              {count} / {LESSON_GOAL}
                            </span>
                            <span
                              className="text-xs font-bold"
                              style={{ color: color.bar }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <span className="text-xs" style={{ color: color.bar }}>
                          {rank}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width:`${pct}%`, background: color.bar }}
                      />
                    </div>

                    {/* Milestones */}
                    <div className="flex justify-between mt-1">
                      {[0, 25, 50, 75, 100].map(m => (
                        <span
                          key={m}
                          className="text-[9px]"
                          style={{ color: pct >= m ? color.bar : "#D1D5DB" }}
                        >
                          {m === 0 ? "" : `${m}%`}
                        </span>
                      ))}
                    </div>

                    {done && (
                      <p className="text-xs font-semibold text-emerald-600 mt-1">
                        ✅ მიზანი მიღწეულია!
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary footer */}
          {!loading && progress.length > 0 && (
            <div className="flex gap-6 pt-5 mt-5 border-t border-gray-100">
              <div className="text-center">
                <p className="text-xl font-black text-gray-900">
                  {progress.filter(p => p.count >= LESSON_GOAL).length}
                </p>
                <p className="text-xs text-gray-400">დასრულებული საგანი</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-gray-900">
                  {progress.filter(p => p.count > 0 && p.count < LESSON_GOAL).length}
                </p>
                <p className="text-xs text-gray-400">მიმდინარე</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-gray-900">
                  {progress.reduce((s, p) => s + p.count, 0)}
                </p>
                <p className="text-xs text-gray-400">სულ გაკვეთილი</p>
              </div>
            </div>
          )}
        </div>

        {/* ─── პერსონალიზებული რეკომენდაციები ─── */}
        {recommended.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">✨ შენთვის რეკომენდებული</h2>
                <p className="text-xs text-gray-400 mt-0.5">შენი პრეფერენციების მიხედვით</p>
              </div>
              <Link href="/search" className="text-sm text-emerald-600 font-medium">ყველა →</Link>
            </div>
            <div className="grid gap-3">
              {recommended.map(t => {
                const name = t.profiles?.full_name || "მასწავლებელი";
                const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                const stars = Math.round(t.rating || 0);
                return (
                  <Link key={t.id} href={`/booking/${t.id}`}
                    className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                    {(t.profiles?.avatar_url || t.photo_url)
                      ? <img src={t.profiles?.avatar_url || t.photo_url} alt={name}
                          className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      : <div className="avatar w-12 h-12 text-sm avatar-green flex-shrink-0">{initials}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {(t.subject || []).slice(0, 2).map(s => (
                          <span key={s} className="badge-green text-xs">{s}</span>
                        ))}
                        {t.is_online && <span className="badge-blue text-xs">🌐</span>}
                        {t.is_offline && <span className="badge-amber text-xs">🏫</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-amber-400 text-xs">{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>
                        <span className="text-xs text-gray-400">({t.review_count ?? 0})</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-black text-gray-900">{t.price_per_hour} ₾</p>
                      <p className="text-xs text-gray-400">/სთ</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}