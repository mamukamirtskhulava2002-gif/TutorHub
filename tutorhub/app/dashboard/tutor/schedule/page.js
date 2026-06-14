"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import DashboardSidebar from "@/components/DashboardSidebar";
import CreateSlotModal from "@/components/CreateSlotModal";

// ── Constants ────────────────────────────────────────────────────────────────
const WEEKDAYS = [
  { key: "mon", label: "ორშ", full: "ორშაბათი",  jsDay: 1 },
  { key: "tue", label: "სამ", full: "სამშაბათი", jsDay: 2 },
  { key: "wed", label: "ოთხ", full: "ოთხშაბათი", jsDay: 3 },
  { key: "thu", label: "ხუთ", full: "ხუთშაბათი", jsDay: 4 },
  { key: "fri", label: "პარ", full: "პარასკევი",  jsDay: 5 },
  { key: "sat", label: "შაბ", full: "შაბათი",     jsDay: 6 },
  { key: "sun", label: "კვი", full: "კვირა",      jsDay: 0 },
];

const DAY_COLORS = {
  mon: { bg:"bg-blue-600",    light:"bg-blue-50",    border:"border-blue-200",    text:"text-blue-700"    },
  tue: { bg:"bg-violet-600",  light:"bg-violet-50",  border:"border-violet-200",  text:"text-violet-700"  },
  wed: { bg:"bg-emerald-600", light:"bg-emerald-50", border:"border-emerald-200", text:"text-emerald-700" },
  thu: { bg:"bg-amber-600",   light:"bg-amber-50",   border:"border-amber-200",   text:"text-amber-700"   },
  fri: { bg:"bg-rose-600",    light:"bg-rose-50",    border:"border-rose-200",    text:"text-rose-700"    },
  sat: { bg:"bg-orange-600",  light:"bg-orange-50",  border:"border-orange-200",  text:"text-orange-700"  },
  sun: { bg:"bg-teal-600",    light:"bg-teal-50",    border:"border-teal-200",    text:"text-teal-700"    },
};

const HOURS      = Array.from({ length: 16 }, (_, i) => i + 7); // 07–22
const ROW_H_DAY  = 56; // px per hour row in DayView
const ROW_H_WEEK = 44; // px per hour row in WeekView

// 07:00 → 22:45 in 15-min steps
const SLOT_TIMES = Array.from({ length: 64 }, (_, i) => {
  const totalMin = 7 * 60 + i * 15;
  return `${String(Math.floor(totalMin/60)).padStart(2,"0")}:${String(totalMin%60).padStart(2,"0")}`;
});

const SLOT_DURATIONS = [
  { val: 0.25, label: "15წთ"  },
  { val: 0.5,  label: "30წთ"  },
  { val: 0.75, label: "45წთ"  },
  { val: 1,    label: "1სთ"   },
  { val: 1.5,  label: "1.5სთ" },
  { val: 2,    label: "2სთ"   },
  { val: 2.5,  label: "2.5სთ" },
  { val: 3,    label: "3სთ"   },
];

const KA_MONTHS_FULL = ["იანვარი","თებერვალი","მარტი","აპრილი","მაისი","ივნისი","ივლისი","აგვისტო","სექტემბერი","ოქტომბერი","ნოემბერი","დეკემბერი"];
const KA_MONTHS      = ["იანვ","თებ","მარ","აპრ","მაი","ივნ","ივლ","აგვ","სექ","ოქტ","ნოე","დეკ"];
const KA_DAYS_SHORT  = ["ორშ","სამ","ოთხ","ხუთ","პარ","შაბ","კვი"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getMonday(d) {
  const r = new Date(d); r.setHours(0,0,0,0);
  const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toDateStr(d)  { return d.toLocaleDateString("en-CA"); }
function isToday(d)    { return toDateStr(d) === toDateStr(new Date()); }

function formatWeekRange(monday) {
  const sun = addDays(monday, 6);
  const m1 = KA_MONTHS[monday.getMonth()], m2 = KA_MONTHS[sun.getMonth()];
  return m1 === m2
    ? `${monday.getDate()} – ${sun.getDate()} ${m1}`
    : `${monday.getDate()} ${m1} – ${sun.getDate()} ${m2}`;
}

function calcDuration(s, e) {
  const [sh,sm] = s.split(":").map(Number);
  const [eh,em] = e.split(":").map(Number);
  const m = (eh*60+em) - (sh*60+sm);
  if (m <= 0) return "";
  const h = Math.floor(m/60), r = m%60;
  return h && r ? `${h}სთ ${r}წთ` : h ? `${h} სთ` : `${r} წთ`;
}

function getMonthGrid(date) {
  const y=date.getFullYear(), m=date.getMonth();
  const first = new Date(y,m,1), days = new Date(y,m+1,0).getDate();
  const pad = (first.getDay()+6)%7;
  const cells = [];
  for (let i=pad-1;i>=0;i--) cells.push({date:new Date(y,m,-i), current:false});
  for (let i=1;i<=days;i++)    cells.push({date:new Date(y,m,i),   current:true});
  const tot = Math.ceil(cells.length/7)*7;
  for (let i=1;cells.length<tot;i++) cells.push({date:new Date(y,m+1,i), current:false});
  return cells;
}

function computeEnd(start, durationHours) {
  const [h, m] = start.split(":").map(Number);
  const totalMin = h * 60 + m + Math.round(durationHours * 60);
  return `${String(Math.floor(totalMin/60)).padStart(2,"0")}:${String(totalMin%60).padStart(2,"0")}`;
}

function slotDuration(sl) {
  if (sl.duration) return sl.duration;
  if (sl.start && sl.end) {
    const [sh,sm] = sl.start.split(":").map(Number);
    const [eh,em] = sl.end.split(":").map(Number);
    const d = ((eh*60+em)-(sh*60+sm))/60;
    return d > 0 ? d : 1;
  }
  return 1;
}

function toTimeStr(totalMin) {
  return `${String(Math.floor(totalMin/60)).padStart(2,"0")}:${String(totalMin%60).padStart(2,"0")}`;
}

function recomputeChain(slots, bufferMin, startHour = 7) {
  let curMin = startHour * 60;
  const result = [];
  for (const sl of slots) {
    if (curMin >= 23 * 60) break;
    const dur = Number(sl.duration || slotDuration(sl) || 1);
    const start = toTimeStr(curMin);
    const endMin = curMin + Math.round(dur * 60);
    const end = toTimeStr(Math.min(endMin, 23 * 60));
    result.push({ ...sl, duration: dur, start, end });
    curMin = endMin + Number(bufferMin || 0);
  }
  return result;
}

function migrateSchedule(sched) {
  const defInd = sched._prices?.individual || 0;
  const defGrp = sched._prices?.group || 0;
  const defBuf = Number(sched._buffer || 0);
  const result = { ...sched };
  WEEKDAYS.forEach(d => {
    if (!sched[d.key]?.length) return;
    result[d.key] = sched[d.key].map(sl => {
      const dur = sl.duration || slotDuration(sl);
      return {
        ...sl,
        duration:    dur,
        end:         sl.end || computeEnd(sl.start, dur),
        isGroup:     sl.isGroup     || false,
        maxStudents: sl.maxStudents || 3,
        priceInd:    sl.priceInd ?? defInd,
        priceGrp:    sl.priceGrp ?? defGrp,
        buffer:      sl.buffer   ?? defBuf,
      };
    });
  });
  return result;
}

// Build the grid of time labels for one day's edit panel.
// Includes every full hour 07:00–22:00, PLUS the exact "end+buffer" time for
// each active slot (e.g. slot 10:00–11:00 +10min → adds "11:10").
// "24:00" is midnight (end of day). Display it as "00:00" in the UI.
const fmtTime = t => (t === "24:00" ? "00:00" : (t || ""));

function computeDayGrid(daySlots) {
  // Base grid: every full hour 07:00–22:00
  const base = Array.from({ length: 16 }, (_, i) =>
    `${String(i + 7).padStart(2, "0")}:00`
  );
  const extra = new Set();
  daySlots.forEach(sl => {
    if (!sl.start || !sl.end) return;
    const [sh, sm] = sl.start.split(":").map(Number);
    const [eh, em] = sl.end.split(":").map(Number);
    const sMin = sh * 60 + sm;
    const eMin = eh * 60 + em;
    const buf  = Number(sl.buffer || 0);

    // Always include the slot's own start time so non-standard starts
    // (e.g. "08:10" from an old buffer-chain save) are visible and deletable.
    if (sMin >= 7 * 60 && sMin <= 22 * 60) extra.add(sl.start);

    // For slots that end after 22:00, add 23:00 (if end > 23:00) and the exact
    // end time itself so the next-start label appears in the grid.
    if (eMin > 22 * 60) {
      if (eMin > 23 * 60) extra.add("23:00");
      if (eMin <= 24 * 60) extra.add(toTimeStr(eMin));
    }

    // After-buffer next-start, extended up to midnight
    if (buf > 0) {
      const afterMin = eMin + buf;
      if (afterMin >= 7 * 60 && afterMin <= 24 * 60)
        extra.add(toTimeStr(afterMin));
    }
  });
  return [...new Set([...base, ...extra])].sort();
}

// Returns one of: "active" | "continuation" | "buffer" | "free"
// "continuation" = timeStr falls inside an existing multi-hour slot (not the start)
// "buffer"       = timeStr falls in the dead-zone after a slot ends + its buffer
function getSlotCellStatus(timeStr, daySlots) {
  const [h, m] = timeStr.split(":").map(Number);
  const tMin = h * 60 + m;

  // active check must run across ALL slots first — otherwise a slot whose
  // start time falls inside another slot's buffer zone would be misclassified
  for (const sl of daySlots) {
    const [sh, sm] = sl.start.split(":").map(Number);
    if (tMin === sh * 60 + sm) return { status: "active", slot: sl };
  }
  for (const sl of daySlots) {
    const [sh, sm] = sl.start.split(":").map(Number);
    const [eh, em] = sl.end.split(":").map(Number);
    const sMin = sh * 60 + sm;
    const eMin = eh * 60 + em;
    if (tMin > sMin && tMin < eMin) return { status: "continuation", slot: sl };
  }
  for (const sl of daySlots) {
    const [eh, em] = sl.end.split(":").map(Number);
    const eMin = eh * 60 + em;
    const buf  = Number(sl.buffer || 0);
    if (buf > 0 && tMin >= eMin && tMin < eMin + buf) return { status: "buffer", slot: sl };
  }
  return { status: "free" };
}

function isVacDay(dateStr, vac) {
  return !!(vac && dateStr >= vac.from && dateStr <= vac.until);
}

function formatCountdown(ms) {
  if (ms <= 0) return "დაიწყო";
  const m = Math.floor(ms/60000);
  if (m < 60) return `${m} წუთი`;
  const h = Math.floor(m/60), rm = m%60;
  return rm ? `${h}სთ ${rm}წთ` : `${h} საათი`;
}

// ── Booking subject helpers ────────────────────────────────────────────────────
function getBookingSubject(note, tutorSubjects) {
  if (note) { const m = note.match(/^\[S:([^\]]+)\]/); if (m) return m[1]; }
  return Array.isArray(tutorSubjects) ? tutorSubjects[0] : tutorSubjects;
}
function getDisplayNote(note) {
  if (!note) return "";
  return note.replace(/^\[S:[^\]]+\]\s*/, "").trim();
}

// ── Slot card visuals ─────────────────────────────────────────────────────────
function getSlotStyle(slot) {
  if (slot.status === "full")             return { bg:"bg-orange-100",  border:"border-orange-300",  text:"text-orange-800",  dot:"bg-orange-400"  };
  if (slot.booking_type === "trial")      return { bg:"bg-amber-100",   border:"border-amber-300",   text:"text-amber-800",   dot:"bg-amber-400"   };
  if (slot.is_group)                      return { bg:"bg-violet-100",  border:"border-violet-300",  text:"text-violet-800",  dot:"bg-violet-500"  };
  return                                         { bg:"bg-blue-100",    border:"border-blue-300",    text:"text-blue-800",    dot:"bg-blue-500"    };
}

function slotTypeIcon(slot) {
  if (slot.booking_type === "trial")   return "🎓";
  if (slot.booking_type === "recurring" || slot.is_recurring_series) return slot.is_group ? "👥🔁" : "👤🔁";
  return slot.is_group ? "👥" : "👤";
}

// ── Slot detail modal ─────────────────────────────────────────────────────────
function SlotDetailModal({ item, type, onClose, onCancelled, onRefresh }) {
  const [loading,      setLoading]      = useState(false);
  const [students,     setStudents]     = useState([]);
  const [cancelling,   setCancelling]   = useState(false);
  const [addEmail,     setAddEmail]     = useState("");
  const [addLoading,   setAddLoading]   = useState(false);
  const [addMsg,       setAddMsg]       = useState("");
  const [showAdd,      setShowAdd]      = useState(false);

  useEffect(() => {
    if (type !== "slot") return;
    const ids = (item.slot_enrollments || []).filter(e=>e.status==="enrolled").map(e=>e.student_id);
    if (!ids.length) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("profiles")
        .select("id, full_name, email").in("id", ids);
      setStudents(data || []);
    })();
  }, [item, type]);

  async function cancelSlot() {
    if (!window.confirm("სლოტი გაუქმდება. გააგრძელოთ?")) return;
    setCancelling(true);
    const res = await fetch(`/api/lesson-slots/${item.id}/cancel-enrollment`, { method:"POST" });
    setCancelling(false);
    if (res.ok) { onCancelled?.(); onClose(); }
  }

  async function cancelBooking() {
    if (!window.confirm("ჯავშანი გაუქმდება. გაგრძელება?")) return;
    setCancelling(true);
    const res = await fetch("/api/bookings/cancel", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ bookingId: item.id }),
    });
    const d = await res.json();
    setCancelling(false);
    if (res.ok) {
      const msg = d.studentRefund > 0 ? ` · ${d.studentRefund}₾ დაუბრუნდა` : "";
      alert("გაუქმდა" + msg);
      onCancelled?.(); onClose();
    }
  }

  async function addStudent() {
    if (!addEmail.trim()) return;
    setAddLoading(true); setAddMsg("");
    const supabase = createClient();
    const { data: prof } = await supabase.from("profiles")
      .select("id").eq("email", addEmail.trim()).maybeSingle();
    if (!prof) { setAddMsg("ასეთი მომხმარებელი ვერ მოიძებნა"); setAddLoading(false); return; }
    const res = await fetch(`/api/lesson-slots/${item.id}/enroll`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ studentId: prof.id }),
    });
    const d = await res.json();
    setAddLoading(false);
    if (res.ok) { setAddMsg("✅ სტუდენტი დაემატა!"); setAddEmail(""); onRefresh?.(); }
    else setAddMsg(d.error || "შეცდომა");
  }

  const isSlot = type === "slot";
  const st     = isSlot ? getSlotStyle(item) : null;
  const enrolled = (item.slot_enrollments||[]).filter(e=>e.status==="enrolled").length;
  const waiting  = (item.slot_waitlist||[]).filter(w=>w.status==="waiting").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className={`p-5 rounded-t-3xl ${isSlot ? st.bg + " border-b " + st.border : "bg-red-50 border-b border-red-200"}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isSlot ? st.text : "text-red-700"}`}>
                {isSlot ? slotTypeIcon(item) + " სლოტის დეტალები" : "📅 ჯავშნის დეტალები"}
              </p>
              <p className="text-lg font-black text-gray-900">
                {item.date} · {item.time_slot?.slice(0,5)}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {item.duration_hours || 1} სთ · {isSlot ? item.price_per_student : item.total_price}₾
                {isSlot && item.is_group ? ` · თით.` : ""}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-black/10 hover:bg-black/20 rounded-xl flex items-center justify-center text-gray-700 transition-all">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* Booking info */}
          {!isSlot && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center text-lg font-bold text-red-600">
                  {(item.profiles?.full_name||"?")[0]}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{item.profiles?.full_name || "სტუდენტი"}</p>
                  <p className="text-xs text-gray-400">{getBookingSubject(item.note, item.tutors?.subject) || "—"} · {item.format === "online" ? "🌐 ონლაინ" : "🏫 პირისპირ"}</p>
                </div>
                <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${
                  item.status==="confirmed" ? "bg-emerald-100 text-emerald-700" :
                  item.status==="pending"   ? "bg-amber-100 text-amber-700"   :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {item.status==="confirmed" ? "✓ დადასტ." : item.status==="pending" ? "⏳" : item.status}
                </span>
              </div>
              {getDisplayNote(item.note) && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-sm text-blue-800">
                  💬 {getDisplayNote(item.note)}
                </div>
              )}
            </div>
          )}

          {/* Slot info */}
          {isSlot && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["ტიპი",    item.booking_type === "trial" ? "🎓 საცდელი" : item.booking_type === "recurring" ? "🔁 განმეოარ." : item.booking_type === "package" ? "📦 პაკეტი" : "📅 ერთჯ."],
                  ["ფორმატი", item.is_group ? "👥 ჯგუფური" : "👤 ინდივ."],
                  ["ფასი",    item.price_per_student + "₾" + (item.is_group ? " / სტ." : "")],
                  ["სტატუსი", item.status === "full" ? "🔴 სავსე" : item.status === "open" ? "🟢 ღია" : "⚪ " + item.status],
                ].map(([l,v]) => (
                  <div key={l} className="bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-gray-400">{l}</p>
                    <p className="font-bold text-gray-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>

              {/* Capacity visual */}
              {item.is_group && (
                <div className="bg-gray-50 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500">ჩარიცხვა</p>
                    <span className="text-xs font-bold text-gray-700">{enrolled}/{item.max_capacity}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {Array.from({length: item.max_capacity}).map((_,i) => (
                      <div key={i} className={`flex-1 h-3 rounded-full transition-all ${i < enrolled ? "bg-emerald-500" : "bg-gray-200"}`} />
                    ))}
                  </div>
                  {waiting > 0 && (
                    <p className="text-xs text-amber-600 font-semibold mt-2">⏳ {waiting} მოლოდინში</p>
                  )}
                </div>
              )}

              {/* Enrolled students */}
              {students.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ჩარიცხული სტუდენტები</p>
                  <div className="space-y-1.5">
                    {students.map(s => (
                      <div key={s.id} className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                        <div className="w-7 h-7 bg-emerald-200 rounded-lg flex items-center justify-center text-emerald-700 font-bold text-xs">
                          {(s.full_name||"?")[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{s.full_name}</p>
                          <p className="text-xs text-gray-400 truncate">{s.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add student */}
              {item.status !== "cancelled" && (
                <div>
                  {!showAdd ? (
                    <button onClick={() => setShowAdd(true)}
                      className="w-full py-2.5 border-2 border-dashed border-emerald-300 text-emerald-700 text-sm font-bold rounded-2xl hover:bg-emerald-50 transition-all">
                      + მოსწავლის დამატება
                    </button>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-2">
                      <p className="text-xs font-bold text-emerald-700">სტუდენტის Email</p>
                      <div className="flex gap-2">
                        <input value={addEmail} onChange={e=>setAddEmail(e.target.value)}
                          placeholder="student@email.com"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        <button onClick={addStudent} disabled={addLoading}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50">
                          {addLoading ? "..." : "✓"}
                        </button>
                      </div>
                      {addMsg && <p className="text-xs font-semibold text-gray-700">{addMsg}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {item.status !== "cancelled" && item.status !== "done" && (
            <button onClick={isSlot ? cancelSlot : cancelBooking} disabled={cancelling}
              className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm rounded-2xl transition-all border border-red-200 disabled:opacity-50 flex items-center justify-center gap-2">
              {cancelling ? <><span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"/> გაუქმება...</> : "❌ გაუქმება"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Slot template edit/create modal ──────────────────────────────────────────
function SlotTemplateModal({ dayKey, slot, time, onClose, onSave, onDelete }) {
  const startTime = slot?.start || time;
  const [dur,         setDur]         = useState(slot ? Number(slot.duration) : 1);
  const [isGroup,     setIsGroup]     = useState(slot?.isGroup  || false);
  const [priceInd,    setPriceInd]    = useState(slot?.priceInd ?? 0);
  const [priceGrp,    setPriceGrp]    = useState(slot?.priceGrp ?? 0);
  const [buf,         setBuf]         = useState(Number(slot?.buffer ?? 0));
  const [maxStudents, setMaxStudents] = useState(slot?.maxStudents || 3);
  const isNew = !slot;

  const endTime = computeEnd(startTime, dur);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className={`p-5 rounded-t-3xl border-b ${isNew ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isNew ? "text-emerald-700" : "text-blue-700"}`}>
                {isNew ? "➕ ახალი სლოტი" : "✏️ სლოტის რედაქტირება"}
              </p>
              <p className="text-lg font-black text-gray-900">
                {WEEKDAYS.find(w=>w.key===dayKey)?.full} · {startTime}–{endTime}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-black/10 hover:bg-black/20 rounded-xl flex items-center justify-center text-gray-700 transition-all">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">ხანგრძლივობა</label>
            <div className="flex gap-1.5 flex-wrap">
              {SLOT_DURATIONS.filter(sd => {
                const [sh, sm] = startTime.split(":").map(Number);
                return sh * 60 + sm + Math.round(sd.val * 60) <= 24 * 60;
              }).map(sd => (
                <button key={sd.val} type="button" onClick={() => setDur(sd.val)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                    Number(dur) === sd.val ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-500"
                  }`}>{sd.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">ტიპი</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsGroup(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  !isGroup ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-500"
                }`}>👤 ინდ.</button>
              <button type="button" onClick={() => setIsGroup(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  isGroup ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-500"
                }`}>👥 ჯგ.</button>
            </div>
          </div>

          {isGroup && (
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">👥 ჯგ. ლიმიტი</label>
              <div className="flex gap-1.5">
                {[2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setMaxStudents(n)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                      maxStudents === n ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-blue-400"
                    }`}>{n}</button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">👤 ინდ. ფასი სლოტზე</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                <input type="number" min="0" placeholder="0" value={priceInd || ""}
                  onFocus={e => e.target.select()}
                  onChange={e => setPriceInd(e.target.value === "" ? 0 : Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-semibold outline-none bg-transparent"/>
                <span className="px-2.5 text-gray-400 text-sm border-l border-gray-200 py-2.5">₾</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">👥 ჯგ. ფასი სლოტზე</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                <input type="number" min="0" placeholder="0" value={priceGrp || ""}
                  onFocus={e => e.target.select()}
                  onChange={e => setPriceGrp(e.target.value === "" ? 0 : Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-semibold outline-none bg-transparent"/>
                <span className="px-2.5 text-gray-400 text-sm border-l border-gray-200 py-2.5">₾</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">⏸ ბუფერი ამ სლოტის შემდეგ</label>
            <div className="flex gap-1.5">
              {[0,5,10,15].map(m => (
                <button key={m} type="button" onClick={() => setBuf(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    buf === m ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-500"
                  }`}>{m === 0 ? "0წთ" : `${m}წთ`}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {!isNew && (
              <button type="button" onClick={onDelete}
                className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm rounded-2xl border border-red-200 transition-all">
                🗑 წაშლა
              </button>
            )}
            <button type="button"
              onClick={() => onSave({ start: startTime, end: endTime, duration: dur, isGroup, priceInd, priceGrp, buffer: buf, maxStudents })}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl transition-all">
              {isNew ? "➕ დამატება" : "💾 შენახვა"}
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">ცვლილება შენახდება — გლობალური 💾 ღილაკი საჭიროა.</p>
        </div>
      </div>
    </div>
  );
}

// ── Hour cell ─────────────────────────────────────────────────────────────────
// HourCell renders bookings and lesson_slots only.
// Schedule template slots are rendered as per-day absolute overlays in DayView/WeekView.
function HourCell({ dateStr, hour, dayKey, viewBookings, viewSlots, compact, onSlotClick }) {
  const hh   = String(hour).padStart(2,"0");
  const t    = `${hh}:00`;
  const bk   = viewBookings.find(b => b.date===dateStr && b.time_slot?.startsWith(hh+":"));
  const slot = viewSlots.find(s => s.date===dateStr && s.time_slot?.startsWith(hh+":"));
  const enrolled = slot?.slot_enrollments?.filter(e=>e.status==="enrolled").length||0;
  const waiting  = slot?.slot_waitlist?.filter(w=>w.status==="waiting").length||0;
  const minH = compact ? 40 : 52;

  if (bk) {
    const subj = getBookingSubject(bk.note, bk.tutors?.subject);
    return (
      <div
        className="relative z-20 bg-red-100 border border-red-300 rounded-lg h-full cursor-pointer hover:bg-red-200 transition-all select-none"
        style={{ minHeight: minH, padding: compact ? "4px 6px" : "6px 10px" }}
        onClick={() => onSlotClick({ item: bk, type: "booking" })}>
        <p className={`font-bold text-red-800 truncate leading-tight ${compact ? "text-[11px]" : "text-sm"}`}>
          {bk.profiles?.full_name?.split(" ")[0]||"სტ."}
        </p>
        {!compact && subj && <p className="text-xs text-red-500 truncate mt-0.5">{subj}</p>}
        {compact && <p className="text-[9px] text-red-400 leading-tight mt-0.5 truncate">{bk.time_slot}</p>}
      </div>
    );
  }

  if (slot) {
    const st = getSlotStyle(slot);
    return (
      <div
        className={`relative z-20 ${st.bg} border ${st.border} rounded-lg h-full cursor-pointer hover:brightness-95 transition-all select-none`}
        style={{ minHeight: minH, padding: compact ? "4px 6px" : "6px 10px" }}
        onClick={() => onSlotClick({ item: slot, type: "slot" })}>
        <p className={`font-bold truncate leading-tight ${compact ? "text-[10px]" : "text-sm"} ${st.text}`}>
          {slotTypeIcon(slot)} {slot.price_per_student}₾
        </p>
        {slot.is_group && (
          <p className={`font-semibold leading-none mt-0.5 ${compact ? "text-[9px]" : "text-xs"} ${st.text}`}>
            {enrolled}/{slot.max_capacity}{waiting>0?` +${waiting}⏳`:""}
          </p>
        )}
        {slot.booking_type==="recurring" && compact && (
          <p className="text-[8px] text-gray-500 leading-none mt-0.5">🔁</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg h-full flex items-center justify-center cursor-pointer hover:bg-emerald-50 transition-all group"
      style={{ minHeight: minH }}
      onClick={() => onSlotClick({ item: null, type: "template-add", date: dateStr, time: t, dayKey })}>
      <span className={`text-emerald-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity ${compact?"text-base":"text-xl"}`}>+</span>
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────
function DayView({ focusDate, savedSchedule, bufferMin, viewBookings, viewSlots, onSlotClick, vacation }) {
  const dateStr = toDateStr(focusDate);
  const jsDay   = focusDate.getDay();
  const dayKey  = WEEKDAYS.find(w=>w.jsDay===jsDay)?.key;
  const slots   = savedSchedule[dayKey]||[];
  const today   = isToday(focusDate);
  const onVac   = isVacDay(dateStr, vacation);

  return (
    <div className="space-y-3">

      {/* Vacation day banner */}
      {onVac && (
        <div className="flex items-center gap-3 bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3">
          <span className="text-2xl">✈️</span>
          <div>
            <p className="font-black text-amber-900 text-sm">შვებულების დღე</p>
            <p className="text-xs text-amber-700 font-medium">{vacation.from} – {vacation.until} · ახალი ჯავშნები დაბლოკილია</p>
          </div>
        </div>
      )}

      {!onVac && (slots.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {slots.map((s,i) => (
            <span key={i} className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold px-3 py-1.5 rounded-full">
              🕐 {s.start} – {s.end} · {calcDuration(s.start,s.end)}
            </span>
          ))}
          {bufferMin > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-3 py-1.5 rounded-full">
              ⏸ {bufferMin}წთ ბუფერი
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
          ამ დღეს სამუშაო საათი დაყენებული არ არის
        </p>
      ))}

      <div className={`border rounded-2xl shadow-sm overflow-hidden ${onVac ? "border-amber-200" : "bg-white border-gray-100"}`}>
        <div className={`py-4 text-center border-b ${
          onVac ? "bg-amber-100 border-amber-200" : today ? "bg-emerald-50 border-gray-100" : "border-gray-100"
        }`}>
          {onVac && <div className="text-2xl mb-1">✈️</div>}
          <p className={`text-xs font-bold uppercase tracking-widest ${onVac?"text-amber-600":today?"text-emerald-600":"text-gray-400"}`}>
            {WEEKDAYS.find(w=>w.jsDay===jsDay)?.full||""}
          </p>
          <p className={`text-3xl font-black mt-0.5 ${onVac?"text-amber-700":today?"text-emerald-700":"text-gray-900"}`}>
            {focusDate.getDate()}
          </p>
          {today && !onVac && <div className="w-2 h-2 bg-emerald-500 rounded-full mx-auto mt-1"/>}
          {onVac && <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">შვებულება</p>}
        </div>
        <div className="relative">
          {HOURS.map(hour => (
            <div key={hour}
              className={`flex border-b border-gray-50 last:border-0 ${onVac ? "bg-amber-50/60" : today ? "bg-emerald-50/10" : ""}`}
              style={{height: ROW_H_DAY}}>
              <div className="w-14 shrink-0 text-right pr-3 text-[11px] text-gray-300 font-medium pt-2.5">
                {String(hour).padStart(2,"0")}:00
              </div>
              <div className="flex-1 p-1 relative">
                {onVac && (
                  <div className="absolute inset-0 rounded-lg"
                    style={{background:"repeating-linear-gradient(135deg,transparent,transparent 6px,rgba(251,191,36,0.12) 6px,rgba(251,191,36,0.12) 12px)"}}/>
                )}
                <HourCell dateStr={dateStr} hour={hour} dayKey={dayKey||""}
                  viewBookings={viewBookings} viewSlots={viewSlots} compact={false} onSlotClick={onSlotClick} />
              </div>
            </div>
          ))}
          {/* Schedule template slot overlay — one unified block per slot */}
          {!onVac && slots.length > 0 && (
            <div className="absolute inset-0 pointer-events-none" style={{left:"3.5rem"}}>
              {slots.map(sl => {
                const [sh,sm] = sl.start.split(":").map(Number);
                const [eh,em] = sl.end.split(":").map(Number);
                const topPx    = (sh*60+sm - 7*60) / 60 * ROW_H_DAY;
                const heightPx = (eh*60+em - sh*60-sm) / 60 * ROW_H_DAY;
                if (heightPx <= 0) return null;
                const sMin = sh*60+sm, eMin = eh*60+em;
                const blockedByBooking = viewBookings.some(b => {
                  if (b.date !== dateStr || !b.time_slot) return false;
                  const [bh,bm] = b.time_slot.split(":").map(Number);
                  const bS = bh*60+bm, bE = bS + (b.duration_hours||1)*60;
                  return sMin < bE && eMin > bS;
                });
                if (blockedByBooking) return null;
                const isGrp = sl.isGroup;
                const price  = isGrp ? (sl.priceGrp||0) : (sl.priceInd||0);
                return (
                  <div key={sl.start}
                    className={`absolute left-1 right-1 rounded-xl border-2 pointer-events-auto cursor-pointer transition-all ${
                      isGrp
                        ? "bg-violet-50 border-violet-200 hover:bg-violet-100"
                        : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                    }`}
                    style={{top: topPx+2, height: Math.max(heightPx-4,24), zIndex:10}}
                    onClick={() => onSlotClick({item:null, type:"template", date:dateStr, time:sl.start, dayKey, slot:sl})}>
                    <div className="px-2.5 pt-2">
                      <p className={`font-bold text-sm leading-tight ${isGrp?"text-violet-700":"text-emerald-700"}`}>
                        {isGrp?"👥":"👤"} {sl.start}–{fmtTime(sl.end)}
                      </p>
                      <p className={`text-xs font-semibold mt-0.5 ${isGrp?"text-violet-500":"text-emerald-500"}`}>
                        {sl.duration}სთ{price>0?` · ${price}₾`:""}
                        {isGrp&&sl.maxStudents?` · max${sl.maxStudents}`:""}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${isGrp?"text-violet-400":"text-emerald-400"}`}>✏️ შეცვლა</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────
function WeekView({ weekDays, savedSchedule, bufferMin, viewBookings, viewSlots, onSlotClick, vacation }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {[
          {c:"bg-emerald-200 border border-emerald-300", l:"ხელმისაწვდ."},
          {c:"bg-red-200",      l:"ჯავშანი"},
          {c:"bg-blue-200",     l:"👤 ინდივ."},
          {c:"bg-violet-300",   l:"👥 ჯგუფი"},
          {c:"bg-amber-200",    l:"🎓 საცდელი"},
          {c:"bg-orange-300",   l:"სავსე"},
          {c:"bg-amber-100 border border-amber-300", l:"✈️ შვებ."},
        ].map(x => (
          <div key={x.l} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <div className={`w-3 h-3 rounded ${x.c}`}/>{x.l}
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{minWidth:580}}>
            <div className="grid border-b border-gray-100" style={{gridTemplateColumns:"52px repeat(7, 1fr)"}}>
              <div className="border-r border-gray-100 flex items-end justify-end pr-2 pb-2">
                <span className="text-[9px] text-gray-300 font-semibold">GE</span>
              </div>
              {weekDays.map(d => {
                const today  = isToday(d.date);
                const onVac  = isVacDay(toDateStr(d.date), vacation);
                return (
                  <div key={d.key} className={`py-3 px-2 text-center border-l border-gray-100 ${
                    onVac ? "bg-amber-100 border-l-amber-200" : today ? "bg-emerald-50" : ""
                  }`}>
                    {onVac && <div className="text-sm leading-none mb-0.5">✈️</div>}
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${
                      onVac ? "text-amber-600" : today ? "text-emerald-600" : "text-gray-400"
                    }`}>{d.label}</p>
                    <p className={`text-lg font-black mt-0.5 ${
                      onVac ? "text-amber-700" : today ? "text-emerald-700" : "text-gray-800"
                    }`}>{d.date.getDate()}</p>
                    {today && !onVac && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mx-auto mt-0.5"/>}
                  </div>
                );
              })}
            </div>
            {/* Column-first layout: time labels + one div per day with slot overlay */}
            <div className="flex">
              <div className="w-[52px] shrink-0 border-r border-gray-50">
                {HOURS.map(hour => (
                  <div key={hour}
                    style={{height: ROW_H_WEEK}}
                    className="flex items-start justify-end pr-2 pt-1.5 text-[11px] text-gray-300 font-medium border-b border-gray-50 last:border-0">
                    {String(hour).padStart(2,"0")}:00
                  </div>
                ))}
              </div>
              {weekDays.map(d => {
                const dDateStr = toDateStr(d.date);
                const dToday   = isToday(d.date);
                const dOnVac   = isVacDay(dDateStr, vacation);
                const daySlots = savedSchedule[d.key] || [];
                return (
                  <div key={d.key} className={`flex-1 relative border-l border-gray-50 ${dToday?"bg-emerald-50/10":""}`}>
                    {HOURS.map(hour => (
                      <div key={hour}
                        style={{height: ROW_H_WEEK}}
                        className={`border-b border-gray-50 last:border-0 p-0.5 relative ${dOnVac?"bg-amber-50/70":""}`}>
                        {dOnVac && (
                          <div className="absolute inset-0 pointer-events-none"
                            style={{background:"repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(251,191,36,0.15) 5px,rgba(251,191,36,0.15) 10px)"}}/>
                        )}
                        <HourCell dateStr={dDateStr} hour={hour} dayKey={d.key}
                          viewBookings={viewBookings} viewSlots={viewSlots} compact={true} onSlotClick={onSlotClick} />
                      </div>
                    ))}
                    {!dOnVac && daySlots.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none">
                        {daySlots.map(sl => {
                          const [sh,sm] = sl.start.split(":").map(Number);
                          const [eh,em] = sl.end.split(":").map(Number);
                          const topPx    = (sh*60+sm - 7*60) / 60 * ROW_H_WEEK;
                          const heightPx = (eh*60+em - sh*60-sm) / 60 * ROW_H_WEEK;
                          if (heightPx <= 0) return null;
                          const sMin = sh*60+sm, eMin = eh*60+em;
                          const blocked = viewBookings.some(b => {
                            if (b.date !== dDateStr || !b.time_slot) return false;
                            const [bh,bm] = b.time_slot.split(":").map(Number);
                            const bS = bh*60+bm, bE = bS + (b.duration_hours||1)*60;
                            return sMin < bE && eMin > bS;
                          });
                          if (blocked) return null;
                          const isGrp = sl.isGroup;
                          return (
                            <div key={sl.start}
                              className={`absolute pointer-events-auto rounded-lg border cursor-pointer transition-all ${
                                isGrp
                                  ? "bg-violet-50/90 border-violet-200 hover:bg-violet-100"
                                  : "bg-emerald-50/90 border-emerald-200 hover:bg-emerald-100"
                              }`}
                              style={{top:topPx+1, height:Math.max(heightPx-2,18), left:2, right:2, zIndex:10}}
                              onClick={() => onSlotClick({item:null, type:"template", date:dDateStr, time:sl.start, dayKey:d.key, slot:sl})}>
                              <p className={`text-[9px] font-bold px-1 pt-0.5 leading-tight truncate ${isGrp?"text-violet-700":"text-emerald-700"}`}>
                                {isGrp?"👥":"👤"} {sl.start}
                              </p>
                              <p className={`text-[8px] px-1 leading-tight ${isGrp?"text-violet-500":"text-emerald-500"}`}>
                                {sl.duration}სთ ✏️
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {viewBookings.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <p className="font-bold text-gray-900 text-sm">📋 კვირის გაკვეთილები</p>
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">{viewBookings.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {viewBookings.map(b => {
              const dInfo = WEEKDAYS.find(w=>w.jsDay===new Date(`${b.date}T${b.time_slot||"00:00"}`).getDay());
              const col   = DAY_COLORS[dInfo?.key||"mon"];
              return (
                <div key={b.id} className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-all"
                  onClick={() => onSlotClick({ item: b, type: "booking" })}>
                  <div className={`w-9 h-9 ${col.bg} rounded-2xl flex flex-col items-center justify-center shrink-0`}>
                    <span className="text-white text-[10px] font-bold leading-none">{dInfo?.label}</span>
                    <span className="text-white/80 text-[10px] leading-none">{b.time_slot?.slice(0,5)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{b.profiles?.full_name||"სტ."}</p>
                    <p className="text-xs text-gray-400">{getBookingSubject(b.note, b.tutors?.subject)||""} · {b.duration_hours||1}სთ</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 shrink-0">{b.total_price}₾</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────
function MonthView({ focusDate, savedSchedule, viewBookings, viewSlots, onDayClick, vacation }) {
  const cells = getMonthGrid(focusDate);

  function dayAvail(date) {
    const key = WEEKDAYS.find(w=>w.jsDay===date.getDay())?.key;
    return key && (savedSchedule[key]||[]).length > 0;
  }
  function dayItems(date) {
    const ds = toDateStr(date);
    const bk = viewBookings.filter(b=>b.date===ds).length;
    const sl = viewSlots.filter(s=>s.date===ds).length;
    return { bk, sl };
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {KA_DAYS_SHORT.map(l => (
          <div key={l} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell,idx) => {
          const today  = isToday(cell.date);
          const avail  = dayAvail(cell.date) && cell.current;
          const onVac  = cell.current && isVacDay(toDateStr(cell.date), vacation);
          const { bk, sl } = dayItems(cell.date);

          return (
            <div key={idx}
              onClick={() => onDayClick(cell.date)}
              style={onVac ? {background:"repeating-linear-gradient(135deg,#fffbeb,#fffbeb 8px,#fef3c7 8px,#fef3c7 16px)"} : undefined}
              className={`min-h-[86px] p-2 border-b border-r cursor-pointer transition-all
                ${onVac ? "border-amber-200 hover:brightness-95" : "border-gray-50 hover:bg-gray-50"}
                ${!cell.current?"opacity-40 bg-gray-50/60":""}
                ${today && !onVac?"bg-emerald-50/70 hover:bg-emerald-50":""}
              `}>
              <div className={`text-sm font-black w-7 h-7 flex items-center justify-center rounded-full mb-1 ${
                onVac ? "bg-amber-400 text-white" :
                today ? "bg-emerald-500 text-white" :
                cell.current ? "text-gray-900" : "text-gray-400"
              }`}>
                {onVac ? "✈️" : cell.date.getDate()}
              </div>
              {onVac && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-amber-700 font-bold truncate">შვებულება</span>
                </div>
              )}
              {!onVac && avail && (
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0"/>
                  <span className="text-[10px] text-emerald-600 font-semibold truncate">ხელმისაწვდ.</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {bk > 0 && (
                  <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{bk} ჯვ</span>
                )}
                {sl > 0 && (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{sl} სლ</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TutorSchedulePage() {
  const router   = useRouter();
  const dirtyRef = useRef(false);

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saveFlash,   setSaveFlash]   = useState(false);
  const [tutorName,   setTutorName]   = useState("მასწავლებელი");
  const [isVerified,  setIsVerified]  = useState(false);
  const [userId,      setUserId]      = useState(null);
  const [tutorSubjects, setTutorSubjects] = useState([]);

  // Schedule (saved vs. local editing)
  const [savedSchedule, setSavedSchedule] = useState({});
  const [localSchedule, setLocalSchedule] = useState({});

  // Settings extracted from schedule JSON
  const defaultPrices = savedSchedule._prices || { individual: 0, group: 0 };
  const bufferMin     = Number(savedSchedule._buffer || 0);
  const vacation      = savedSchedule._vacation || null; // { from, until }
  const todayStr2     = toDateStr(new Date());
  const isOnVacation  = vacation && vacation.from <= todayStr2 && vacation.until >= todayStr2;

  // UI
  const [editOpen,     setEditOpen]     = useState(false);
  const [viewMode,     setViewMode]     = useState("week");
  const [focusDate,    setFocusDate]    = useState(new Date());
  const [viewBookings, setViewBookings] = useState([]);
  const [viewSlots,    setViewSlots]    = useState([]);
  const [nextLesson,   setNextLesson]   = useState(null);
  const [todayStats,   setTodayStats]   = useState({ count: 0, income: 0 });
  const [detailModal,    setDetailModal]    = useState(null); // { item, type }
  const [createModal,    setCreateModal]    = useState(null); // { date, time }
  const [templateModal,  setTemplateModal]  = useState(null); // { dayKey, slot, time }
  const [vacModal,     setVacModal]     = useState(false);
  const [vacFrom,      setVacFrom]      = useState("");
  const [vacUntil,     setVacUntil]     = useState("");

  // Local editing settings
  const [localPriceInd,   setLocalPriceInd]   = useState(0);
  const [localPriceGrp,   setLocalPriceGrp]   = useState(0);
  const [localBuffer,     setLocalBuffer]     = useState(0);

  const dirty = JSON.stringify(localSchedule) !== JSON.stringify(savedSchedule);

  const [expandedSlotKey, setExpandedSlotKey] = useState(null); // "mon-09:00"

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  // ── Navigation guard ──
  useEffect(() => {
    const orig = window.history.pushState.bind(window.history);
    window.history.pushState = (...args) => {
      if (dirtyRef.current) {
        if (!window.confirm("✏️ განრიგის ცვლილებები შენახული არ არის.\n\nგვერდიდან გასვლისას ცვლილებები დაიკარგება. გააგრძელოთ?")) return;
      }
      orig(...args);
    };
    const handleBU = (e) => { if (!dirtyRef.current) return; e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handleBU);
    return () => { window.history.pushState = orig; window.removeEventListener("beforeunload", handleBU); };
  }, []);

  // ── Init ──
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const uid = session.user.id;
      setUserId(uid);
      const [{ data: profile }, { data: tutor }] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", uid).single(),
        supabase.from("tutors").select("is_verified, schedule, subject").eq("id", uid).single(),
      ]);
      if (profile?.role !== "tutor") { router.push("/dashboard"); return; }
      if (profile?.full_name) setTutorName(profile.full_name.split(" ")[0]);
      setIsVerified(!!tutor?.is_verified);
      const raw   = tutor?.schedule || {};
      const sched = migrateSchedule(raw);
      setSavedSchedule(sched);
      setLocalSchedule(sched);
      setLocalPriceInd(sched._prices?.individual || 0);
      setLocalPriceGrp(sched._prices?.group || 0);
      setLocalBuffer(sched._buffer || 0);
      setTutorSubjects(tutor?.subject || []);
      setLoading(false);
    })();
  }, []);

  // ── Fetch view data ──
  const fetchViewData = useCallback(async (uid, mode, fd) => {
    if (!uid) return;
    const supabase = createClient();
    let from, to;
    if (mode === "day") {
      from = to = toDateStr(fd);
    } else if (mode === "week") {
      const ws = getMonday(fd);
      from = toDateStr(ws); to = toDateStr(addDays(ws,6));
    } else {
      const y=fd.getFullYear(), m=fd.getMonth();
      from = toDateStr(new Date(y,m,1)); to = toDateStr(new Date(y,m+1,0));
    }
    const [{ data: bk }, slotsRes] = await Promise.all([
      supabase.from("bookings")
        .select("id,date,time_slot,duration_hours,status,total_price,note,format,student_id,profiles!student_id(full_name),tutors(subject)")
        .eq("tutor_id", uid).not("status","in",'("cancelled","disputed")')
        .gte("date",from).lte("date",to),
      fetch(`/api/lesson-slots?tutorId=${uid}&from=${from}&to=${to}`),
    ]);
    setViewBookings(bk||[]);
    const sj = await slotsRes.json();
    setViewSlots(Array.isArray(sj)?sj:[]);
  }, []);

  // ── Fetch today stats + next lesson ──
  const fetchTodayStats = useCallback(async (uid) => {
    if (!uid) return;
    const supabase = createClient();
    const today = toDateStr(new Date());
    const { data: todayBk } = await supabase.from("bookings")
      .select("total_price, date, time_slot, status, profiles!student_id(full_name)")
      .eq("tutor_id", uid).eq("date", today)
      .in("status", ["confirmed","pending"]);
    const count = todayBk?.length || 0;
    const income = (todayBk||[]).filter(b=>b.status==="confirmed").reduce((s,b)=>s+(b.total_price||0),0);
    setTodayStats({ count, income });

    // Next upcoming lesson
    const now = new Date();
    const nowStr = toDateStr(now);
    const { data: next } = await supabase.from("bookings")
      .select("date,time_slot,profiles!student_id(full_name)")
      .eq("tutor_id", uid).in("status",["confirmed"])
      .gte("date", nowStr).order("date").order("time_slot").limit(5);
    const future = (next||[]).find(b => new Date(`${b.date}T${b.time_slot||"00:00"}:00`) > now);
    setNextLesson(future||null);
  }, []);

  useEffect(() => {
    if (!userId || !isVerified) return;
    fetchViewData(userId, viewMode, focusDate);
    fetchTodayStats(userId);
  }, [userId, isVerified, viewMode, focusDate]);

  // ── Navigation ──
  function navigate(dir) {
    setFocusDate(prev => {
      const d = new Date(prev);
      if (viewMode==="day")   d.setDate(d.getDate()+dir);
      if (viewMode==="week")  d.setDate(d.getDate()+dir*7);
      if (viewMode==="month") d.setMonth(d.getMonth()+dir);
      return d;
    });
  }

  // ── Schedule helpers ──
  function enableSlotAt(dayKey, startStr) {
    const sl = {
      start:       startStr,
      end:         computeEnd(startStr, 1),
      duration:    1,
      isGroup:     false,
      maxStudents: 3,
      priceInd:    Number(localPriceInd) || 0,
      priceGrp:    Number(localPriceGrp) || 0,
      buffer:      Number(localBuffer)   || 0,
    };
    setLocalSchedule(prev => ({
      ...prev,
      [dayKey]: [...(prev[dayKey]||[]), sl].sort((a,b) => a.start.localeCompare(b.start)),
    }));
    setExpandedSlotKey(`${dayKey}-${startStr}`);
  }
  function removeSlotAt(dayKey, startStr) {
    setLocalSchedule(prev => {
      const slots = (prev[dayKey]||[]).filter(s => s.start !== startStr);
      if (!slots.length) { const n={...prev}; delete n[dayKey]; return n; }
      return {...prev, [dayKey]: slots};
    });
    setExpandedSlotKey(p => p === `${dayKey}-${startStr}` ? null : p);
  }
  function updateSlotAt(dayKey, startStr, field, val) {
    setLocalSchedule(prev => ({
      ...prev,
      [dayKey]: (prev[dayKey]||[]).map(sl => {
        if (sl.start !== startStr) return sl;
        const updated = {...sl, [field]: val};
        if (field === "duration") updated.end = computeEnd(sl.start, Number(val));
        return updated;
      }),
    }));
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const newSched = {
      ...localSchedule,
      _prices:  { individual: Number(localPriceInd), group: Number(localPriceGrp) },
      _buffer:  Number(localBuffer),
      _vacation: savedSchedule._vacation || null,
    };
    const supabase = createClient();
    await supabase.from("tutors").update({ schedule: newSched }).eq("id", userId);
    setSavedSchedule(newSched);
    setLocalSchedule(newSched);
    setSaving(false);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 3000);
    setEditOpen(false);
  }

  async function handleVacationSave() {
    if (!userId || !vacFrom || !vacUntil || vacUntil < vacFrom) return;
    const newSched = { ...savedSchedule, _vacation: { from: vacFrom, until: vacUntil } };
    const supabase = createClient();
    await supabase.from("tutors").update({ schedule: newSched }).eq("id", userId);
    setSavedSchedule(newSched);
    setLocalSchedule(newSched);
    setVacModal(false);
  }

  async function handleVacationEnd() {
    if (!userId) return;
    const newSched = { ...savedSchedule, _vacation: null };
    const supabase = createClient();
    await supabase.from("tutors").update({ schedule: newSched }).eq("id", userId);
    setSavedSchedule(newSched);
    setLocalSchedule(newSched);
  }

  function handleCancelEdit() {
    setLocalSchedule(savedSchedule);
    setLocalPriceInd(savedSchedule._prices?.individual||0);
    setLocalPriceGrp(savedSchedule._prices?.group||0);
    setLocalBuffer(savedSchedule._buffer||0);
    setEditOpen(false);
  }

  // Slot click handler
  function handleSlotClick({ item, type, date, time, dayKey: dk, slot }) {
    if (type === "template" || type === "template-add") {
      const key = dk || WEEKDAYS.find(w => w.jsDay === new Date(date + "T00:00").getDay())?.key;
      setTemplateModal({ dayKey: key, slot: type === "template" ? slot : null, time });
    } else if (type === "create") {
      setCreateModal({ date, time });
    } else {
      setDetailModal({ item, type });
    }
  }

  function handleTemplateSave(slotData) {
    setLocalSchedule(prev => {
      const key = templateModal.dayKey;
      const existing = prev[key] || [];
      const isNew = !templateModal.slot;
      const updated = isNew
        ? [...existing, slotData].sort((a, b) => a.start.localeCompare(b.start))
        : existing.map(s => s.start === templateModal.slot.start ? slotData : s);
      return { ...prev, [key]: updated };
    });
    setTemplateModal(null);
  }

  function handleTemplateDelete() {
    const { dayKey: key, slot } = templateModal;
    if (!slot) { setTemplateModal(null); return; }
    setLocalSchedule(prev => {
      const slots = (prev[key] || []).filter(s => s.start !== slot.start);
      if (!slots.length) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: slots };
    });
    setTemplateModal(null);
  }

  const weekStart  = getMonday(focusDate);
  const weekDays   = WEEKDAYS.map((d,i) => ({...d, date: addDays(weekStart,i)}));

  const nextLessonMs = nextLesson
    ? new Date(`${nextLesson.date}T${nextLesson.time_slot||"00:00"}:00`).getTime() - Date.now()
    : null;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName=""/>
      <main className="p-8">
        <div className="animate-pulse space-y-4 max-w-5xl">
          <div className="h-14 bg-gray-200 rounded-2xl"/>
          <div className="h-[450px] bg-gray-200 rounded-2xl"/>
        </div>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName}/>

      <main className="h-screen overflow-y-auto">

        {/* ══ STICKY BAR ══ */}
        <div className={`sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b transition-all ${
          dirty ? "border-amber-300 shadow-amber-100 shadow-md" : "border-gray-100 shadow-sm"
        }`}>
          <div className="px-4 md:px-6 py-4 flex flex-wrap items-center gap-3 justify-between">
            {/* Left: view + navigation */}
            <div className="flex items-center gap-3">
              <div className="flex gap-0.5 bg-gray-100 p-1 rounded-xl">
                {[
                  {key:"day",  icon:"📋", l:"დღე"  },
                  {key:"week", icon:"📅", l:"კვირა"},
                  {key:"month",icon:"🗓", l:"თვე"  },
                ].map(v => (
                  <button key={v.key} onClick={() => setViewMode(v.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      viewMode===v.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}>
                    <span>{v.icon}</span><span className="hidden sm:inline">{v.l}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => navigate(-1)}
                  className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-gray-600 font-bold text-lg transition-all">
                  ‹
                </button>
                <span className="text-sm font-bold text-gray-700 min-w-[140px] text-center">
                  {viewMode==="day"   && `${focusDate.getDate()} ${KA_MONTHS[focusDate.getMonth()]}`}
                  {viewMode==="week"  && formatWeekRange(weekStart)}
                  {viewMode==="month" && `${KA_MONTHS_FULL[focusDate.getMonth()].slice(0,3)} ${focusDate.getFullYear()}`}
                </span>
                <button onClick={() => navigate(1)}
                  className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-gray-600 font-bold text-lg transition-all">
                  ›
                </button>
                <button onClick={() => setFocusDate(new Date())}
                  className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-xl hover:bg-emerald-100 transition-all">
                  დღეს
                </button>
              </div>
              <span className="text-xs text-gray-400 font-medium hidden md:inline">🕐 GE+4</span>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              {vacation ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm bg-amber-100 text-amber-700 font-bold px-3 py-2 rounded-xl border border-amber-200 hidden sm:inline">
                    ✈️ {vacation.from} – {vacation.until}
                  </span>
                  <button onClick={handleVacationEnd}
                    className="text-sm bg-red-50 hover:bg-red-100 text-red-500 font-bold px-3 py-2 rounded-xl border border-red-200 transition-all flex items-center gap-1">
                    ✕ <span className="hidden sm:inline">შვებულება გაუქმება</span>
                  </button>
                </div>
              ) : (
                <button onClick={() => { setVacFrom(""); setVacUntil(""); setVacModal(true); }}
                  className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1">
                  ✈️ <span className="hidden sm:inline">შვებულება</span>
                </button>
              )}
              <button onClick={() => { setEditOpen(p=>!p); }}
                className={`text-sm font-bold px-4 py-2 rounded-xl transition-all border ${
                  editOpen
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-emerald-400 hover:text-emerald-600"
                }`}>
                {editOpen ? "✕ დახურვა" : "✏️ განრიგი"}
                {dirty && !editOpen && <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full ml-1.5"/>}
              </button>
              <button onClick={() => setCreateModal({ date: toDateStr(focusDate), time: "10:00" })}
                className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md">
                + <span className="hidden sm:inline">ახალი სლოტი</span>
              </button>
              {dirty && (
                <button onClick={handleSave} disabled={saving}
                  className="bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-50 text-white font-black text-sm px-6 py-2.5 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-amber-300 ring-4 ring-amber-200 animate-pulse">
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/><span>შენახვა...</span></>
                    : <><span className="text-base">💾</span><span>შენახვა</span></>
                  }
                </button>
              )}
              {saveFlash && !dirty && (
                <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold">✅ შენახულია</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-4">

          {/* ── Unsaved banner (below bar) ── */}
          {dirty && (
            <div className="flex items-center justify-between gap-3 bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg shrink-0">⚠️</span>
                <p className="text-sm text-amber-800 font-semibold">
                  ცვლილებები შენახული არ არის — დაავიწყდება თუ არ შეინახე!
                </p>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="shrink-0 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-50 text-white font-black text-sm px-5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-amber-300 ring-2 ring-amber-200">
                {saving
                  ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/><span>...</span></>
                  : <><span>💾</span><span>შენახვა</span></>
                }
              </button>
            </div>
          )}

          {/* ── Not verified ── */}
          {!isVerified && (
            <div className="bg-white border-2 border-orange-200 rounded-3xl p-10 text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">🔒</div>
              <p className="font-black text-orange-900 text-lg mb-2">განრიგი დაბლოკილია</p>
              <p className="text-sm text-orange-700 mb-5 max-w-sm mx-auto">ადმინის დამტკიცების შემდეგ ხელმისაწვდომი გახდება.</p>
              <Link href="/dashboard/tutor/verification"
                className="inline-flex items-center gap-2 bg-orange-600 text-white font-bold px-6 py-3 rounded-2xl text-sm">
                🏆 სერტიფიკაცია →
              </Link>
            </div>
          )}

          {isVerified && (<>

            {/* ── Stats row ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 font-medium mb-0.5">📅 დღეს</p>
                <p className="text-2xl font-black text-gray-900">{todayStats.count}</p>
                <p className="text-xs text-gray-400">გაკვეთილი</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 font-medium mb-0.5">💰 შემოსავალი</p>
                <p className="text-2xl font-black text-emerald-700">{todayStats.income}₾</p>
                <p className="text-xs text-gray-400">დღეს</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 font-medium mb-0.5">⏱ შემდეგი</p>
                {nextLesson ? (
                  <>
                    <p className="text-lg font-black text-blue-700">{formatCountdown(nextLessonMs)}</p>
                    <p className="text-xs text-gray-400 truncate">{nextLesson.profiles?.full_name||""}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 font-medium mt-1">—</p>
                )}
              </div>
            </div>

            {/* ── Edit panel ── */}
            {editOpen && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-gray-700 text-sm">სამუშაო სლოტები</p>
                  {dirty && <span className="text-xs text-amber-600 font-semibold">⚠ შენახვა საჭიროა</span>}
                </div>

                <div className="divide-y divide-gray-50">
                  {WEEKDAYS.map(d => {
                    const daySlots = localSchedule[d.key] || [];
                    const hasAny   = daySlots.length > 0;
                    return (
                      <div key={d.key} className="px-4 py-3">
                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${hasAny ? "text-gray-700" : "text-gray-300"}`}>
                          {d.full}
                        </p>
                        <div className="space-y-px">
                          {computeDayGrid(daySlots).map(startStr => {
                            const { status, slot: parentSlot } = getSlotCellStatus(startStr, daySlots);
                            const active = status === "active" ? daySlots.find(s => s.start === startStr) : null;
                            const expKey = `${d.key}-${startStr}`;
                            const isExp  = expandedSlotKey === expKey;

                            // ── Continuation cell — hidden (part of the ongoing slot) ──
                            if (status === "continuation") return null;

                            // ── 00:00 (midnight) — end-of-day marker, not activatable ──
                            if (startStr === "24:00") return (
                              <div key="24:00" className="flex items-center gap-2 px-2 py-0.5 select-none cursor-default">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-100 ml-0.5"/>
                                <span className="text-xs tabular-nums text-gray-200">00:00</span>
                                <span className="text-[10px] text-gray-200">— შუაღამე</span>
                              </div>
                            );

                            // ── Buffer cell (dead-zone after a slot + its buffer) ──
                            if (status === "buffer") return (
                              <div key={startStr} className="flex items-center gap-2 px-2 py-1 rounded-lg select-none cursor-default bg-orange-50/60">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-orange-200 ml-0.5"/>
                                <span className="text-xs tabular-nums font-semibold text-orange-300 w-[92px] shrink-0">{startStr}</span>
                                <span className="text-[10px] text-orange-300">⏸ {parentSlot.buffer}წთ ბუფ. ({parentSlot.start}–{parentSlot.end})</span>
                              </div>
                            );

                            // ── Active or free slot ──
                            return (
                              <div key={startStr}>
                                <div
                                  onClick={() => active
                                    ? setExpandedSlotKey(isExp ? null : expKey)
                                    : enableSlotAt(d.key, startStr)
                                  }
                                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all group select-none ${
                                    active ? "hover:bg-gray-50" : "hover:bg-gray-50/60"
                                  }`}>
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-gray-700" : "bg-gray-200 group-hover:bg-gray-300"}`}/>
                                  <span className={`text-sm tabular-nums font-semibold w-[92px] shrink-0 ${active ? "text-gray-800" : "text-gray-400"}`}>
                                    {active ? `${active.start}–${fmtTime(active.end)}` : fmtTime(startStr)}
                                  </span>
                                  {active && !isExp && (
                                    <span className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                                      <span>{SLOT_DURATIONS.find(d => d.val === Number(active.duration))?.label ?? `${active.duration}სთ`}</span>
                                      <span>{active.isGroup ? "👥" : "👤"}</span>
                                      {(active.priceInd > 0 || active.priceGrp > 0) && (
                                        <span>{active.isGroup ? active.priceGrp : active.priceInd}₾</span>
                                      )}
                                      {active.buffer > 0 && <span className="text-orange-300">⏸{active.buffer}წთ</span>}
                                    </span>
                                  )}
                                  {!active && (
                                    <span className="text-[11px] text-gray-300 group-hover:text-gray-400">+ ჩართვა</span>
                                  )}
                                  {active && (
                                    <span className="text-gray-300 text-[10px] ml-auto">{isExp ? "▴" : "▾"}</span>
                                  )}
                                  {active && (
                                    <button type="button"
                                      onClick={e => { e.stopPropagation(); removeSlotAt(d.key, startStr); }}
                                      className="text-gray-300 hover:text-red-400 text-xs transition-all leading-none px-0.5">
                                      ✕
                                    </button>
                                  )}
                                </div>

                                {/* Expanded config */}
                                {active && isExp && (
                                  <div className="ml-6 my-1.5 border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50/40">
                                    {/* Duration */}
                                    <div>
                                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5 block">ხანგრძლივობა</label>
                                      <div className="flex gap-1 flex-wrap">
                                        {SLOT_DURATIONS.filter(sd => {
                                          const [sh, sm] = active.start.split(":").map(Number);
                                          return sh * 60 + sm + Math.round(sd.val * 60) <= 24 * 60;
                                        }).map(sd => (
                                          <button key={sd.val} type="button"
                                            onClick={() => updateSlotAt(d.key, startStr, "duration", sd.val)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                              Number(active.duration) === sd.val
                                                ? "bg-gray-900 text-white border-gray-900"
                                                : "bg-white text-gray-500 border-gray-200 hover:border-gray-500"
                                            }`}>{sd.label}</button>
                                        ))}
                                      </div>
                                    </div>
                                    {/* Type */}
                                    <div>
                                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5 block">ტიპი</label>
                                      <div className="flex gap-1">
                                        <button type="button"
                                          onClick={() => updateSlotAt(d.key, startStr, "isGroup", false)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            !active.isGroup ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-500"
                                          }`}>👤 ინდ.</button>
                                        <button type="button"
                                          onClick={() => updateSlotAt(d.key, startStr, "isGroup", true)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            active.isGroup ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-500"
                                          }`}>👥 ჯგ.</button>
                                      </div>
                                    </div>
                                    {/* Group capacity (only for group slots) */}
                                    {active.isGroup && (
                                      <div>
                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5 block">👥 მოსწავლეების ლიმიტი ჯგუფში</label>
                                        <div className="flex gap-1.5">
                                          {[2, 3, 4, 5].map(n => (
                                            <button key={n} type="button"
                                              onClick={() => updateSlotAt(d.key, startStr, "maxStudents", n)}
                                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                Number(active.maxStudents || 3) === n
                                                  ? "bg-blue-600 text-white border-blue-600"
                                                  : "bg-white text-gray-500 border-gray-200 hover:border-blue-400"
                                              }`}>{n}</button>
                                          ))}
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1">მინ. 2, მაქს. 5 მოსწავლე ჯგუფში</p>
                                      </div>
                                    )}
                                    {/* Prices */}
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">👤 ინდ. ფასი სლოტზე</label>
                                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                                          <input type="number" min="0" placeholder="0"
                                            value={active.priceInd || ""}
                                            onFocus={e => e.target.select()}
                                            onChange={e => updateSlotAt(d.key, startStr, "priceInd", e.target.value === "" ? 0 : Number(e.target.value))}
                                            className="w-full px-2.5 py-1.5 text-sm font-semibold outline-none"/>
                                          <span className="px-2 text-gray-400 text-xs border-l border-gray-200 py-1.5 bg-gray-50">₾</span>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">👥 ჯგ. ფასი სლოტზე</label>
                                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                                          <input type="number" min="0" placeholder="0"
                                            value={active.priceGrp || ""}
                                            onFocus={e => e.target.select()}
                                            onChange={e => updateSlotAt(d.key, startStr, "priceGrp", e.target.value === "" ? 0 : Number(e.target.value))}
                                            className="w-full px-2.5 py-1.5 text-sm font-semibold outline-none"/>
                                          <span className="px-2 text-gray-400 text-xs border-l border-gray-200 py-1.5 bg-gray-50">₾</span>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Buffer */}
                                    <div>
                                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5 block">⏸ ბუფერი ამ სლოტის შემდეგ</label>
                                      <div className="flex gap-1.5">
                                        {[0,5,10,15].map(m => (
                                          <button key={m} type="button"
                                            onClick={() => updateSlotAt(d.key, startStr, "buffer", m)}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                              Number(active.buffer) === m
                                                ? "bg-gray-900 text-white border-gray-900"
                                                : "bg-white text-gray-500 border-gray-200 hover:border-gray-500"
                                            }`}>{m === 0 ? "0წთ" : `${m}წთ`}</button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Calendar views ── */}
            {viewMode === "day" && <DayView
              focusDate={focusDate} savedSchedule={savedSchedule} bufferMin={bufferMin}
              viewBookings={viewBookings} viewSlots={viewSlots} onSlotClick={handleSlotClick}
              vacation={vacation}/>}

            {viewMode === "week" && <WeekView
              weekDays={weekDays} savedSchedule={savedSchedule} bufferMin={bufferMin}
              viewBookings={viewBookings} viewSlots={viewSlots} onSlotClick={handleSlotClick}
              vacation={vacation}/>}

            {viewMode === "month" && <MonthView
              focusDate={focusDate} savedSchedule={savedSchedule}
              viewBookings={viewBookings} viewSlots={viewSlots}
              onDayClick={(d) => { setFocusDate(d); setViewMode("day"); }}
              vacation={vacation}/>}

          </>)}
        </div>
      </main>

      {/* ── Slot detail modal ── */}
      {detailModal && (
        <SlotDetailModal
          item={detailModal.item} type={detailModal.type}
          onClose={() => setDetailModal(null)}
          onCancelled={() => fetchViewData(userId, viewMode, focusDate)}
          onRefresh={() => fetchViewData(userId, viewMode, focusDate)}/>
      )}

      {/* ── Template slot edit/add modal ── */}
      {templateModal && (
        <SlotTemplateModal
          dayKey={templateModal.dayKey}
          slot={templateModal.slot}
          time={templateModal.time}
          onClose={() => setTemplateModal(null)}
          onSave={handleTemplateSave}
          onDelete={handleTemplateDelete}/>
      )}

      {/* ── Create slot modal ── */}
      {createModal && (
        <CreateSlotModal
          tutorSubjects={tutorSubjects}
          prefillDate={createModal.date}
          prefillTime={createModal.time}
          userId={userId}
          defaultPrices={defaultPrices}
          onClose={() => setCreateModal(null)}
          onCreated={() => { setCreateModal(null); fetchViewData(userId, viewMode, focusDate); fetchTodayStats(userId); }}/>
      )}

      {/* ── Vacation modal ── */}
      {vacModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVacModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-2xl mb-3">✈️</div>
            <h3 className="font-black text-gray-900 text-lg mb-1">შვებულების რეჟიმი</h3>
            <p className="text-sm text-gray-500 mb-5">
              მითითებულ პერიოდში კალენდარი დაიბლოკება ახალი ჯავშნებისთვის
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">📅 დაწყება</label>
                <input type="date" value={vacFrom} onChange={e => setVacFrom(e.target.value)}
                  min={toDateStr(new Date())}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">📅 დასრულება</label>
                <input type="date" value={vacUntil} onChange={e => setVacUntil(e.target.value)}
                  min={vacFrom || toDateStr(new Date())}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"/>
              </div>
              {vacFrom && vacUntil && vacUntil >= vacFrom && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-amber-800">
                  ✈️ შვებულება: {vacFrom} – {vacUntil}
                </div>
              )}
              {vacFrom && vacUntil && vacUntil < vacFrom && (
                <p className="text-xs text-red-600 font-semibold">დასრულების თარიღი უნდა იყოს დაწყების შემდეგ</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setVacModal(false)}
                className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold text-sm rounded-2xl hover:bg-gray-50 transition-all">
                გაუქმება
              </button>
              <button onClick={handleVacationSave} disabled={!vacFrom || !vacUntil || vacUntil < vacFrom}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all">
                ✈️ ჩართვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
