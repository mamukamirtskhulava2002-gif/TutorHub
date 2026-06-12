"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Suspense } from "react";

const WEEK_KEYS   = ["sun","mon","tue","wed","thu","fri","sat"];
const WEEK_LABELS = ["კვი","ორ","სამ","ოთხ","ხუთ","პარ","შაბ"];
const WEEK_NAMES  = {
  mon:"ორშაბათი", tue:"სამშაბათი", wed:"ოთხშაბათი",
  thu:"ხუთშაბათი", fri:"პარასკევი", sat:"შაბათი", sun:"კვირა",
};
const MONTH_NAMES = [
  "იანვარი","თებერვალი","მარტი","აპრილი","მაისი","ივნისი",
  "ივლისი","აგვისტო","სექტემბერი","ოქტომბერი","ნოემბერი","დეკემბერი",
];

function getDaysArray(year, month) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ──────────────────────────────────────────────
// სლოტის ხელმისაწვდომობის შემოწმება
// ──────────────────────────────────────────────
function getSlotStatus(slot, existingBookings) {
  const [sh, sm] = slot.time.split(":").map(Number);
  const slotStartMin = sh * 60 + sm;
  const slotEndMin   = slotStartMin + (slot.duration || 1) * 60;

  // booking overlaps if it starts before slot ends AND ends after slot starts
  function overlaps(b) {
    const [bh, bm] = (b.time_slot || "00:00").split(":").map(Number);
    const bStart = bh * 60 + bm;
    const bEnd   = bStart + (b.duration_hours || 1) * 60;
    return slotStartMin < bEnd && slotEndMin > bStart;
  }

  if (slot.type === "group") {
    // group capacity: count only exact-start bookings; block if any overlap exists
    const exact = existingBookings.filter(b => b.time_slot === slot.time).length;
    const max   = slot.max_students || 1;
    const blocked = existingBookings.some(b => b.time_slot !== slot.time && overlaps(b));
    return { available: exact < max && !blocked, count: exact, max, isFull: exact >= max || blocked };
  } else {
    const booked = existingBookings.some(overlaps);
    return { available: !booked, count: booked ? 1 : 0, max: 1, isFull: booked };
  }
}

// ──────────────────────────────────────────────
// Supabase-იდან კონკრეტული დღის სლოტების ამოკითხვა
// ──────────────────────────────────────────────
async function fetchSlotsForDate(tutorId, dateStr, excludeBookingId = null) {
  const supabase = createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, time_slot, duration_hours, booking_type, status")
    .eq("tutor_id", tutorId)
    .eq("date", dateStr)
    .in("status", ["pending", "confirmed"]);

  return (data || []).filter(b =>
    excludeBookingId ? b.id !== excludeBookingId : true
  );
}

// ──────────────────────────────────────────────
function TypeSelector({ value, onChange, hasTrial }) {
  const types = [
    { key: "trial",     icon: "🎓", label: "საცდელი",   desc: "პირველი გაკვეთილი" },
    { key: "single",    icon: "📅", label: "ერთჯერადი", desc: "ერთი გაკვეთილი" },
    { key: "package",   icon: "📦", label: "პაკეტი",    desc: "1–6 თვე" },
    { key: "recurring", icon: "🔁", label: "გამეორება", desc: "კვირიდან კვირამდე" },
  ];
  return (
    <div className="card p-5">
      <h3 className="font-bold text-gray-900 mb-3">ჯავშნის ტიპი</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {types.map(t => (
          <button key={t.key} onClick={() => onChange(t.key)}
            disabled={t.key === "trial" && hasTrial}
            className={`p-3 rounded-xl border text-center transition-all ${
              value === t.key ? "border-emerald-500 bg-emerald-50" :
              t.key === "trial" && hasTrial ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed" :
              "border-gray-200 hover:border-emerald-300"
            }`}>
            <span className="text-2xl block mb-1">{t.icon}</span>
            <p className={`text-xs font-semibold ${value === t.key ? "text-emerald-700" : "text-gray-700"}`}>
              {t.label}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
            {t.key === "trial" && hasTrial && (
              <p className="text-xs text-red-400 mt-0.5">გამოყენებულია</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
function Calendar({ tutor, selectedDates, onSelect, multi = false, today, trialShortDates = null }) {
  const [calYear, setCalYear]   = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const days = getDaysArray(calYear, calMonth);

  function isPast(day) {
    if (!today || !day) return false;
    const d = new Date(calYear, calMonth, day);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < t;
  }

  function hasSchedule(day) {
    if (!day || !tutor?.schedule) return true;
    const date    = new Date(calYear, calMonth, day);
    const dateStr = formatDateStr(date);
    // Trial restriction: if short-slot dates are provided, only those dates are selectable
    if (trialShortDates && trialShortDates.size > 0 && !trialShortDates.has(dateStr)) return false;
    const vac     = tutor?.schedule?._vacation;
    if (vac && dateStr >= vac.from && dateStr <= vac.until) return false;
    const dayKey   = WEEK_KEYS[date.getDay()];
    const rawSlots = tutor.schedule[dayKey] || [];
    if (rawSlots.length === 0) return false;
    // For today, at least one slot must be ≥ 2h away
    const todayStr = today ? formatDateStr(today) : "";
    if (dateStr === todayStr && today) {
      const nowMin = today.getHours() * 60 + today.getMinutes();
      return rawSlots.map(normaliseSlot).filter(s => s.time).some(s => {
        const [h, m] = s.time.split(":").map(Number);
        return h * 60 + m - nowMin >= 120;
      });
    }
    return true;
  }

  function isSelected(day) {
    if (!day) return false;
    const d = new Date(calYear, calMonth, day);
    return selectedDates.some(s => s.toDateString() === d.toDateString());
  }

  function isToday(day) {
    if (!day || !today) return false;
    return new Date(calYear, calMonth, day).toDateString() === today.toDateString();
  }

  function handleClick(day) {
    if (!day) return;
    const date = new Date(calYear, calMonth, day);
    if (isPast(day) || !hasSchedule(day)) return;
    if (multi) {
      const exists = selectedDates.find(d => d.toDateString() === date.toDateString());
      if (exists) onSelect(selectedDates.filter(d => d.toDateString() !== date.toDateString()));
      else onSelect([...selectedDates, date]);
    } else {
      onSelect([date]);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => {
          if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); }
          else setCalMonth(m => m-1);
        }} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-emerald-400">←</button>
        <span className="font-semibold text-sm">{MONTH_NAMES[calMonth]} {calYear}</span>
        <button onClick={() => {
          if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); }
          else setCalMonth(m => m+1);
        }} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-emerald-400">→</button>
      </div>
      <div className="grid grid-cols-7 mb-2">
        {WEEK_LABELS.map(d => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const disabled  = isPast(day) || !hasSchedule(day);
          const selected  = isSelected(day);
          const todayMark = isToday(day);
          return (
            <button key={i} onClick={() => handleClick(day)} disabled={disabled}
              className={`h-9 rounded-xl text-sm font-medium transition-all ${
                selected  ? "bg-emerald-600 text-white shadow-sm" :
                todayMark ? "border-2 border-emerald-400 text-emerald-600" :
                disabled  ? "text-gray-200 cursor-not-allowed" :
                "text-gray-700 hover:bg-emerald-50 hover:text-emerald-600"
              }`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// normalises both old {time, type} and new {start, isGroup, maxStudents, priceInd/priceGrp} formats
function normaliseSlot(s) {
  if (typeof s === "string") return { time: s, type: "individual", max_students: 1, duration: 1, price: 0 };
  const isGrp = s.isGroup || s.type === "group";
  return {
    time:         s.start        || s.time || "",
    end:          s.end          || "",
    type:         isGrp          ? "group" : "individual",
    max_students: s.maxStudents  || s.max_students || (isGrp ? 3 : 1),
    duration:     s.duration     || 1,
    price:        isGrp ? (s.priceGrp || 0) : (s.priceInd || 0),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Trial booking: determine eligible slots and conversion info for a given date.
// Priority: exact match → short-slot conversion → cascade (45m→1h→1.5h→2h)
// Group slots are NEVER eligible.
// Returns { slots, isConverted, originalDur, mode }
// ──────────────────────────────────────────────────────────────────────────────
function getTrialSlotsForDate(date, tutor) {
  if (!date || !tutor?.schedule) return { slots: [], isConverted: false, originalDur: 0, mode: "none" };
  const trialDurH = (tutor.trial_duration || 30) / 60;
  const shortDurs = [0.25, 0.5]; // 15min and 30min

  const dayKey   = WEEK_KEYS[date.getDay()];
  const rawSlots = tutor.schedule[dayKey] || [];
  const indSlots = rawSlots.map(normaliseSlot).filter(s => s.time && s.type !== "group");

  if (indSlots.length === 0) return { slots: [], isConverted: false, originalDur: 0, mode: "none" };

  // 1. Exact match: slot duration === trial duration
  const exact = indSlots.filter(s => Math.abs(Number(s.duration) - trialDurH) < 0.001);
  if (exact.length > 0) return { slots: exact, isConverted: false, originalDur: trialDurH, mode: "exact" };

  // 2. Any short slot (15 or 30 min) — may need converting to trial_duration
  const short = indSlots.filter(s => shortDurs.some(d => Math.abs(Number(s.duration) - d) < 0.001));
  if (short.length > 0) return { slots: short, isConverted: true, originalDur: short[0].duration, mode: "shortConvert" };

  // 3. Cascade: smallest slot (45m → 1h → 1.5h → 2h → ...)
  for (const dur of [0.75, 1, 1.5, 2, 2.5, 3]) {
    const matched = indSlots.filter(s => Math.abs(Number(s.duration) - dur) < 0.001);
    if (matched.length > 0) return { slots: matched, isConverted: true, originalDur: dur, mode: "cascadeConvert" };
  }
  // Absolute fallback: smallest available
  const sorted = [...indSlots].sort((a, b) => Number(a.duration) - Number(b.duration));
  return { slots: [sorted[0]], isConverted: true, originalDur: sorted[0].duration, mode: "cascadeConvert" };
}

function TimeSelector({ tutor, date, existingBookings, selected, onSelect, onSlotSelect, today }) {
  if (!date) return null;
  const dayKey   = WEEK_KEYS[date.getDay()];
  const rawSlots = tutor?.schedule?.[dayKey] || [];

  if (rawSlots.length === 0) return (
    <p className="text-sm text-gray-400 text-center py-4">ამ დღეს სლოტები არ არის</p>
  );

  const slots = rawSlots.map(normaliseSlot).filter(s => s.time);

  // For today: slots with < 2h remaining are not bookable
  function isTooSoon(slotTime) {
    if (!today || !date) return false;
    if (formatDateStr(date) !== formatDateStr(today)) return false;
    const [sh, sm] = slotTime.split(":").map(Number);
    return (sh * 60 + sm) - (today.getHours() * 60 + today.getMinutes()) < 120;
  }

  return (
    <div>
      <div className="flex gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> ინდივიდუალური
        </span>
        <span className="flex items-center gap-1.5 text-xs text-blue-600">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> ჯგუფური
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> სავსე
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {slots.map(slot => {
          const tooSoon  = isTooSoon(slot.time);
          const status   = getSlotStatus(slot, existingBookings);
          const disabled = !status.available || tooSoon;
          const sel      = selected === slot.time;
          const isGroup  = slot.type === "group";

          return (
            <button key={slot.time}
              onClick={() => { if (!disabled) {
                if (sel) { onSelect(""); onSlotSelect?.(null); }
                else     { onSelect(slot.time); onSlotSelect?.(slot); }
              } }}
              disabled={disabled}
              className={`py-3 px-3 rounded-xl border transition-all text-left ${
                disabled
                  ? "bg-gray-50 border-gray-100 cursor-not-allowed"
                  : sel
                  ? isGroup
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : isGroup
                  ? "border-blue-200 bg-blue-50/50 hover:border-blue-400"
                  : "border-gray-200 hover:border-emerald-400"
              }`}
            >
              <p className={`text-sm font-bold ${disabled ? "text-gray-300" : sel ? "text-white" : "text-gray-800"}`}>
                {slot.time}
              </p>
              {(slot.duration !== 1 || slot.price > 0) && (
                <p className={`text-xs font-semibold ${
                  disabled ? "text-gray-300" : sel ? (isGroup ? "text-blue-100" : "text-emerald-100") : "text-gray-500"
                }`}>
                  {slot.duration}სთ{slot.price > 0 ? ` · ${slot.price}₾` : ""}
                </p>
              )}
              <div className="flex items-center gap-1 mt-1">
                {isGroup ? (
                  <span className={`text-xs font-medium ${
                    disabled ? "text-gray-300" : sel ? "text-blue-100" : "text-blue-600"
                  }`}>
                    {tooSoon
                      ? "⏰ ვადა ამოიწ."
                      : `👥 ${status.count}/${status.max}${disabled ? " · სავსე" : ` · ${status.max - status.count} ვაკ.`}`
                    }
                  </span>
                ) : (
                  <span className={`text-xs ${
                    disabled ? "text-gray-300" : sel ? "text-emerald-200" : "text-gray-500"
                  }`}>
                    {tooSoon ? "⏰ ვადა ამოიწ." : disabled ? "👤 დაკავებული" : "👤 თავისუფალი"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
function BookingContent() {
  const { id }        = useParams();
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const editBookingId = searchParams.get("edit");

  const [tutor, setTutor]             = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole]       = useState(null);
  const [children, setChildren]       = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [success, setSuccess]         = useState(null);
  const [error, setError]             = useState("");
  const [today, setToday]             = useState(null);
  const [hasTrial, setHasTrial]       = useState(false);

  const [existingBookings, setExistingBookings] = useState([]);

  const [isEditing, setIsEditing]       = useState(false);
  const [bookingType, setBookingType]   = useState("single");
  const [format, setFormat]             = useState("online");
  const [note, setNote]                 = useState("");
  const [selectedDate, setSelectedDate]             = useState(null);
  const [selectedTime, setSelectedTime]             = useState("");
  const [selectedSlot, setSelectedSlot]             = useState(null);
  const [selectedSlotsByDate, setSelectedSlotsByDate] = useState({});
  // { dateStr: { date: Date, time: string, slot: object } }
  const [duration, setDuration]                     = useState(1);
  const [pkgMonths, setPkgMonths]           = useState(1);
  const [pkgDaysPerWeek, setPkgDaysPerWeek] = useState(2);
  const [pkgDaySlots, setPkgDaySlots]       = useState([]);
  const [recDates, setRecDates]   = useState([]);
  const [recTimes, setRecTimes]   = useState({});
  const [repeatAll, setRepeatAll] = useState(false);
  const [recWeeks, setRecWeeks]   = useState(4);

  useEffect(() => {
    setToday(new Date());
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setCurrentUser(user);
      setSelectedStudentId(user.id);

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      setUserRole(profile?.role);

      if (profile?.role === "parent") {
        const { data: childrenData } = await supabase
          .from("parent_children")
          .select("id, profiles!child_id(id, full_name)")
          .eq("parent_id", user.id);
        const kids = childrenData || [];
        setChildren(kids);
        if (kids.length > 0) setSelectedStudentId(kids[0].profiles?.id);
      }

      const { data: tutorData } = await supabase
        .from("tutors")
        .select(`
          id, price_per_hour, subject, rating, review_count,
          is_online, is_offline, is_verified, schedule, city,
          trial_duration, trial_price, max_sessions_per_week,
          profiles(full_name, avatar_url)
        `)
        .eq("id", id)
        .single();

      if (!tutorData) { router.push("/search"); return; }
      setTutor(tutorData);
      if (tutorData.is_online) setFormat("online");
      else if (tutorData.is_offline) setFormat("offline");

      const { data: trialData } = await supabase
        .from("trial_lessons")
        .select("id")
        .eq("student_id", user.id)
        .eq("tutor_id", id)
        .single();
      setHasTrial(!!trialData);

      if (editBookingId) {
        setIsEditing(true);
        const { data: existing } = await supabase
          .from("bookings").select("*").eq("id", editBookingId).single();
        if (existing) {
          setBookingType(existing.booking_type || "single");
          setFormat(existing.format || "online");
          setNote(existing.note || "");
          setDuration(existing.duration_hours || 1);
          if (existing.date) setSelectedDate(new Date(existing.date + "T00:00:00"));
          setSelectedTime(existing.time_slot || "");
        }
      }

      setLoading(false);
    }
    init();
  }, [id]);

  // ──────────────────────────────────────────────
  // თარიღის არჩევისას სლოტები ამოიკითხება
  // + realtime + polling (15 წამში ერთხელ)
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDate || !id) return;

    const dateStr = formatDateStr(selectedDate);

    // პირველი ჩატვირთვა
    fetchSlotsForDate(id, dateStr, editBookingId).then(data => {
      setExistingBookings(data);
      if (isEditing) { setSelectedTime(""); setSelectedSlot(null); }
    });

    // Realtime — სხვა სტუდენტის ჯავშანი მაშინვე ჩანს
    const supabase = createClient();
    const channel = supabase
      .channel(`slots_${id}_${dateStr}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          // მხოლოდ ამ მასწავლებლის და ამ თარიღის ცვლილება
          const rec = payload.new || payload.old || {};
          if (rec.tutor_id === id && rec.date === dateStr) {
            fetchSlotsForDate(id, dateStr, editBookingId).then(setExistingBookings);
          }
        }
      )
      .subscribe();

    // ✅ Polling — 15 წამში ერთხელ განახლება (realtime-ის სარეზერვო)
    const pollInterval = setInterval(() => {
      fetchSlotsForDate(id, dateStr, editBookingId).then(setExistingBookings);
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [selectedDate, id]);

  const maxDaysPerWeek = tutor?.max_sessions_per_week || 2;

  // Derive effective hourly rate from schedule slots (falls back to profile price_per_hour)
  const scheduleMinPrice = (() => {
    const sched = tutor?.schedule;
    if (!sched) return tutor?.price_per_hour || 0;
    const prices = [];
    WEEK_KEYS.forEach(k => {
      (sched[k] || []).forEach(sl => {
        if (sl && typeof sl === "object") {
          if ((sl.priceInd || 0) > 0) prices.push(sl.priceInd);
          if ((sl.priceGrp || 0) > 0) prices.push(sl.priceGrp);
        }
      });
    });
    if (prices.length > 0) return Math.min(...prices);
    const def = sched._prices;
    if ((def?.individual || 0) > 0) return def.individual;
    if ((def?.group || 0) > 0) return def.group;
    return tutor?.price_per_hour || 0;
  })();

  function togglePkgSlot(day, time) {
    setPkgDaySlots(prev => {
      const exists = prev.find(s => s.day === day && s.time === time);
      if (exists) return prev.filter(s => !(s.day === day && s.time === time));
      const days = new Set(prev.map(s => s.day));
      if (!days.has(day) && days.size >= pkgDaysPerWeek) return prev;
      return [...prev.filter(s => s.day !== day), { day, time }];
    });
  }

  function pkgTotalSessions() { return pkgMonths * 4 * pkgDaySlots.length; }
  function pkgDiscount() {
    if (pkgMonths >= 6) return 0.15;
    if (pkgMonths >= 3) return 0.10;
    if (pkgMonths >= 2) return 0.05;
    return 0;
  }
  function pkgTotalPrice() {
    return Math.round(pkgTotalSessions() * scheduleMinPrice * (1 - pkgDiscount()));
  }

  function recSelectedDates() {
    if (!repeatAll || recDates.length === 0) return recDates;
    const all = [];
    recDates.forEach(baseDate => {
      for (let w = 0; w < recWeeks; w++) all.push(addWeeks(baseDate, w));
    });
    return all;
  }

  function summaryPrice() {
    if (bookingType === "trial") return tutor?.trial_price || 0;
    if (bookingType === "single") {
      if (isEditing) {
        const slotDur = selectedSlot?.duration || duration;
        // priceInd/priceGrp is the total slot price (not per-hour), so no multiplication
        return selectedSlot?.price > 0 ? selectedSlot.price : scheduleMinPrice * slotDur;
      }
      const entries = Object.values(selectedSlotsByDate);
      if (!entries.length) return 0;
      return entries.reduce((sum, e) => {
        const d = e.slot?.duration || duration;
        return sum + (e.slot?.price > 0 ? e.slot.price : scheduleMinPrice * d);
      }, 0);
    }
    if (bookingType === "package")   return pkgTotalPrice();
    if (bookingType === "recurring") return scheduleMinPrice * duration * recSelectedDates().length;
    return 0;
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    const supabase  = createClient();
    const studentId = selectedStudentId || currentUser.id;

    try {

      // ──────────────────────────────────────────
      // ✅ RACE CONDITION GUARD:
      // submit-მდე სლოტები ხელახლა ამოვიკითხოთ DB-იდან
      // ──────────────────────────────────────────
      let freshBookings = existingBookings;
      if (selectedDate) {
        freshBookings = await fetchSlotsForDate(id, formatDateStr(selectedDate), editBookingId);
        setExistingBookings(freshBookings);
      }

      // ── რედაქტირება ──
      if (isEditing && editBookingId) {
        if (!selectedDate || !selectedTime) throw new Error("გთხოვთ აირჩიოთ თარიღი და დრო");

        const conflict = freshBookings.find(b => b.time_slot === selectedTime);
        if (conflict) throw new Error("ეს სლოტი სხვამ დაჯავშნა. გთხოვთ აირჩიოთ სხვა დრო");

        const { error: updateErr } = await supabase
          .from("bookings")
          .update({
            date:           formatDateStr(selectedDate),
            time_slot:      selectedTime,
            duration_hours: duration,
            format,
            total_price:    selectedSlot?.price > 0 ? selectedSlot.price : scheduleMinPrice * duration,
            note:           note.trim() || null,
          })
          .eq("id", editBookingId);

        if (updateErr) throw updateErr;
        router.push("/dashboard/student/lessons?updated=1");
        return;
      }

      // ── helper: სლოტის ხელმისაწვდომობის შემოწმება ──
      function checkSlotAvailability(dateObj, timeStr, bookings) {
        const dayKey  = WEEK_KEYS[dateObj.getDay()];
        const rawSlot = (tutor?.schedule?.[dayKey] || []).find(s =>
          typeof s === "string" ? s === timeStr : (s.start || s.time) === timeStr
        );
        if (!rawSlot) throw new Error("სლოტი ვერ მოიძებნა");

        const slotObj = normaliseSlot(rawSlot);
        const status  = getSlotStatus(slotObj, bookings);
        if (!status.available) {
          if (slotObj.type === "group") {
            throw new Error(`ჯგუფური სლოტი სავსეა (${status.max}/${status.max}). გთხოვთ აირჩიოთ სხვა`);
          } else {
            throw new Error("ეს სლოტი უკვე დაჯავშნილია. გთხოვთ აირჩიოთ სხვა დრო");
          }
        }
        return slotObj;
      }

      // ── 2-hour rule: reject if booking is for today and slot is < 2h away ──
      function check2hRule(dateObj, timeStr) {
        const now    = new Date();
        const isToday = formatDateStr(dateObj) === formatDateStr(now);
        if (!isToday) return;
        const [sh, sm] = timeStr.split(":").map(Number);
        const slotMin  = sh * 60 + sm;
        const nowMin   = now.getHours() * 60 + now.getMinutes();
        if (slotMin - nowMin < 120) throw new Error("სლოტამდე 2 საათზე ნაკლებია — ჩაწერა შეუძლებელია");
      }

      // ── TRIAL ──
      if (bookingType === "trial") {
        if (!selectedDate || !selectedTime) throw new Error("გთხოვთ აირჩიოთ თარიღი და დრო");
        if (hasTrial) throw new Error("საცდელი გაკვეთილი უკვე გამოყენებულია");
        check2hRule(selectedDate, selectedTime);

        // Check the slot with the ORIGINAL duration (before conversion)
        const trialInfo = getTrialSlotsForDate(selectedDate, tutor);
        const trialSlot = trialInfo.slots.find(s => s.time === selectedTime);
        if (!trialSlot) throw new Error("სლოტი ვერ მოიძებნა");
        checkSlotAvailability(selectedDate, selectedTime, freshBookings);

        const trialDurMin = tutor?.trial_duration || 30;
        const trialDurH   = trialDurMin / 60;

        const { error: bErr } = await supabase.from("bookings").insert({
          student_id:     studentId,
          tutor_id:       id,
          date:           formatDateStr(selectedDate),
          time_slot:      selectedTime,
          duration_hours: trialDurH,
          format,
          total_price:    tutor?.trial_price || 0,
          note:           note.trim() || null,
          status:         "pending",
          booking_type:   "trial",
        });
        if (bErr) {
          if (bErr.code === "23505") throw new Error("ეს სლოტი სხვამ ახლახან დაჯავშნა. გთხოვთ სხვა დრო აირჩიოთ");
          throw bErr;
        }

        await supabase.from("trial_lessons").insert({ student_id: studentId, tutor_id: id });

        // Tutor notification — explain conversion if slot was converted
        const isConverted = trialInfo.isConverted;
        const origLabel = trialInfo.originalDur >= 1
          ? `${trialInfo.originalDur}სთ`
          : `${Math.round(trialInfo.originalDur * 60)}წთ`;
        const notifBody = isConverted
          ? `სტუდენტმა ისარგებლა ${trialDurMin}წთ-იანი საცდელი გაკვეთილით. ${formatDateStr(selectedDate)} ${selectedTime}-ზე ${origLabel} სლოტი გადაიქცა ${trialDurMin}წთ-ად საცდელი გაკვეთილისთვის.`
          : `საცდელი გაკვეთილი — ${formatDateStr(selectedDate)} ${selectedTime}`;
        await supabase.from("notifications").insert({
          user_id: id,
          type:    "booking",
          title:   isConverted ? "🎓 საცდელი — სლოტის კონვერტაცია" : "ახალი ჯავშანი 📅",
          body:    notifBody,
          is_read: false,
        }).then(() => {}).catch(() => {});

        setSuccess({ type: "trial", price: tutor?.trial_price || 0 });
      }

      // ── SINGLE ──
      else if (bookingType === "single") {
        const entries = Object.values(selectedSlotsByDate);
        if (entries.length === 0) throw new Error("გთხოვთ აირჩიოთ სულ მცირე ერთი სლოტი");

        for (const e of entries) check2hRule(e.date, e.time);

        const bookingsToInsert = [];
        for (const e of entries) {
          const dStr   = formatDateStr(e.date);
          const freshBk = await fetchSlotsForDate(id, dStr, editBookingId);
          checkSlotAvailability(e.date, e.time, freshBk);
          const slotDur = e.slot?.duration || duration;
          const slotPrc = e.slot?.price > 0 ? e.slot.price : scheduleMinPrice * slotDur;
          bookingsToInsert.push({
            student_id:     studentId,
            tutor_id:       id,
            date:           dStr,
            time_slot:      e.time,
            duration_hours: slotDur,
            format,
            total_price:    slotPrc,
            note:           note.trim() || null,
            status:         "pending",
            booking_type:   "single",
          });
        }

        const { error: bErr } = await supabase.from("bookings").insert(bookingsToInsert);
        if (bErr) {
          if (bErr.code === "23505") throw new Error("ერთ-ერთი სლოტი სხვამ ახლახან დაჯავშნა. გთხოვთ სხვა დრო აირჩიოთ");
          throw bErr;
        }

        const totalPrice = bookingsToInsert.reduce((s, b) => s + b.total_price, 0);
        const body = bookingsToInsert.length > 1
          ? `${bookingsToInsert.length} გაკვეთილი · ${totalPrice}₾`
          : `${bookingsToInsert[0].date} ${bookingsToInsert[0].time_slot} — ${totalPrice}₾`;

        await supabase.from("notifications").insert({
          user_id: id,
          type:    "booking",
          title:   "ახალი ჯავშანი 📅",
          body,
          is_read: false,
        }).then(() => {}).catch(() => {});

        setSuccess({ type: "single", price: totalPrice });
      }

      // ── PACKAGE ──
else if (bookingType === "package") {
  if (pkgDaySlots.length === 0) throw new Error("გთხოვთ აირჩიოთ სასწავლო დღეები");

  const startDate = new Date();
  const endDate   = new Date();
  endDate.setMonth(endDate.getMonth() + pkgMonths);

  // 1. booking_series შევქმნათ
  const { data: series, error: seriesErr } = await supabase
    .from("booking_series")
    .insert({
      student_id:     studentId,
      tutor_id:       id,
      days_and_times: pkgDaySlots,
      starts_at:      formatDateStr(startDate),
      ends_at:        formatDateStr(endDate),
      total_sessions: pkgTotalSessions(),
      status:         "pending",
    })
    .select().single();
  if (seriesErr) throw seriesErr;

  // 2. packages ცხრილი
  const { data: pkg, error: pkgErr } = await supabase
    .from("packages")
    .insert({
      student_id:        studentId,
      tutor_id:          id,
      months:            pkgMonths,
      sessions_per_week: pkgDaySlots.length,
      days_and_times:    pkgDaySlots,
      total_sessions:    pkgTotalSessions(),
      total_price:       pkgTotalPrice(),
      starts_at:         formatDateStr(startDate),
      ends_at:           formatDateStr(endDate),
    })
    .select().single();
  if (pkgErr) throw pkgErr;

  // 3. individual bookings — series_id-ით
  const WEEK_KEYS_ORDER = ["sun","mon","tue","wed","thu","fri","sat"];
  const bookingsToInsert = [];
  for (let w = 0; w < pkgMonths * 4; w++) {
    for (const slot of pkgDaySlots) {
      const targetIdx  = WEEK_KEYS_ORDER.indexOf(slot.day);
      const currentDay = new Date().getDay();
      let diff = targetIdx - currentDay;
      if (diff <= 0) diff += 7;
      const firstDate = new Date();
      firstDate.setDate(firstDate.getDate() + diff + w * 7);
      bookingsToInsert.push({
        student_id:     studentId,
        tutor_id:       id,
        date:           formatDateStr(firstDate),
        time_slot:      slot.time,
        duration_hours: 1,
        format,
        total_price:    0,
        status:         "pending",
        booking_type:   "package",
        package_id:     pkg.id,
        series_id:      series.id,
      });
    }
  }

  const { error: bErr } = await supabase.from("bookings").insert(bookingsToInsert);
  if (bErr) throw bErr;

  // 4. მასწავლებელს შეტყობინება — ᲔᲠᲗᲘ შეტყობინება მთელ პაკეტზე
  await supabase.from("notifications").insert({
    user_id: id,
    type:    "booking",
    title:   "ახალი პაკეტი 📦",
    body:    `${pkgMonths} თვე · ${pkgTotalSessions()} გაკვეთილი · ${pkgTotalPrice()}₾. ერთი დაჭერით დაადასტურე ყველა!`,
    link:    `/dashboard/tutor/bookings?series=${series.id}`,
    is_read: false,
  }).then(() => {}).catch(() => {});

  setSuccess({
    type: "package", months: pkgMonths,
    sessions: pkgTotalSessions(), price: pkgTotalPrice(),
    discount: Math.round(pkgDiscount()*100),
  });
}

      // ── RECURRING ──
      else if (bookingType === "recurring") {
        const allDates = recSelectedDates();
        if (allDates.length === 0) throw new Error("გთხოვთ აირჩიოთ სასწავლო დღეები");
        if (!allDates.every(d => recTimes[formatDateStr(d)])) throw new Error("ყველა თარიღისთვის გთხოვთ აირჩიოთ დრო");

        const bookingsToInsert = allDates.map(date => ({
          student_id:     studentId,
          tutor_id:       id,
          date:           formatDateStr(date),
          time_slot:      recTimes[formatDateStr(date)],
          duration_hours: duration,
          format,
          total_price:    scheduleMinPrice * duration,
          note:           note.trim() || null,
          status:         "pending",
          booking_type:   "recurring",
          repeat_weekly:  repeatAll,
        }));

        const { error: bErr } = await supabase.from("bookings").insert(bookingsToInsert);
        if (bErr) throw bErr;

        // ✅ მასწავლებელს შეტყობინება
        await supabase.from("notifications").insert({
          user_id: id,
          type:    "booking",
          title:   "ახალი განმეორებადი ჯავშანი 🔁",
          body:    `${bookingsToInsert.length} გაკვეთილი · ${scheduleMinPrice*duration*bookingsToInsert.length}₾`,
          is_read: false,
        }).then(() => {}).catch(() => {});

        setSuccess({
          type: "recurring",
          count: bookingsToInsert.length,
          price: scheduleMinPrice*duration*bookingsToInsert.length,
        });
      }

    } catch (err) {
      setError(err.message || "შეცდომა. სცადეთ ხელახლა.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="card p-10 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            {success.type === "trial"     ? "საცდელი გაკვეთილი დაჯავშნილია!" :
             success.type === "single"    ? "გაკვეთილი დაჯავშნილია!" :
             success.type === "package"   ? "პაკეტი შეძენილია!" :
             "გაკვეთილები დაჯავშნილია!"}
          </h1>
          <p className="text-gray-500 text-sm mb-4">{tutor?.profiles?.full_name}</p>
          {success.type === "package" && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-4">
              📦 {success.months} თვე · {success.sessions} გაკვეთილი
              {success.discount > 0 && ` · -${success.discount}%`}
              <br /><strong>{success.price} ₾</strong>
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-xl mb-6">
            ⏳ მასწავლებელი დაადასტურებს ჯავშანს მალე
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/student/lessons" className="flex-1 btn-primary py-3 text-center">
              ჩემი გაკვეთილები
            </Link>
            <Link href="/search" className="flex-1 btn-secondary py-3 text-center">
              სხვა მასწ.
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // კვირის სწორი თანმიმდევრობა
  const WEEK_ORDER = ["mon","tue","wed","thu","fri","sat","sun"];
  const availableDays = tutor?.schedule
    ? WEEK_ORDER.filter(day => (tutor.schedule[day] || []).length > 0 && day !== "_vacation" && day !== "_buffer")
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="page-container flex items-center justify-between h-16">
          <Link href={`/tutor/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← პროფილი</Link>
          <Link href="/" className="text-lg font-black">Tutor<span className="text-emerald-600">Hub</span></Link>
          <div className="w-20" />
        </div>
      </div>

      <div className="page-container py-8 grid md:grid-cols-[1fr_300px] gap-8 items-start">
        <div className="space-y-5">

          {isEditing && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-xl">
              ✏️ <strong>ჯავშნის რედაქტირება</strong> — აირჩიეთ ახალი თარიღი და დრო
            </div>
          )}

          <div className="card p-5 flex items-center gap-4">
            <div className="avatar w-14 h-14 avatar-green text-lg flex-shrink-0 overflow-hidden">
              {tutor?.profiles?.avatar_url
                ? <img src={tutor.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                : tutor?.profiles?.full_name?.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()
              }
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-900">{tutor?.profiles?.full_name}</h2>
              <p className="text-sm text-gray-400">{tutor?.subject?.slice(0,2).join(", ")} · ⭐ {tutor?.rating}</p>
              {scheduleMinPrice > 0 && (
                <p className="text-sm font-black text-emerald-600 mt-0.5">
                  {selectedSlot?.price > 0 ? selectedSlot.price : scheduleMinPrice} ₾/სთ
                </p>
              )}
            </div>
          </div>

          {userRole === "parent" && children.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-gray-900 mb-3">👶 ვის სახელით ჯავშნავ?</h3>
              <div className="flex flex-col gap-2">
                {children.map((child, i) => (
                  <label key={child.id}
                    onClick={() => setSelectedStudentId(child.profiles?.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedStudentId === child.profiles?.id
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}>
                    <div className={`avatar w-8 h-8 text-xs ${["avatar-blue","avatar-green","avatar-amber","avatar-purple"][i%4]}`}>
                      {child.profiles?.full_name?.[0]}
                    </div>
                    <span className="text-sm font-medium">{child.profiles?.full_name}</span>
                    <input type="radio" name="student"
                      checked={selectedStudentId === child.profiles?.id}
                      onChange={() => setSelectedStudentId(child.profiles?.id)}
                      className="ml-auto accent-blue-600" readOnly />
                  </label>
                ))}
              </div>
            </div>
          )}

          {tutor?.is_online && tutor?.is_offline && (
            <div className="card p-5">
              <h3 className="font-bold text-gray-900 mb-3">გაკვეთილის ფორმატი</h3>
              <div className="grid grid-cols-2 gap-3">
                {[["online","🌐","ონლაინ"],["offline","🏫","პირისპირ"]].map(([k,icon,label]) => (
                  <button key={k} onClick={() => setFormat(k)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      format===k ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}>
                    <span className="text-xl block mb-1">{icon}</span>{label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isEditing && (
            <TypeSelector value={bookingType} onChange={t => {
            setBookingType(t);
            setSelectedSlotsByDate({});
            setSelectedDate(null);
            setSelectedTime("");
            setSelectedSlot(null);
          }} hasTrial={hasTrial} />
          )}

          {(bookingType === "trial" || bookingType === "single" || isEditing) && (
            <div className="card p-5 space-y-4">
              {bookingType === "trial" && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
                  🎓 საცდელი: <strong>{tutor?.trial_duration || 30} წუთი</strong>
                  {(tutor?.trial_price||0)===0 ? " — უფასო" : ` — ${tutor?.trial_price} ₾`}
                </div>
              )}
              <h3 className="font-bold text-gray-900">📅 თარიღის არჩევა</h3>
              {(() => {
                // Compute trial short-slot restriction (next 5 days with 15/30min individual slots)
                let trialShortDates = null;
                if (bookingType === "trial" && tutor?.schedule) {
                  const shortDurs = [0.25, 0.5];
                  const result = new Set();
                  for (let i = 0; i <= 5; i++) {
                    const d = new Date(today || new Date());
                    d.setDate(d.getDate() + i);
                    const dk = WEEK_KEYS[d.getDay()];
                    const raw = tutor.schedule[dk] || [];
                    const hasShort = raw.some(s => {
                      const ns = normaliseSlot(s);
                      return ns.type !== "group" && shortDurs.some(sd => Math.abs(Number(ns.duration) - sd) < 0.001);
                    });
                    if (hasShort) result.add(formatDateStr(d));
                  }
                  if (result.size > 0) trialShortDates = result;
                }
                const calDates = bookingType === "single" && !isEditing
                  ? [selectedDate, ...Object.values(selectedSlotsByDate).map(s => s.date)]
                      .filter((d, i, arr) => d && arr.findIndex(x => x && x.toDateString() === d.toDateString()) === i)
                  : (selectedDate ? [selectedDate] : []);
                return (
                  <Calendar tutor={tutor} selectedDates={calDates}
                    onSelect={d => { setSelectedDate(d[0]); setSelectedTime(""); setSelectedSlot(null); }}
                    today={today} trialShortDates={trialShortDates} />
                );
              })()}
              {selectedDate && bookingType === "trial" && (
                <>
                  <h3 className="font-bold text-gray-900">🕐 სლოტის არჩევა</h3>
                  {(() => {
                    const trialInfo = getTrialSlotsForDate(selectedDate, tutor);
                    const trialDurMin = tutor?.trial_duration || 30;
                    if (trialInfo.slots.length === 0) {
                      return <p className="text-sm text-gray-400 text-center py-4">ამ დღეს შესაფერისი სლოტი არ არის</p>;
                    }
                    const origLabel = trialInfo.originalDur >= 1
                      ? `${trialInfo.originalDur}სთ`
                      : `${Math.round(trialInfo.originalDur * 60)}წთ`;
                    return (
                      <>
                        {trialInfo.isConverted && (
                          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2.5 rounded-xl leading-relaxed">
                            ⚠️ ეს {origLabel} სლოტი გადაიქცევა <strong>{trialDurMin}წთ</strong>-ად საცდელი გაკვეთილისთვის. მასწავლებელს ეცნობება.
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {trialInfo.slots.map(slot => {
                            const status = getSlotStatus(slot, existingBookings);
                            const tooSoon = (() => {
                              if (!today || !selectedDate) return false;
                              if (formatDateStr(selectedDate) !== formatDateStr(today)) return false;
                              const [sh, sm] = slot.time.split(":").map(Number);
                              return (sh * 60 + sm) - (today.getHours() * 60 + today.getMinutes()) < 120;
                            })();
                            const disabled = !status.available || tooSoon;
                            const sel = selectedTime === slot.time;
                            return (
                              <button key={slot.time}
                                onClick={() => {
                                  if (disabled) return;
                                  if (sel) { setSelectedTime(""); setSelectedSlot(null); }
                                  else { setSelectedTime(slot.time); setSelectedSlot(slot); }
                                }}
                                disabled={disabled}
                                className={`py-3 px-3 rounded-xl border transition-all text-left ${
                                  disabled
                                    ? "bg-gray-50 border-gray-100 cursor-not-allowed"
                                    : sel
                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                      : "border-gray-200 hover:border-emerald-400"
                                }`}>
                                <p className={`text-sm font-bold ${disabled ? "text-gray-300" : sel ? "text-white" : "text-gray-800"}`}>
                                  {slot.time}
                                </p>
                                <p className={`text-xs font-semibold ${disabled ? "text-gray-300" : sel ? "text-emerald-100" : "text-gray-500"}`}>
                                  → {trialDurMin}წთ · {(tutor?.trial_price||0)===0 ? "🆓 უფასო" : `${tutor?.trial_price}₾`}
                                </p>
                                <p className={`text-xs mt-0.5 ${disabled ? "text-gray-300" : sel ? "text-emerald-200" : "text-gray-400"}`}>
                                  {disabled ? "⏰ დაკავებული" : "✅ თავისუფალი"}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
              {selectedDate && bookingType !== "trial" && (
                <>
                  <h3 className="font-bold text-gray-900">🕐 სლოტის არჩევა</h3>
                  {(() => {
                    const dStr   = formatDateStr(selectedDate);
                    const curEnt = (bookingType === "single" && !isEditing) ? selectedSlotsByDate[dStr] : null;
                    const curTime = curEnt?.time || selectedTime;
                    return (
                      <TimeSelector
                        tutor={tutor}
                        date={selectedDate}
                        existingBookings={existingBookings}
                        selected={curTime}
                        onSelect={time => {
                          if (bookingType === "single" && !isEditing) {
                            if (!time) {
                              setSelectedSlotsByDate(prev => { const n={...prev}; delete n[dStr]; return n; });
                            } else {
                              setSelectedSlotsByDate(prev => ({ ...prev, [dStr]: { date: selectedDate, time, slot: curEnt?.slot || null } }));
                            }
                          } else {
                            setSelectedTime(time);
                          }
                        }}
                        onSlotSelect={slot => {
                          if (bookingType === "single" && !isEditing) {
                            if (!slot) {
                              setSelectedSlotsByDate(prev => { const n={...prev}; delete n[dStr]; return n; });
                            } else {
                              setSelectedSlotsByDate(prev => ({ ...prev, [dStr]: { date: selectedDate, time: slot.time, slot } }));
                              setDuration(slot.duration || 1);
                            }
                          } else {
                            setSelectedSlot(slot);
                            if (slot) setDuration(slot.duration || 1);
                          }
                        }}
                        today={today}
                      />
                    );
                  })()}
                </>
              )}
              {(() => {
                const dStr = selectedDate ? formatDateStr(selectedDate) : null;
                const curEnt = dStr ? selectedSlotsByDate[dStr] : null;
                if (!curEnt || bookingType !== "single" || isEditing) return null;
                return (
                  <>
                    <h3 className="font-bold text-gray-900">⏱ ხანგრძლივობა</h3>
                    {curEnt.slot?.duration ? (
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                        <span className="text-sm font-semibold text-gray-700">{curEnt.slot.duration} სთ</span>
                        {curEnt.slot.price > 0 && (
                          <span className="text-sm font-black text-emerald-600">{curEnt.slot.price} ₾</span>
                        )}
                        <span className="text-xs text-gray-400">მასწავლებლის მიერ განსაზღვრული</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {[1,1.5,2].map(h => (
                          <button key={h} onClick={() => setDuration(h)}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                              duration===h ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-600 hover:border-emerald-400"
                            }`}>
                            {h} სთ
                            <span className={`block text-xs mt-0.5 ${duration===h?"text-emerald-200":"text-gray-400"}`}>
                              {scheduleMinPrice*h} ₾
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {bookingType === "package" && !isEditing && (
            <div className="card p-5 space-y-5">
              {availableDays.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-xl">
                  ⚠️ მასწავლებელს განრიგი არ აქვს შევსებული
                </div>
              )}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">📦 პაკეტის ხანგრძლივობა</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[1,2,3,4,5,6].map(m => {
                    const disc = m>=6?15:m>=3?10:m>=2?5:0;
                    return (
                      <button key={m} onClick={() => setPkgMonths(m)}
                        className={`py-3 rounded-xl border text-center transition-all ${
                          pkgMonths===m ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-emerald-300"
                        }`}>
                        <p className={`text-sm font-bold ${pkgMonths===m?"text-emerald-700":"text-gray-700"}`}>{m} თვე</p>
                        {disc>0 && <p className="text-xs text-emerald-600">-{disc}%</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-3">კვირაში გაკვეთილები</h3>
                <div className="flex gap-2">
                  {[2, maxDaysPerWeek===3?3:null].filter(Boolean).map(n => (
                    <button key={n} onClick={() => { setPkgDaysPerWeek(n); setPkgDaySlots([]); }}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        pkgDaysPerWeek===n ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600 hover:border-emerald-300"
                      }`}>
                      კვირაში {n}-ჯერ
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">📅 სასწავლო დღეები და საათები</h3>
                <p className="text-xs text-gray-400 mb-3">
                  აირჩიეთ <strong>{pkgDaysPerWeek} დღე</strong> და თითოეულისთვის სასურველი საათი
                </p>

                {/* არჩეული დღეების counter */}
                <div className="flex items-center gap-2 mb-3">
                  {Array.from({ length: pkgDaysPerWeek }).map((_, i) => {
                    const chosen = pkgDaySlots[i];
                    return (
                      <div key={i} className={`flex-1 py-2 px-3 rounded-xl border text-xs text-center transition-all ${
                        chosen
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
                          : "border-dashed border-gray-300 text-gray-400"
                      }`}>
                        {chosen ? `${WEEK_NAMES[chosen.day]} ${chosen.time}` : `${i+1}. დღე`}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  {availableDays.map(day => {
                    const rawSlots     = tutor?.schedule?.[day] || [];
                    const slots        = rawSlots.map(normaliseSlot).filter(s => s.time);
                    const chosen       = pkgDaySlots.find(s => s.day === day);
                    const daysSelected = new Set(pkgDaySlots.map(s => s.day));
                    const maxReached   = daysSelected.size >= pkgDaysPerWeek && !daysSelected.has(day);

                    return (
                      <div key={day} className={`rounded-xl border transition-all overflow-hidden ${
                        chosen
                          ? "border-emerald-400 shadow-sm"
                          : maxReached
                          ? "border-gray-100 opacity-50"
                          : "border-gray-200"
                      }`}>
                        {/* დღის header */}
                        <div className={`flex items-center justify-between px-4 py-3 ${
                          chosen ? "bg-emerald-50" : "bg-gray-50"
                        }`}>
                          <div className="flex items-center gap-2">
                            {chosen
                              ? <span className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs">✓</span>
                              : <span className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                            }
                            <p className="text-sm font-semibold text-gray-800">{WEEK_NAMES[day]}</p>
                          </div>
                          {chosen && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                {chosen.time}
                              </span>
                              <button
                                onClick={() => setPkgDaySlots(prev => prev.filter(s => s.day !== day))}
                                className="text-xs text-red-400 hover:text-red-600 px-1"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          {maxReached && !chosen && (
                            <span className="text-xs text-gray-400">მაქს. მიღწეულია</span>
                          )}
                        </div>

                        {/* საათების სია */}
                        {(!maxReached || chosen) && (
                          <div className="px-4 py-3">
                            <p className="text-xs text-gray-400 mb-2">სასურველი საათი:</p>
                            <div className="flex flex-wrap gap-2">
                              {slots.map(slot => {
                                const sel     = chosen?.time === slot.time;
                                const isGroup = slot.type === "group";
                                return (
                                  <button
                                    key={slot.time}
                                    onClick={() => togglePkgSlot(day, slot.time)}
                                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                                      sel
                                        ? isGroup
                                          ? "bg-blue-600 text-white border-blue-600"
                                          : "bg-emerald-600 text-white border-emerald-600"
                                        : isGroup
                                        ? "border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-400"
                                        : "border-gray-200 text-gray-600 hover:border-emerald-400 hover:bg-emerald-50"
                                    }`}
                                  >
                                    <span className="block">{slot.time}</span>
                                    {isGroup && (
                                      <span className={`text-xs ${sel ? "text-blue-200" : "text-blue-400"}`}>
                                        👥 ჯგუფ.
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {pkgDaySlots.length>0 && (
                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">სულ გაკვეთილი</span><span className="font-semibold">{pkgTotalSessions()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ფასდაკლება</span><span className="font-semibold text-emerald-600">{Math.round(pkgDiscount()*100)}%</span></div>
                  <div className="flex justify-between font-bold"><span>სულ</span><span className="text-emerald-600">{pkgTotalPrice()} ₾</span></div>
                </div>
              )}
            </div>
          )}

          {bookingType === "recurring" && !isEditing && (
            <div className="card p-5 space-y-5">
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-xl">
                🔁 მონიშნეთ ბაზისური კვირის დღეები
              </div>
              <h3 className="font-bold text-gray-900">📅 დღეების არჩევა</h3>
              <Calendar tutor={tutor} selectedDates={recDates}
                onSelect={dates => {
                  setRecDates(dates);
                  setRecTimes(prev => {
                    const next = {};
                    dates.forEach(d => { const k=formatDateStr(d); if(prev[k]) next[k]=prev[k]; });
                    return next;
                  });
                }} multi={true} today={today} />
              {recDates.length>0 && (
                <div className="space-y-4">
                  {recDates.sort((a,b)=>a-b).map(date => {
                    const k = formatDateStr(date);
                    return (
                      <div key={k}>
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          {date.toLocaleDateString("ka-GE",{weekday:"long",day:"numeric",month:"short"})}
                        </p>
                        <TimeSelector tutor={tutor} date={date} existingBookings={[]}
                          selected={recTimes[k]||""} onSelect={time=>setRecTimes(prev=>({...prev,[k]:time}))} today={today} />
                      </div>
                    );
                  })}
                </div>
              )}
              {recDates.length>0 && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">🔁 ყველა კვირაზე გამეორება</p>
                      <p className="text-xs text-gray-400">{recDates.length} დღე × {recWeeks} კვ = {recDates.length*recWeeks} გაკვ.</p>
                    </div>
                    <button onClick={()=>setRepeatAll(o=>!o)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${repeatAll?"bg-emerald-600":"bg-gray-200"}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${repeatAll?"translate-x-6":"translate-x-1"}`} />
                    </button>
                  </div>
                  {repeatAll && (
                    <div className="flex gap-2">
                      {[2,4,8,12].map(w=>(
                        <button key={w} onClick={()=>setRecWeeks(w)}
                          className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${recWeeks===w?"border-emerald-500 bg-emerald-50 text-emerald-700":"border-gray-200 text-gray-600 hover:border-emerald-300"}`}>
                          {w} კვ.
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {recDates.length>0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">⏱ ხანგრძლივობა</h3>
                  <div className="flex gap-2">
                    {[1,1.5,2].map(h=>(
                      <button key={h} onClick={()=>setDuration(h)}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${duration===h?"bg-emerald-600 text-white border-emerald-600":"border-gray-200 text-gray-600 hover:border-emerald-400"}`}>
                        {h} სთ
                        <span className={`block text-xs mt-0.5 ${duration===h?"text-emerald-200":"text-gray-400"}`}>{scheduleMinPrice*h} ₾/გაკვ.</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-bold text-gray-900 mb-2">📝 შენიშვნა</h3>
            <textarea className="input resize-none" rows={3}
              placeholder="მაგ: მე-10 კლასელი ვარ..."
              value={note} onChange={e=>setNote(e.target.value)} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              ❌ {error}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card p-6 sticky top-24">
          <h3 className="font-bold text-gray-900 mb-4">
            {isEditing ? "✏️ ჯავშნის რედაქტირება" : "📋 შეჯამება"}
          </h3>
          <div className="space-y-2 mb-5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">მასწავლებელი</span>
              <span className="font-medium">{tutor?.profiles?.full_name}</span>
            </div>
            {/* Booking type */}
            {!isEditing && (
              <div className="flex justify-between">
                <span className="text-gray-500">ტიპი</span>
                <span className="font-medium">
                  {bookingType==="trial"     ? "🎓 საცდელი"   :
                   bookingType==="single"    ? "📅 ერთჯერადი" :
                   bookingType==="package"   ? "📦 პაკეტი"    :
                   bookingType==="recurring" ? "🔁 განმეოარ." : "—"}
                </span>
              </div>
            )}
            {/* Format */}
            <div className="flex justify-between">
              <span className="text-gray-500">ფორმატი</span>
              <span className="font-medium">{format==="online" ? "🌐 ონლაინ" : "🏫 პირისპირ"}</span>
            </div>
            {/* Single booking: list each selected date/time */}
            {bookingType === "single" && !isEditing && Object.keys(selectedSlotsByDate).length > 0 && (
              <div className="mt-1 space-y-1">
                <hr className="border-gray-100" />
                {Object.entries(selectedSlotsByDate).sort().map(([dStr, e]) => {
                  const slotDur = e.slot?.duration || duration;
                  const slotPrc = e.slot?.price > 0 ? e.slot.price : scheduleMinPrice * slotDur;
                  const isGrp   = e.slot?.type === "group";
                  return (
                    <div key={dStr} className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${isGrp ? "bg-blue-500" : "bg-emerald-500"}`}/>
                        <div>
                          <span className="text-gray-700 font-medium block">
                            {e.date.toLocaleDateString("ka-GE",{day:"numeric",month:"short"})} · {e.time}
                          </span>
                          <span className={`text-xs font-semibold ${isGrp ? "text-blue-600" : "text-emerald-600"}`}>
                            {isGrp ? "👥 ჯგუფური" : "👤 ინდივიდუალური"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-gray-400 text-xs">{slotDur}სთ</span>
                        <span className="font-semibold text-emerald-600">{slotPrc}₾</span>
                        <button onClick={() => setSelectedSlotsByDate(prev => {
                          const n={...prev}; delete n[dStr]; return n;
                        })} className="text-gray-300 hover:text-red-400 text-xs ml-0.5">✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Single editing: show date/time */}
            {(isEditing || bookingType === "trial") && selectedDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">თარიღი</span>
                <span className="font-medium">{selectedDate.toLocaleDateString("ka-GE",{day:"numeric",month:"short"})}</span>
              </div>
            )}
            {(isEditing || bookingType === "trial") && selectedTime && (
              <div className="flex justify-between">
                <span className="text-gray-500">დრო</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
            )}
            {/* Duration for non-single types */}
            {(bookingType === "trial" || isEditing) && (
              <div className="flex justify-between">
                <span className="text-gray-500">ხანგრძლ.</span>
                <span className="font-medium">
                  {bookingType==="trial" ? `${tutor?.trial_duration||30}წთ` : `${duration}სთ`}
                </span>
              </div>
            )}
            {/* Recurring summary */}
            {bookingType === "recurring" && recSelectedDates().length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">გაკვეთილები</span>
                <span className="font-medium">{recSelectedDates().length} × {duration}სთ</span>
              </div>
            )}
            {/* Package summary */}
            {bookingType === "package" && pkgDaySlots.length > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">პაკეტი</span>
                  <span className="font-medium">{pkgMonths} თვე</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">სულ გაკვეთ.</span>
                  <span className="font-medium">{pkgTotalSessions()}</span>
                </div>
                {pkgDiscount() > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">ფასდაკლ.</span>
                    <span className="font-medium text-emerald-600">-{Math.round(pkgDiscount()*100)}%</span>
                  </div>
                )}
              </>
            )}
            <hr className="border-gray-100" />
            <div className="flex justify-between">
              <span className="font-bold">სულ</span>
              <span className="font-black text-xl text-emerald-600">{summaryPrice()} ₾</span>
            </div>
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            className="btn-primary w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                მიმდინარეობს...
              </span>
            ) : isEditing ? "განახლება →" : "დაჯავშნა →"}
          </button>

          <div className="mt-4 space-y-1.5">
            {["გაუქმება 24 სთ-ით ადრე","დადასტურება მასწავლებლისგან","უსაფრთხო გადახდა"].map(t=>(
              <p key={t} className="text-xs text-gray-400 flex items-center gap-1.5">✓ {t}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BookingContent />
    </Suspense>
  );
}