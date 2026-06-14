"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

// ─── helpers ────────────────────────────────────────────────────────────────
function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function fmtDate(date, time) {
  if (!date) return "";
  const d = new Date(`${date}T${time || "00:00"}`);
  if (isNaN(d)) return `${date} ${time || ""}`;
  return d.toLocaleString("ka-GE", {
    weekday: "short", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}

function countdownText(date, time) {
  if (!date) return null;
  const d = new Date(`${date}T${time || "00:00"}`);
  const diffMin = Math.round((d - Date.now()) / 60000);
  if (diffMin <= 0 || diffMin > 1440) return null;
  if (diffMin < 60) return `${diffMin} წთ-ში ⚡`;
  return `${Math.floor(diffMin / 60)} სთ-ში`;
}

function hoursAgo(isoStr) {
  if (!isoStr) return 0;
  return Math.floor((Date.now() - new Date(isoStr)) / 3600000);
}

function getBookingSubject(note, tutorSubjects) {
  if (note) { const m = note.match(/^\[S:([^\]]+)\]/); if (m) return m[1]; }
  return Array.isArray(tutorSubjects) ? tutorSubjects[0] : tutorSubjects;
}

function getDisplayNote(note) {
  if (!note) return "";
  return note.replace(/^\[S:[^\]]+\]\s*/, "");
}

function bookingTypeInfo(b) {
  if (b.booking_type === "trial")
    return { label: "🎓 საცდელი",  cls: "bg-purple-50 text-purple-700 border-purple-100" };
  if (b.package_id || b.booking_type === "package")
    return { label: "📦 პაკეტი",   cls: "bg-blue-50 text-blue-700 border-blue-100" };
  if (b.series_id || b.booking_type === "series")
    return { label: "🔁 სერია",    cls: "bg-indigo-50 text-indigo-700 border-indigo-100" };
  return   { label: "1️⃣ ერთჯერ.", cls: "bg-gray-50 text-gray-500 border-gray-100" };
}

const STATUS_MAP = {
  upcoming:           ["confirmed"],
  waiting_confirm:    ["pending"],
  completed_by_tutor: ["completed_by_tutor", "student_absent"],
  past:               ["done"],
  cancelled:          ["cancelled", "disputed"],
};

const TABS = [
  { key: "upcoming",           label: "დაგეგმილი",          tooltip: "დადასტურებული მომავალი გაკვეთილები." },
  { key: "waiting_confirm",    label: "დასადასტურებელი",    tooltip: "ახალი ჯავშნები, რომლებიც თქვენს დადასტურებას ელოდება." },
  { key: "completed_by_tutor", label: "მოსწ. დაადასტ.",     tooltip: "თქვენ დასრულებულად მონიშნეთ — მოსწავლეს 24 სთ აქვს დასადასტურებლად." },
  { key: "past",               label: "დასრულებული",        tooltip: "სრულად დასრულებული გაკვეთილები, ანაზღაურება ჩარიცხულია." },
  { key: "cancelled",          label: "გაუქმებული",         tooltip: "გაუქმებული ან გასაჩივრებული ჯავშნები." },
];

// ─── ConfirmModal ─────────────────────────────────────────────────────────
function ConfirmModal({ open, title, body, confirmLabel = "დადასტ.", cancelLabel = "არა", danger = false, onConfirm, onCancel, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
        {body && <p className="text-sm text-gray-500 mb-4">{body}</p>}
        {children}
        <div className="flex gap-3 justify-end mt-4">
          <button onClick={onCancel}
            className="btn-secondary text-sm px-4 py-2">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`text-sm px-4 py-2 rounded-xl font-semibold transition-all active:scale-95 ${
              danger
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "btn-primary"
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────
export default function TutorBookingsPage() {
  const router = useRouter();

  const [tutorName, setTutorName]         = useState("მასწავლებელი");
  const [tutorId, setTutorId]             = useState(null);
  const [tab, setTab]                     = useState("upcoming");
  const [bookings, setBookings]           = useState([]);
  const [seriesGroups, setSeriesGroups]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [pendingCount, setPendingCount]   = useState(0);
  const [expandedSeries, setExpandedSeries] = useState({});
  const [expandedNote, setExpandedNote]   = useState({});
  const [search, setSearch]               = useState("");
  const [dateFilter, setDateFilter]       = useState("all");
  const [toast, setToast]                 = useState(null);
  const [modal, setModal]                 = useState(null); // { type, bookingId, seriesGroup }
  const [cancelReason, setCancelReason]   = useState("");
  const [absentLoading, setAbsentLoading] = useState(null);
  const [stats, setStats]                 = useState({ today: 0, weekIncome: 0, monthIncome: 0 });

  function showToast(msg, type = "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ─── data fetching ───────────────────────────────────────────────────────
  async function fetchPendingCount(uid) {
    const supabase = createClient();
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tutor_id", uid).eq("status", "pending");
    setPendingCount(count || 0);
  }

  async function fetchStats(uid) {
    const supabase = createClient();
    const todayStr = new Date().toLocaleDateString("en-CA");
    const d = new Date();
    const day = d.getDay();
    const mondayDiff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart  = new Date(d.getFullYear(), d.getMonth(), mondayDiff).toLocaleDateString("en-CA");
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");

    const [{ data: todayData }, { data: weekData }, { data: monthData }] = await Promise.all([
      supabase.from("bookings").select("id").eq("tutor_id", uid).eq("date", todayStr).in("status", ["confirmed","pending"]),
      supabase.from("bookings").select("total_price").eq("tutor_id", uid).eq("status", "done").gte("date", weekStart),
      supabase.from("bookings").select("total_price").eq("tutor_id", uid).eq("status", "done").gte("date", monthStart),
    ]);

    setStats({
      today: todayData?.length || 0,
      weekIncome: (weekData || []).reduce((s, b) => s + (b.total_price || 0), 0),
      monthIncome: (monthData || []).reduce((s, b) => s + (b.total_price || 0), 0),
    });
  }

  async function fetchData(uid, currentTab = tab) {
    setLoading(true);
    setSearch("");
    setDateFilter("all");
    const supabase = createClient();
    const { data } = await supabase
      .from("bookings")
      .select(`
        id, date, time_slot, duration_hours, format,
        status, total_price, note, completed_by_tutor_at,
        student_id, series_id, booking_type, package_id,
        profiles!student_id(full_name),
        tutors(subject)
      `)
      .eq("tutor_id", uid)
      .in("status", STATUS_MAP[currentTab])
      .order("date", { ascending: currentTab !== "past" && currentTab !== "cancelled" });

    const all = data || [];

    if (currentTab === "waiting_confirm") {
      const seriesMap = {};
      const standalone = [];
      all.forEach(b => {
        if (b.series_id) {
          if (!seriesMap[b.series_id]) {
            seriesMap[b.series_id] = {
              series_id:   b.series_id,
              student_id:  b.student_id,
              studentName: b.profiles?.full_name || "სტუდენტი",
              subject:     getBookingSubject(b.note, b.tutors?.subject),
              format:      b.format,
              bookings:    [],
            };
          }
          seriesMap[b.series_id].bookings.push(b);
        } else {
          standalone.push(b);
        }
      });
      setSeriesGroups(Object.values(seriesMap));
      setBookings(standalone);
    } else {
      setSeriesGroups([]);
      setBookings(all);
    }

    setLoading(false);
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => { const user = session?.user;
      if (!user) { router.push("/auth"); return; }
      setTutorId(user.id);
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single()
        .then(({ data }) => {
          if (data?.role !== "tutor") { router.push("/dashboard"); return; }
          if (data?.full_name) setTutorName(data.full_name);
        });
    });
  }, [router]);

  useEffect(() => {
    if (!tutorId) return;
    fetchData(tutorId, tab);
    fetchPendingCount(tutorId);
    fetchStats(tutorId);
  }, [tab, tutorId]);

  // ─── actions ─────────────────────────────────────────────────────────────
  async function handleAction(bookingId, action, extra = {}) {
    setActionLoading(bookingId + action);
    const supabase = createClient();

    if (action === "confirmed") {
      const { error } = await supabase
        .from("bookings").update({ status: "confirmed" }).eq("id", bookingId);
      if (error) { showToast("დადასტ. ვერ მოხერხდა"); setActionLoading(null); return; }
      const bk = [...bookings, ...(seriesGroups.flatMap(s => s.bookings))].find(b => b.id === bookingId);
      if (bk?.student_id) {
        await supabase.from("notifications").insert({
          user_id: bk.student_id, type: "booking",
          title: "ჯავშანი დადასტურდა ✅",
          body: "მასწავლებელმა თქვენი ჯავშანი დაადასტურა.",
          link: "/dashboard/student/lessons", is_read: false,
        }).then(() => {}).catch(() => {});
      }
      // Increment total_booked_lessons for trust index tracking
      const { data: tutorStats } = await supabase
        .from("tutors").select("total_booked_lessons").eq("id", tutorId).single();
      await supabase.from("tutors")
        .update({ total_booked_lessons: (tutorStats?.total_booked_lessons || 0) + 1 })
        .eq("id", tutorId);
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      setPendingCount(p => Math.max(0, p - 1));
      showToast("ჯავშანი დადასტურდა!", "success");

    } else if (action === "cancelled") {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, reason: extra.reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "გაუქმება ვერ მოხერხდა"); setActionLoading(null); return; }
      const bk = bookings.find(b => b.id === bookingId);
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      if (bk?.status === "pending") setPendingCount(p => Math.max(0, p - 1));
      const refundInfo = data.studentRefund > 0 ? ` · ${data.studentRefund}₾ დაუბრუნდა` : "";
      const penaltyInfo = data.tutorPenalty > 0 ? ` · ${data.tutorPenalty}₾ ჯარიმა` : "";
      showToast(`ჯავშანი გაუქმდა${refundInfo}${penaltyInfo}`, "error");

    } else if (action === "confirm_series") {
      const { error } = await supabase
        .from("bookings").update({ status: "confirmed" }).eq("series_id", bookingId);
      if (error) { showToast("პაკეტის დადასტ. ვერ მოხერხდა"); setActionLoading(null); return; }
      await supabase.from("booking_series")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", bookingId);
      const sg = seriesGroups.find(s => s.series_id === bookingId);
      if (sg?.student_id) {
        await supabase.from("notifications").insert({
          user_id: sg.student_id, type: "booking",
          title: "პაკეტი დადასტურდა ✅",
          body: `მასწავლებელმა ${sg.bookings.length} გაკვეთილი დაადასტურა!`,
          link: "/dashboard/student/lessons", is_read: false,
        }).then(() => {}).catch(() => {});
      }
      setSeriesGroups(prev => prev.filter(s => s.series_id !== bookingId));
      setPendingCount(p => Math.max(0, p - sg.bookings.length));
      showToast(`პაკეტი (${sg?.bookings.length} გაკვ.) დადასტურდა!`, "success");

    } else if (action === "cancel_series") {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId: bookingId, reason: extra?.reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "პაკეტის გაუქმება ვერ მოხერხდა"); setActionLoading(null); return; }
      const refundInfo  = data.studentRefund  > 0 ? ` · ${data.studentRefund}₾ დაუბრუნდა`  : "";
      const penaltyInfo = data.tutorPenalty   > 0 ? ` · ${data.tutorPenalty}₾ ჯარიმა`     : "";
      setSeriesGroups(prev => prev.filter(s => s.series_id !== bookingId));
      showToast(`პაკეტი გაუქმდა${refundInfo}${penaltyInfo}`, "error");

    } else if (action === "completed_by_tutor") {
      const res = await fetch(`/api/bookings/${bookingId}/tutor-complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "სტატუსის განახლება ვერ მოხერხდა"); setActionLoading(null); return; }
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      showToast("გაკვეთილი დასრულებულად მოინიშნა! სტუდენტი შეტყობინდება.", "success");
    }


    setActionLoading(null);
    fetchPendingCount(tutorId);
  }

  async function markStudentAbsent(bookingId) {
    setAbsentLoading(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}/student-absent`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "შეცდომა");
    } else {
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      showToast("მოსწავლე მოთხოვნა გაიგზავნა — 24სთ-ში ავტ. მოგვარდება.", "success");
    }
    setAbsentLoading(null);
  }

  // ─── modal confirm ────────────────────────────────────────────────────────
  function openConfirm(type, bookingId, sg = null, booking = null) {
    setCancelReason("");
    setModal({ type, bookingId, sg, booking });
  }

  function closeModal() { setModal(null); setCancelReason(""); }

  async function confirmModal() {
    if (!modal) return;
    const { type, bookingId } = modal;
    closeModal();
    if (type === "confirm")         await handleAction(bookingId, "confirmed");
    if (type === "cancel")          await handleAction(bookingId, "cancelled", { reason: cancelReason });
    if (type === "confirm_series")  await handleAction(bookingId, "confirm_series");
    if (type === "cancel_series")   await handleAction(bookingId, "cancel_series");
    if (type === "complete")        await handleAction(bookingId, "completed_by_tutor");
  }

  // ─── filtered list ────────────────────────────────────────────────────────
  const todayStr  = new Date().toLocaleDateString("en-CA");
  const d = new Date();
  const day = d.getDay();
  const mondayDiff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStartStr = new Date(d.getFullYear(), d.getMonth(), mondayDiff).toLocaleDateString("en-CA");

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(b => (b.profiles?.full_name || "").toLowerCase().includes(q));
    }
    if (dateFilter === "today")    list = list.filter(b => b.date === todayStr);
    if (dateFilter === "week")     list = list.filter(b => b.date >= weekStartStr);
    return list;
  }, [bookings, search, dateFilter, todayStr, weekStartStr]);

  const filteredSeries = useMemo(() => {
    if (!search.trim()) return seriesGroups;
    const q = search.trim().toLowerCase();
    return seriesGroups.filter(sg => sg.studentName.toLowerCase().includes(q));
  }, [seriesGroups, search]);

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />

      <main className="p-6 md:p-8">
        <div className="max-w-4xl">

          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 text-sm px-5 py-3 rounded-2xl shadow-lg border font-medium ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {toast.type === "success" ? "✅" : "❌"} {toast.msg}
            </div>
          )}

          {/* Confirm modal */}
          <ConfirmModal
            open={!!modal}
            title={
              modal?.type === "confirm"        ? "ჯავშნის დადასტ." :
              modal?.type === "cancel"         ? "ჯავშნის გაუქმება" :
              modal?.type === "confirm_series" ? `პაკეტის დადასტ. (${modal?.sg?.bookings?.length} გაკვ.)` :
              modal?.type === "cancel_series"  ? "პაკეტის გაუქმება" :
              "გაკვეთილი დასრულდა?"
            }
            body={
              modal?.type === "confirm"        ? "სტუდენტს ეცნობება დადასტ." :
              modal?.type === "cancel_series"  ? `${modal?.sg?.bookings?.length} გაკვეთილი გაუქმდება.` :
              modal?.type === "complete"       ? "სტუდენტს მიეცემა 24 საათი დასადასტ." :
              undefined
            }
            confirmLabel={
              modal?.type === "cancel" || modal?.type === "cancel_series" ? "გაუქმება" : "დადასტ."
            }
            danger={modal?.type === "cancel" || modal?.type === "cancel_series"}
            onConfirm={confirmModal}
            onCancel={closeModal}
          >
            {modal?.type === "cancel" && (
              <div>
                {/* Policy warning */}
                {modal?.booking && (() => {
                  const bk = modal.booking;
                  const lessonAt  = new Date(`${bk.date}T${bk.time_slot || "00:00"}:00`);
                  const isLate    = (lessonAt - Date.now()) / 3_600_000 < 24;
                  const price     = Number(bk.total_price || 0);
                  const penalty   = isLate ? Math.round(price * 0.2 * 100) / 100 : 0;
                  return (
                    <div className={`mb-3 rounded-xl px-3 py-2.5 text-xs font-medium border ${
                      isLate
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}>
                      {isLate ? (
                        <>
                          ⚠️ <strong>გვიანი გაუქმება</strong> — გაკვეთილამდე 24 სთ-ზე ნაკლებია
                          <br />
                          {price > 0 ? (
                            <>სტუდენტს სრულად დაუბრუნდება <strong>{price}₾</strong>.
                            {" "}თქვენი საფულიდან გამოაქვთ <strong>{penalty}₾</strong> ჯარიმა (20%).</>
                          ) : "სტუდენტი შეტყობინდება."}
                        </>
                      ) : (
                        <>
                          ✅ <strong>უფასო გაუქმება</strong>
                          {price > 0 && <> — სტუდენტს სრულად დაუბრუნდება <strong>{price}₾</strong>.</>}
                        </>
                      )}
                    </div>
                  );
                })()}
                <label className="text-xs text-gray-500 mb-1 block">გაუქმების მიზეზი (სურვ.)</label>
                <select
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                  <option value="">— მიზეზის არჩევა —</option>
                  <option value="განრიგი შეიცვალა">განრიგი შეიცვალა</option>
                  <option value="ავადობა">ავადობა</option>
                  <option value="სხვა ვალდებულება">სხვა ვალდებულება</option>
                  <option value="სტუდენტი არ პასუხობს">სტუდენტი არ პასუხობს</option>
                  <option value="other">სხვა...</option>
                </select>
                {cancelReason === "other" && (
                  <textarea
                    placeholder="მიუთითეთ მიზეზი..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                    rows={2}
                    onChange={e => setCancelReason(e.target.value)}
                  />
                )}
              </div>
            )}
          </ConfirmModal>

          {/* Header */}
          <h1 className="text-2xl font-black text-gray-900 mb-6">📅 ჯავშნები</h1>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "დღეს", value: stats.today, suffix: "ჯავშ.", color: "text-gray-900" },
              { label: "კვირის შემ.", value: `${stats.weekIncome}₾`, suffix: "", color: "text-emerald-600" },
              { label: "თვის შემ.", value: `${stats.monthIncome}₾`, suffix: "", color: "text-emerald-600" },
            ].map((s, i) => (
              <div key={i} className="card p-4">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-xl font-black ${s.color}`}>{s.value} <span className="text-sm font-medium text-gray-400">{s.suffix}</span></p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
            {TABS.map(t => (
              <div key={t.key} className="relative flex items-center">
                <button onClick={() => setTab(t.key)}
                  className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    tab === t.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {t.label}
                  {t.key === "waiting_confirm" && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </button>
                {/* ? tooltip */}
                <div className="relative group/tip ml-0.5 flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold text-gray-400 hover:text-emerald-600 rounded-full hover:bg-white cursor-default transition-colors select-none">
                    ?
                  </span>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 w-52">
                    <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-xl shadow-lg text-center leading-relaxed">
                      {t.tooltip}
                    </div>
                    <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-gray-900 mx-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Search + date filter */}
          <div className="flex gap-2 mb-5 flex-wrap">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 სტუდენტის სახელი..."
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 flex-1 min-w-[180px]"
            />
            {tab === "upcoming" && (
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {[["all","ყველა"],["today","დღეს"],["week","ეს კვ."]].map(([v, l]) => (
                  <button key={v} onClick={() => setDateFilter(v)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      dateFilter === v
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (filteredSeries.length === 0 && filteredBookings.length === 0) ? (
            <div className="text-center py-24">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 font-medium mb-1">
                {search ? "შედეგი ვერ მოიძებნა" : "ჯავშნები არ არის"}
              </p>
              {search && (
                <button onClick={() => setSearch("")}
                  className="text-sm text-emerald-600 hover:underline mt-1">ძებნის გასუფთავება</button>
              )}
            </div>
          ) : (
            <div className="space-y-4">

              {/* ── Series groups ── */}
              {filteredSeries.map(sg => {
                const isExpanded = expandedSeries[sg.series_id];
                const total = sg.bookings.reduce((s, b) => s + (b.total_price || 0), 0);
                const firstDate = sg.bookings[0]?.date;
                const lastDate  = sg.bookings[sg.bookings.length - 1]?.date;
                const loading_  = actionLoading === sg.series_id + "confirm_series"
                                || actionLoading === sg.series_id + "cancel_series";

                return (
                  <div key={sg.series_id}
                    className="card border-2 border-blue-200 bg-blue-50/20 overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex gap-3 flex-1 min-w-0">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                            {initials(sg.studentName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">📦 პაკეტი</span>
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{sg.bookings.length} გაკვ.</span>
                              {total > 0 && <span className="text-xs font-bold text-emerald-700">{total}₾</span>}
                            </div>
                            <p className="font-bold text-gray-900">{sg.studentName}</p>
                            <p className="text-sm text-gray-500">
                              {sg.subject} · {sg.format === "online" ? "🌐 ონლაინ" : "🏫 პირისპირ"}
                            </p>
                            {firstDate && (
                              <p className="text-xs text-gray-400 mt-0.5">📅 {firstDate} — {lastDate}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 shrink-0 flex-wrap items-center">
                          <Link href={`/messages?student=${sg.student_id}`}
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-emerald-600 transition-colors text-sm"
                            title="სტუდენტთან წერა">💬</Link>
                          <button
                            onClick={() => setExpandedSeries(prev => ({ ...prev, [sg.series_id]: !prev[sg.series_id] }))}
                            className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all">
                            {isExpanded ? "▲ დამალვა" : `▼ ნახვა`}
                          </button>
                          <button
                            onClick={() => openConfirm("confirm_series", sg.series_id, sg)}
                            disabled={!!loading_}
                            className="btn-primary text-xs px-4 py-1.5">
                            {loading_ ? "..." : `✅ ყველა (${sg.bookings.length})`}
                          </button>
                          <button
                            onClick={() => openConfirm("cancel_series", sg.series_id, sg)}
                            disabled={!!loading_}
                            className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all">
                            უარი
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-2 border-t border-blue-100 pt-4">
                          {sg.bookings.map((b, idx) => (
                            <div key={b.id}
                              className="flex items-center justify-between py-2 px-3 bg-white rounded-xl border border-blue-100 text-sm">
                              <span className="text-gray-400 text-xs w-5 text-center">{idx + 1}.</span>
                              <span className="text-gray-700 flex-1 ml-2">{fmtDate(b.date, b.time_slot)}</span>
                              <span className="text-xs text-blue-600 font-medium">{b.duration_hours}სთ</span>
                              {b.total_price > 0 && (
                                <span className="text-xs text-emerald-600 font-bold ml-3">{b.total_price}₾</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* ── Standalone bookings ── */}
              {filteredBookings.map(b => {
                const elapsed       = hoursAgo(b.completed_by_tutor_at);
                const autoIn        = Math.max(0, 24 - elapsed);
                const countdown     = countdownText(b.date, b.time_slot);
                const subject       = getBookingSubject(b.note, b.tutors?.subject);
                const noteExpanded  = expandedNote[b.id];
                const loading_      = !!actionLoading && actionLoading.startsWith(b.id);

                return (
                  <div key={b.id} className={`card p-5 ${
                    b.status === "completed_by_tutor" ? "border-amber-200 bg-amber-50/30" :
                    b.status === "pending"            ? "border-blue-200 bg-blue-50/20" : ""
                  }`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">

                      {/* Left: info */}
                      <div className="flex gap-3 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center shrink-0 ${
                          b.status === "pending" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {initials(b.profiles?.full_name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <Link href={`/dashboard/tutor/students/${b.student_id}`}
                              className="font-bold text-gray-900 hover:text-emerald-600 hover:underline transition-colors">
                              {b.profiles?.full_name || "სტუდენტი"}
                            </Link>
                            {/* Status badge */}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              b.status === "confirmed"          ? "bg-emerald-50 text-emerald-700" :
                              b.status === "pending"            ? "bg-blue-50 text-blue-700" :
                              b.status === "completed_by_tutor" ? "bg-orange-50 text-orange-700" :
                              b.status === "student_absent"     ? "bg-orange-100 text-orange-700" :
                              b.status === "done"               ? "bg-gray-100 text-gray-500" :
                              b.status === "disputed"           ? "bg-red-50 text-red-600" :
                              "bg-red-50 text-red-400"
                            }`}>
                              {b.status === "confirmed"          ? "დადასტ." :
                               b.status === "pending"            ? "⏳ ახალი" :
                               b.status === "completed_by_tutor" ? "სტ. ადასტ." :
                               b.status === "student_absent"     ? "🚫 მოსწ. არ გამოჩ." :
                               b.status === "done"               ? "✓ დასრულდა" :
                               b.status === "disputed"           ? "🚩 გასაჩივრდა" :
                               "გაუქმდა"}
                            </span>
                            {/* Booking type badge */}
                            {(() => { const t = bookingTypeInfo(b); return (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${t.cls}`}>
                                {t.label}
                              </span>
                            ); })()}
                            {countdown && (
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                {countdown}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {subject}{" · "}
                            {b.format === "online" ? "🌐 ონლაინ" : "🏫 პირისპირ"}{" · "}
                            {b.duration_hours}სთ
                            {b.total_price > 0 && (
                              <span className="ml-2 font-bold text-gray-800">{b.total_price}₾</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{fmtDate(b.date, b.time_slot)}</p>

                          {/* Note */}
                          {getDisplayNote(b.note) && (
                            <div className="mt-2">
                              <p className={`text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100 ${
                                !noteExpanded ? "line-clamp-1" : ""
                              }`}>
                                💬 {getDisplayNote(b.note)}
                              </p>
                              {getDisplayNote(b.note).length > 60 && (
                                <button
                                  onClick={() => setExpandedNote(p => ({ ...p, [b.id]: !p[b.id] }))}
                                  className="text-xs text-emerald-600 hover:underline ml-1 mt-0.5">
                                  {noteExpanded ? "ნაკლები ▲" : "მეტი ▼"}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Auto-complete countdown */}
                          {b.status === "completed_by_tutor" && (
                            <div className="mt-2">
                              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                                ⏳ სტუდენტს დარჩა {autoIn} სთ
                              </span>
                            </div>
                          )}
                          {b.status === "student_absent" && (
                            <div className="mt-2">
                              <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">
                                🚫 მოსწ. არ გამოჩ. — {autoIn} სთ-ში ავტ. ირიცხება
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {/* Message link */}
                        <Link href={`/messages?student=${b.student_id}`}
                          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-emerald-600 transition-colors text-sm"
                          title="სტუდენტთან წერა">💬</Link>

                        {/* Pending actions */}
                        {b.status === "pending" && (
                          <>
                            <button onClick={() => openConfirm("confirm", b.id)}
                              disabled={loading_}
                              className="btn-primary text-xs px-3 py-1.5">
                              {actionLoading === b.id + "confirmed" ? "..." : "დადასტ. ✓"}
                            </button>
                            <button onClick={() => openConfirm("cancel", b.id, null, b)}
                              disabled={loading_}
                              className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-red-100">
                              უარი
                            </button>
                          </>
                        )}

                        {/* Confirmed actions */}
                        {b.status === "confirmed" && (() => {
                          const lessonStart = b.date && b.time_slot
                            ? new Date(`${b.date}T${b.time_slot}:00`)
                            : null;
                          const minSinceStart = lessonStart
                            ? (Date.now() - lessonStart) / 60000
                            : -1;
                          const lessonStarted = minSinceStart >= 10;

                          return (
                            <>
                              {b.format === "online" && (
                                <button onClick={() => router.push(`/lesson/${b.id}`)}
                                  className="btn-primary text-xs px-3 py-1.5">
                                  შეერთება →
                                </button>
                              )}
                              <button onClick={() => openConfirm("complete", b.id)}
                                disabled={loading_}
                                className="btn-secondary text-xs px-3 py-1.5">
                                {actionLoading === b.id + "completed_by_tutor" ? "..." : "დასრულება ✓"}
                              </button>
                              {lessonStarted && (
                                <button
                                  onClick={() => markStudentAbsent(b.id)}
                                  disabled={absentLoading === b.id}
                                  title="გაკვეთილი დაიწყო 10+ წუთის წინ — მოსწ. არ გამოჩნდა"
                                  className="text-xs text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-all disabled:opacity-50">
                                  {absentLoading === b.id ? "..." : "🚫 მოსწ. არ გამოცხ."}
                                </button>
                              )}
                              <button onClick={() => openConfirm("cancel", b.id, null, b)}
                                disabled={loading_}
                                className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-red-100">
                                გაუქმება
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
