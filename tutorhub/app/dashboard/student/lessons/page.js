"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { containsProfanity } from "@/lib/reviewUtils";

// ─── helpers ────────────────────────────────────────────────────────────────
function getBookingSubject(note, tutorSubjects) {
  if (note) { const m = note.match(/^\[S:([^\]]+)\]/); if (m) return m[1]; }
  return Array.isArray(tutorSubjects) ? tutorSubjects[0] : tutorSubjects;
}

function canCancel(lesson) {
  if (lesson.status === "pending") return true;
  if (!lesson.date || !lesson.time_slot) return false;
  return (new Date(`${lesson.date}T${lesson.time_slot}:00`) - new Date()) / 3600000 > 24;
}

function hoursAgo(isoStr) {
  if (!isoStr) return 0;
  return Math.floor((Date.now() - new Date(isoStr)) / 3600000);
}

function relativeTime(date, time, now) {
  if (!date) return null;
  const d = new Date(`${date}T${time || "00:00"}`);
  const diffMin = Math.round((d - now) / 60000);
  const diffHrs = Math.floor((d - now) / 3600000);
  const diffDays = Math.floor((d - now) / 86400000);
  if (diffMin <= 0) return null;
  if (diffMin < 60) return `${diffMin} წუთში`;
  if (diffHrs < 24) return `${diffHrs} საათში`;
  if (diffDays === 1) return `ხვალ ${(time || "").slice(0, 5)}`;
  const days = ["კვირა", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"];
  if (diffDays < 7) return `${days[d.getDay()]} ${(time || "").slice(0, 5)}`;
  return d.toLocaleDateString("ka-GE", { day: "numeric", month: "long" }) + ` ${(time || "").slice(0, 5)}`;
}

function formatDateFull(date, time) {
  if (!date) return "";
  const d = new Date(`${date}T${time || "00:00"}`);
  if (isNaN(d)) return `${date} ${time}`;
  return d.toLocaleString("ka-GE", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function avatarColor(name) {
  const colors = [
    "bg-emerald-100 text-emerald-800",
    "bg-blue-100 text-blue-800",
    "bg-purple-100 text-purple-800",
    "bg-amber-100 text-amber-800",
    "bg-orange-100 text-orange-800",
  ];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
}

const BOOKING_TYPE_LABEL = {
  trial:     { label: "სატესტო", cls: "bg-emerald-100 text-emerald-700" },
  single:    { label: "ერთჯ.",   cls: "bg-gray-100 text-gray-600" },
  package:   { label: "პაკეტი", cls: "bg-purple-100 text-purple-700" },
  group:     { label: "ჯგუფი",  cls: "bg-blue-100 text-blue-700" },
  recurring: { label: "რეგულ.", cls: "bg-indigo-100 text-indigo-700" },
};

const TABS = [
  { key: "upcoming",           label: "მომავალი" },
  { key: "completed_by_tutor", label: "დადასტ. საჭიროა" },
  { key: "past",               label: "დასრულებული" },
  { key: "cancelled",          label: "გაუქმებული" },
];

const STATUS_MAP = {
  upcoming:           ["confirmed", "pending"],
  completed_by_tutor: ["completed_by_tutor"],
  past:               ["done"],
  cancelled:          ["cancelled", "disputed"],
};

const EMPTY_MESSAGES = {
  upcoming:           { icon: "📅", text: "მომავალი გაკვეთილი არ გაქვს", cta: true },
  completed_by_tutor: { icon: "⏳", text: "დასადასტურებელი გაკვეთილი არ არის", cta: false },
  past:               { icon: "🎓", text: "დასრულებული გაკვეთილი არ გაქვს", cta: true },
  cancelled:          { icon: "🚫", text: "გაუქმებული გაკვეთილი არ გაქვს", cta: false },
};

// ─── main component ─────────────────────────────────────────────────────────
function LessonsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [studentId, setStudentId]     = useState(null);
  const [studentName, setStudentName] = useState("");
  const [tab, setTab]                 = useState(searchParams.get("tab") === "past" ? "past" : "upcoming");
  const [lessons, setLessons]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [stats, setStats]             = useState({ upcoming: 0, done: 0, totalSpent: 0 });
  const [nextLesson, setNextLesson]   = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [reviewsMap, setReviewsMap]   = useState({});
  const [now, setNow]                 = useState(new Date());

  // modals
  const [reviewLesson, setReviewLesson]         = useState(null);
  const [rating, setRating]                     = useState(5);
  const [comment, setComment]                   = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [disputeLesson, setDisputeLesson]         = useState(null);
  const [disputeType, setDisputeType]             = useState("");
  const [disputeReason, setDisputeReason]         = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const [cancelModal, setCancelModal] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState("");

  const [reportedReplies, setReportedReplies] = useState(new Set());

  const [alert, setAlert] = useState(null);

  // live clock — updates every 60s for countdown display
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (searchParams.get("updated") === "1") {
      setAlert({ type: "success", msg: "ჯავშანი განახლდა!" });
      const t = setTimeout(() => setAlert(null), 4000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => { const user = session?.user;
      if (!user) { router.push("/auth"); return; }
      setStudentId(user.id);
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single()
        .then(({ data }) => {
          if (data?.role !== "student") { router.push("/dashboard"); return; }
          if (data?.full_name) setStudentName(data.full_name.split(" ")[0]);
        });
    });
  }, [router]);

  async function fetchStats(uid) {
    const supabase = createClient();
    const [{ count: upCount }, { count: doneCount }, { data: spentData }] = await Promise.all([
      supabase.from("bookings").select("*", { count: "exact", head: true })
        .eq("student_id", uid).in("status", ["confirmed", "pending"]),
      supabase.from("bookings").select("*", { count: "exact", head: true })
        .eq("student_id", uid).eq("status", "done"),
      supabase.from("bookings").select("total_price")
        .eq("student_id", uid).eq("status", "done"),
    ]);
    const total = spentData?.reduce((s, b) => s + (b.total_price || 0), 0) || 0;
    setStats({ upcoming: upCount || 0, done: doneCount || 0, totalSpent: total });
  }

  async function fetchCompletedCount(uid) {
    const supabase = createClient();
    const { count } = await supabase.from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("student_id", uid).eq("status", "completed_by_tutor");
    setCompletedCount(count || 0);
  }

  async function fetchNextLesson(uid) {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("bookings")
      .select("id, date, time_slot, status, tutor_id, note, tutors(subject, profiles(full_name))")
      .eq("student_id", uid).eq("status", "confirmed")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time_slot", { ascending: true })
      .limit(1);
    setNextLesson(data?.[0] || null);
  }

  const loadData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const [{ data: lessonsData }, { data: reviewsData }] = await Promise.all([
        supabase.from("bookings")
          .select(`
            id, date, time_slot, status, tutor_id,
            completed_by_tutor_at, booking_type, total_price,
            format, duration_hours, note,
            tutors(id, subject, profiles(full_name))
          `)
          .eq("student_id", studentId)
          .in("status", STATUS_MAP[tab])
          .order("date", { ascending: tab === "upcoming" }),
        supabase.from("reviews").select("booking_id, rating, comment, tutor_reply")
          .eq("student_id", studentId),
      ]);
      const map = {};
      reviewsData?.forEach(r => { map[r.booking_id] = r; });
      setReviewsMap(map);
      setLessons(lessonsData || []);
    } catch (err) {
      console.error("Error fetching lessons:", err);
    } finally {
      setLoading(false);
    }
  }, [studentId, tab]);

  useEffect(() => {
    if (!studentId) return;
    loadData();
    fetchCompletedCount(studentId);
    fetchStats(studentId);
    fetchNextLesson(studentId);
  }, [loadData, studentId]);

  // auto-refresh every 30s
  useEffect(() => {
    if (!studentId) return;
    const t = setInterval(() => {
      loadData();
      fetchCompletedCount(studentId);
    }, 30000);
    return () => clearInterval(t);
  }, [loadData, studentId]);

  async function confirmLesson(bookingId) {
    const res = await fetch(`/api/bookings/${bookingId}/student-confirm`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setAlert({ type: "error", msg: data.error || "შეცდომა" });
    } else {
      setAlert({ type: "success", msg: "გაკვეთილი დადასტურდა! გადახდა გამოგზავნილია მასწავლებელთან." });
      loadData();
      fetchStats(studentId);
      fetchCompletedCount(studentId);
    }
    setTimeout(() => setAlert(null), 3000);
  }

  async function submitDispute(e) {
    e.preventDefault();
    if (!disputeType) return;
    setSubmittingDispute(true);
    const supabase = createClient();
    const fullReason = disputeReason.trim()
      ? `${disputeType}: ${disputeReason.trim()}`
      : disputeType;
    const { error } = await supabase.from("disputes").insert({
      booking_id: disputeLesson.id, student_id: studentId,
      tutor_id: disputeLesson.tutor_id, reason: fullReason, status: "open",
    });
    if (!error) {
      await supabase.from("bookings").update({
        status: "disputed", dispute_reason: fullReason,
        disputed_at: new Date().toISOString(),
      }).eq("id", disputeLesson.id);
    }
    setSubmittingDispute(false);
    if (error) {
      setAlert({ type: "error", msg: "გასაჩივრება ვერ მოხერხდა" });
    } else {
      setDisputeLesson(null);
      setDisputeType("");
      setDisputeReason("");
      setAlert({ type: "success", msg: "გასაჩივრება გაიგზავნა — ადმინი განიხილავს" });
      loadData();
      fetchCompletedCount(studentId);
    }
    setTimeout(() => setAlert(null), 5000);
  }

  async function cancelLesson(lesson) {
    setCancellingId(lesson.id);
    setCancelError("");
    try {
      const res = await fetch(`/api/bookings/${lesson.id}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCancelError(data.error || "გაუქმება ვერ მოხერხდა. სცადეთ ხელახლა.");
      } else {
        setLessons(prev => prev.filter(l => l.id !== lesson.id));
        fetchCompletedCount(studentId);
        fetchStats(studentId);
        fetchNextLesson(studentId);
        setCancelModal(null);
        if (data.credit_refunded) {
          setAlert({ type: "success", msg: `გაუქმდა — ${data.credit_refunded} ₾ კრედიტი დაბრუნდა` });
          setTimeout(() => setAlert(null), 4000);
        }
      }
    } catch {
      setCancelError("კავშირის შეცდომა. სცადეთ ხელახლა.");
    }
    setCancellingId(null);
  }

  async function reportTutorReply(bookingId) {
    const supabase = createClient();
    const { error } = await supabase.from("reviews")
      .update({
        is_reported: true,
        report_reason: "სტუდენტი: მასწავლებლის პასუხი შეუფერებელია",
      })
      .eq("booking_id", bookingId)
      .eq("student_id", studentId);
    if (!error) {
      setReportedReplies(prev => new Set([...prev, bookingId]));
      setAlert({ type: "success", msg: "🚩 შეტყობინება გაიგზავნა — ადმინი განიხილავს" });
      setTimeout(() => setAlert(null), 4000);
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    if (containsProfanity(comment)) {
      setAlert({ type: "error", msg: "კომენტარი შეიცავს შეუფერებელ სიტყვებს — გთხოვთ შეცვალოთ." });
      setTimeout(() => setAlert(null), 4000);
      return;
    }
    setSubmittingReview(true);
    const supabase = createClient();
    const { error } = await supabase.from("reviews").upsert({
      student_id: studentId, tutor_id: reviewLesson.tutor_id,
      booking_id: reviewLesson.id, rating, comment,
    }, { onConflict: "booking_id" });
    setSubmittingReview(false);
    if (error) {
      setAlert({ type: "error", msg: "შეფასება ვერ გაიგზავნა" });
    } else {
      setReviewLesson(null);
      setAlert({ type: "success", msg: "შეფასება გაიგზავნა!" });
      loadData();
    }
    setTimeout(() => setAlert(null), 3000);
  }

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="student" userName={studentName} />

      <main className="p-6 md:p-8">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-black text-gray-900 mb-1">📅 ჩემი გაკვეთილები</h1>
          {studentName && <p className="text-sm text-gray-400 mb-5">გამარჯობა, {studentName}!</p>}

          {alert && (
            <div className={`text-sm px-4 py-3 rounded-xl mb-5 border ${
              alert.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {alert.type === "success" ? "✅" : "❌"} {alert.msg}
            </div>
          )}

          {/* ─── Stats bar ─── */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
              <p className="text-2xl font-black text-emerald-600">{stats.upcoming}</p>
              <p className="text-xs text-gray-400 mt-0.5">მომავალი</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
              <p className="text-2xl font-black text-gray-800">{stats.done}</p>
              <p className="text-xs text-gray-400 mt-0.5">დასრულებული</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
              <p className="text-2xl font-black text-gray-800">
                {stats.totalSpent > 0 ? `${stats.totalSpent}₾` : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">სულ გადახდილი</p>
            </div>
          </div>

          {/* ─── Next lesson banner ─── */}
          {nextLesson && (() => {
            const rel = relativeTime(nextLesson.date, nextLesson.time_slot, now);
            const subj = getBookingSubject(nextLesson.note, nextLesson.tutors?.subject);
            const isImminent = rel?.includes("წუთში") || rel?.includes("საათ");
            return (
              <div className={`rounded-2xl p-4 mb-5 flex items-center justify-between gap-3 shadow-md ${
                isImminent
                  ? "bg-emerald-700 animate-pulse-subtle"
                  : "bg-emerald-600"
              }`}>
                <div>
                  <p className="text-xs font-medium text-emerald-200 mb-0.5">შემდეგი გაკვეთილი</p>
                  <p className="font-bold text-white text-base">
                    {subj} · {nextLesson.tutors?.profiles?.full_name}
                  </p>
                  <p className="text-sm text-emerald-200 mt-0.5">
                    {rel || formatDateFull(nextLesson.date, nextLesson.time_slot)}
                    {isImminent && " ⚡"}
                  </p>
                </div>
                <Link href={`/lesson/${nextLesson.id}`}
                  className="shrink-0 bg-white text-emerald-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-emerald-50 transition-colors">
                  შეერთება →
                </Link>
              </div>
            );
          })()}

          {/* ─── Tabs ─── */}
          <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  tab === t.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}>
                {t.label}
                {t.key === "completed_by_tutor" && completedCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full">
                    {completedCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ─── Lesson list ─── */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : lessons.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">{EMPTY_MESSAGES[tab].icon}</p>
              <p className="text-gray-600 font-semibold mb-1">{EMPTY_MESSAGES[tab].text}</p>
              {EMPTY_MESSAGES[tab].cta && (
                <Link href="/search"
                  className="inline-block mt-3 btn-primary text-sm px-5 py-2.5">
                  მასწავლებლის ძიება →
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map(lesson => {
                const tutorName = lesson.tutors?.profiles?.full_name || "მასწავლებელი";
                const subject   = getBookingSubject(lesson.note, lesson.tutors?.subject);
                const isPending   = lesson.status === "pending";
                const isConfirmed = lesson.status === "confirmed";
                const isCompleted = lesson.status === "completed_by_tutor";
                const isReviewed  = !!reviewsMap[lesson.id];
                const cancellable = canCancel(lesson);
                const rel         = relativeTime(lesson.date, lesson.time_slot, now);
                const elapsed     = hoursAgo(lesson.completed_by_tutor_at);
                const timeLeft    = Math.max(0, 24 - elapsed);
                const typeInfo    = BOOKING_TYPE_LABEL[lesson.booking_type];
                const isImminent  = rel?.includes("წუთში") || (rel?.includes("საათ") && parseInt(rel) <= 2);

                const borderCls = isCompleted
                  ? "border-amber-200 bg-amber-50/30"
                  : isPending
                  ? "border-blue-200 bg-blue-50/20"
                  : isImminent
                  ? "border-emerald-300 bg-emerald-50/20"
                  : "";

                return (
                  <div key={lesson.id}
                    className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm transition-all ${borderCls}`}>
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${avatarColor(tutorName)}`}>
                        {getInitials(tutorName)}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Name + price */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link href={`/tutors/${lesson.tutor_id}`}
                              className="font-bold text-gray-900 text-sm leading-tight hover:text-emerald-600 hover:underline transition-colors">
                              {tutorName}
                            </Link>
                            <p className="text-xs text-gray-500 mt-0.5">{subject}</p>
                          </div>
                          {lesson.total_price > 0 && (
                            <p className="font-bold text-gray-800 text-sm shrink-0">{lesson.total_price}₾</p>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {typeInfo && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.cls}`}>
                              {typeInfo.label}
                            </span>
                          )}
                          {lesson.format === "online" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                              🌐 ონლაინ
                            </span>
                          )}
                          {lesson.format === "offline" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">
                              🏠 ოფლაინ
                            </span>
                          )}
                          {lesson.duration_hours && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                              ⏱ {lesson.duration_hours}სთ
                            </span>
                          )}
                          {isPending && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                              ⏳ ელოდება დასტურს
                            </span>
                          )}
                          {isReviewed && lesson.status === "done" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                              ⭐ შეფ. გაიგზავნა
                            </span>
                          )}
                        </div>

                        {/* Date + countdown */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-gray-400">
                            {formatDateFull(lesson.date, lesson.time_slot)}
                          </span>
                          {rel && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isImminent
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                              {rel}
                            </span>
                          )}
                        </div>

                        {/* Note */}
                        {lesson.note && (
                          <p className="mt-1.5 text-xs text-gray-400 italic truncate">{lesson.note}</p>
                        )}

                        {/* Completed_by_tutor notice */}
                        {isCompleted && (
                          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-xs font-semibold text-amber-800">
                              {timeLeft > 0
                                ? `⏰ გასაჩივრებლად გაქვს ${timeLeft} საათი — თუ ყველაფერი კარგად იყო, დაადასტურე.`
                                : "ვადა ამოიწურა — ავტომატ. დადასტურდება."}
                            </p>
                          </div>
                        )}

                        {/* Tutor reply to student's review */}
                        {isReviewed && reviewsMap[lesson.id]?.tutor_reply && (
                          <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[11px] font-semibold text-emerald-700">
                                💬 მასწავლებლის პასუხი შეფასებაზე
                              </p>
                              {!reportedReplies.has(lesson.id) ? (
                                <button
                                  onClick={() => reportTutorReply(lesson.id)}
                                  className="text-[10px] text-red-400 hover:text-red-600 border border-red-200 hover:bg-red-50 px-2 py-0.5 rounded-lg transition-all">
                                  🚩 რეპორტი
                                </button>
                              ) : (
                                <span className="text-[10px] text-red-400">🚩 გაიგზავნა</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed">
                              {reviewsMap[lesson.id].tutor_reply}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 justify-end mt-3 flex-wrap">
                      {isCompleted && (
                        <>
                          <button onClick={() => confirmLesson(lesson.id)}
                            className="btn-primary text-xs px-4 py-1.5">
                            ✓ დადასტ.
                          </button>
                          <button
                            onClick={() => { setDisputeLesson(lesson); setDisputeType(""); setDisputeReason(""); }}
                            className="text-xs text-red-500 border border-red-200 px-4 py-1.5 rounded-xl hover:bg-red-50 transition-all">
                            ⚠️ პრობლემა
                          </button>
                        </>
                      )}

                      {/* Dispute on past confirmed lesson (teacher didn't show) */}
                      {isConfirmed && lesson.date && new Date(`${lesson.date}T${lesson.time_slot}:00`) < new Date() && (
                        <button
                          onClick={() => { setDisputeLesson(lesson); setDisputeType("მასწავლებელი არ გამოცხადდა"); setDisputeReason(""); }}
                          className="text-xs text-orange-500 border border-orange-200 px-4 py-1.5 rounded-xl hover:bg-orange-50 transition-all">
                          ⚠️ პრობლემა
                        </button>
                      )}

                      {lesson.status === "done" && lesson.tutor_id && (() => {
                        const rev = reviewsMap[lesson.id];
                        const hasReply = !!rev?.tutor_reply;
                        if (hasReply) return (
                          <span className="text-xs text-gray-400 self-center">
                            ✍️ რედაქტ. დაბლ.
                          </span>
                        );
                        return (
                          <button
                            onClick={() => {
                              setReviewLesson(lesson);
                              setRating(rev?.rating ?? 5);
                              setComment(rev?.comment ?? "");
                            }}
                            className={`text-xs px-4 py-1.5 rounded-xl font-medium text-white transition-all ${
                              isReviewed ? "bg-blue-500 hover:bg-blue-600" : "bg-amber-500 hover:bg-amber-600"
                            }`}>
                            {isReviewed ? "✍️ რედ." : "⭐ შეფ."}
                          </button>
                        );
                      })()}

                      {isConfirmed && (
                        <Link href={`/lesson/${lesson.id}`}
                          className="btn-primary text-xs px-4 py-1.5">
                          შეერთება →
                        </Link>
                      )}

                      {(isPending || isConfirmed) && (
                        cancellable ? (
                          <button
                            onClick={() => setCancelModal(lesson)}
                            disabled={cancellingId === lesson.id}
                            className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-4 py-1.5 rounded-xl hover:bg-red-50 transition-all">
                            {cancellingId === lesson.id ? "..." : "გაუქმება"}
                          </button>
                        ) : (
                          <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 leading-snug">
                            ❌ გაუქმება შეუძლებელია — 24 სთ-ზე ნაკლებია, თანხა არ დაბრუნდება
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ─── Cancel Modal ─── */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <p className="text-lg font-black text-gray-900 mb-1">ჯავშნის გაუქმება</p>
            <p className="text-sm text-gray-500 mb-4">
              ნამდვილად გინდა გააუქმო{" "}
              <span className="font-semibold text-gray-800">
                {getBookingSubject(cancelModal.note, cancelModal.tutors?.subject)}
              </span>{" "}
              — <span className="font-semibold">{cancelModal.tutors?.profiles?.full_name}</span>-თან?
            </p>
            {cancelError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-xl mb-4">
                ❌ {cancelError}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setCancelModal(null); setCancelError(""); }} className="flex-1 btn-secondary py-2.5">
                არა
              </button>
              <button
                onClick={() => cancelLesson(cancelModal)}
                disabled={cancellingId === cancelModal.id}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                {cancellingId === cancelModal.id ? "..." : cancelError ? "ხელახლა ცდა" : "კი, გავაუქმო"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Review Modal ─── */}
      {reviewLesson && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 mb-1">⭐ შეფასება</h3>
            <p className="text-sm text-gray-400 mb-4">{reviewLesson.tutors?.profiles?.full_name}</p>
            <form onSubmit={submitReview} className="space-y-4">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} type="button" onClick={() => setRating(s)}
                    className="text-3xl hover:scale-110 transition-transform">
                    {s <= rating ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder="თქვენი შთაბეჭდილება..." className="input resize-none h-24" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setReviewLesson(null)}
                  className="flex-1 btn-secondary py-2.5">გაუქმება</button>
                <button type="submit" disabled={submittingReview}
                  className="flex-1 btn-primary py-2.5">
                  {submittingReview ? "იგზავნება..." : "შენახვა"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Dispute Modal ─── */}
      {disputeLesson && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 mb-1">⚠️ პრობლემის შეტყობინება</h3>
            <p className="text-sm text-gray-400 mb-4">{disputeLesson.tutors?.profiles?.full_name}</p>

            <form onSubmit={submitDispute} className="space-y-4">
              {/* Reason type cards */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">პრობლემის ტიპი *</p>
                <div className="space-y-2">
                  {[
                    { key: "მასწავლებელი არ გამოცხადდა", icon: "🚫", desc: "მასწავლებელი გაკვეთილზე არ მოვიდა" },
                    { key: "გაკვეთილი არ ჩატარდა / არაპროფ. მიდგომა", icon: "📉", desc: "გაკვეთილი ვერ ჩატარდა ან ხარისხი არ შეესაბამება" },
                    { key: "ტექნიკური ხარვეზები", icon: "🔧", desc: "კავშირის ან ტექნიკური პრობლემა" },
                  ].map(opt => (
                    <label key={opt.key}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        disputeType === opt.key
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <input
                        type="radio"
                        name="disputeType"
                        value={opt.key}
                        checked={disputeType === opt.key}
                        onChange={() => setDisputeType(opt.key)}
                        className="mt-0.5 accent-red-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{opt.icon} {opt.key}</p>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  დეტალური აღწერა (სურვ.)
                </label>
                <textarea
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  placeholder="მოკლედ აღწერეთ რა მოხდა..."
                  className="input resize-none h-20 text-sm"
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                📋 განაჩენი გადაიგზავნება ადმინისტრატორთან. გაკვეთილის ლოგები შემოწმდება.
              </div>

              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setDisputeLesson(null); setDisputeType(""); setDisputeReason(""); }}
                  className="flex-1 btn-secondary py-2.5">
                  გაუქმება
                </button>
                <button type="submit"
                  disabled={submittingDispute || !disputeType}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                  {submittingDispute ? "იგზავნება..." : "⚠️ გაგზავნა"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LessonsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LessonsContent />
    </Suspense>
  );
}
