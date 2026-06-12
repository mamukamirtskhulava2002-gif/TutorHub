"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

const TYPES = [
  { key: "trial",     icon: "🎓", label: "საცდელი",    desc: "ერთჯერადი, შეღავათიანი"   },
  { key: "single",    icon: "📅", label: "ერთჯერადი",  desc: "ერთი გაკვეთილი"           },
  { key: "package",   icon: "📦", label: "პაკეტი",     desc: "1–6 თვე, ავტო-ჩარიცხვა"  },
  { key: "recurring", icon: "🔁", label: "განმეორება", desc: "ყოველ კვირა, N კვირა"     },
];

const DURATIONS = [
  { v: 0.25, l: "15 წთ" },
  { v: 0.5,  l: "30 წთ" },
  { v: 0.75, l: "45 წთ" },
  { v: 1,    l: "1 სთ"  },
  { v: 1.5,  l: "1.5 სთ" },
  { v: 2,    l: "2 სთ"  },
];

export default function CreateSlotModal({ tutorSubjects = [], prefillDate = "", prefillTime = "", userId, defaultPrices = {}, onClose, onCreated }) {
  const [step,        setStep]        = useState(1);
  const [bookingType, setBookingType] = useState("single");
  const [isGroup,     setIsGroup]     = useState(false);
  const [minStudents, setMinStudents] = useState(2);
  const [maxCapacity, setMaxCapacity] = useState(3);
  const [date,        setDate]        = useState(prefillDate || new Date().toLocaleDateString("en-CA"));
  const [timeSlot,    setTimeSlot]    = useState(prefillTime || "09:00");
  const [duration,    setDuration]    = useState(1);
  const [price,       setPrice]       = useState(() => String(defaultPrices.individual || ""));
  const [subject,     setSubject]     = useState(tutorSubjects[0] || "");
  const [weeksCount,  setWeeksCount]  = useState(4);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  // Auto-fill price when format changes
  function handleFormatChange(val) {
    setIsGroup(val);
    if (val && defaultPrices.group)       setPrice(String(defaultPrices.group));
    if (!val && defaultPrices.individual) setPrice(String(defaultPrices.individual));
  }

  const isRecurring = bookingType === "recurring" || bookingType === "package";

  async function handleCreate() {
    if (!date || !timeSlot || !price) { setError("შეავსე ყველა სავალდებულო ველი"); return; }
    if (Number(price) <= 0)           { setError("ფასი > 0 უნდა იყოს"); return; }
    setSaving(true); setError("");

    const res = await fetch("/api/lesson-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingType, isGroup,
        minStudents: isGroup ? minStudents : 1,
        maxCapacity: isGroup ? maxCapacity : 1,
        date, timeSlot,
        durationHours: duration,
        pricePerStudent: Number(price),
        subject: subject ? [subject] : [],
        weeksCount: isRecurring ? weeksCount : 1,
      }),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error || "შეცდომა"); setSaving(false); return; }
    setSaving(false);
    onCreated?.(json.slots);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-5 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">➕ ახალი სლოტის შექმნა</h2>
              <p className="text-emerald-100 text-xs mt-0.5">
                {step === 1 ? "ტიპი & ფორმატი" : step === 2 ? "დეტალები" : "გადახედვა"}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition-all">✕</button>
          </div>
          {/* Step indicator */}
          <div className="flex gap-1 mt-3">
            {[1,2,3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── STEP 1: Type + Format ── */}
          {step === 1 && (<>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">გაკვეთილის ტიპი</p>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(t => (
                  <button key={t.key} type="button" onClick={() => setBookingType(t.key)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      bookingType === t.key
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-100 hover:border-gray-200 bg-gray-50"
                    }`}>
                    <span className="text-xl">{t.icon}</span>
                    <p className="font-bold text-gray-900 text-sm mt-1">{t.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ფორმატი</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: false, icon: "👤", label: "ინდივიდუალური", desc: "1 მოსწავლე" },
                  { val: true,  icon: "👥", label: "ჯგუფური",      desc: "2–5 მოსწავლე" },
                ].map(f => (
                  <button key={String(f.val)} type="button" onClick={() => handleFormatChange(f.val)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      isGroup === f.val
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-100 hover:border-gray-200 bg-gray-50"
                    }`}>
                    <span className="text-xl">{f.icon}</span>
                    <p className="font-bold text-gray-900 text-sm mt-1">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.desc}</p>
                  </button>
                ))}
              </div>

              {isGroup && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">მინ. მოსწავლეების რაოდ.</p>
                    <div className="flex gap-1.5">
                      {[2,3].map(n => (
                        <button key={n} type="button" onClick={() => setMinStudents(n)}
                          className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                            minStudents === n ? "bg-blue-600 text-white" : "bg-white text-blue-700 border border-blue-200"
                          }`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">მაქს. ჯგუფის ზომა</p>
                    <div className="flex gap-1.5">
                      {[2,3,4,5].map(n => (
                        <button key={n} type="button" onClick={() => setMaxCapacity(n)}
                          className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                            maxCapacity === n ? "bg-blue-600 text-white" : "bg-white text-blue-700 border border-blue-200"
                          }`}>{n}</button>
                      ))}
                    </div>
                    <p className="text-xs text-blue-500 mt-1">ფასი — "თითო მოსწავლეზე"</p>
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setStep(2)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all">
              შემდეგი →
            </button>
          </>)}

          {/* ── STEP 2: Details ── */}
          {step === 2 && (<>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">📆 თარიღი</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">🕐 დრო</label>
                <input type="time" value={timeSlot} onChange={e => setTimeSlot(e.target.value)}
                  style={{ colorScheme: "light" }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">⏱ ხანგრძლივობა</label>
              <div className="flex gap-2">
                {DURATIONS.map(d => (
                  <button key={d.v} type="button" onClick={() => setDuration(d.v)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border ${
                      duration === d.v
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-300"
                    }`}>{d.l}</button>
                ))}
              </div>
            </div>

            {tutorSubjects.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">📚 საგანი</label>
                <div className="flex flex-wrap gap-2">
                  {tutorSubjects.map(s => (
                    <button key={s} type="button" onClick={() => setSubject(s)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                        subject === s
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                💰 ფასი {isGroup ? "(თითო მოსწავლეზე)" : ""}
              </label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-400">
                <input type="number" min="0" max="500" value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2.5 text-sm font-semibold outline-none bg-white" />
                <span className="px-3 text-gray-400 font-bold text-sm bg-gray-50 h-full flex items-center border-l border-gray-200">₾</span>
              </div>
              {isGroup && price && (
                <p className="text-xs text-emerald-600 mt-1 font-semibold">
                  მაქს. შემოსავალი: {(Number(price) * maxCapacity).toFixed(0)} ₾
                  ({maxCapacity} მოსწ. × {price} ₾)
                </p>
              )}
            </div>

            {isRecurring && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">🔁 განმეორება</label>
                <div className="flex gap-2">
                  {[4, 8, 12].map(w => (
                    <button key={w} type="button" onClick={() => setWeeksCount(w)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                        weeksCount === w
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-violet-300"
                      }`}>{w} კვ.</button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  შეიქმნება {weeksCount} სლოტი ყოველ კვირა იმავე დღეს/დროს
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">{error}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all text-sm">
                ← უკან
              </button>
              <button onClick={() => { if (!date||!timeSlot||!price) { setError("შეავსე ყველა ველი"); return; } setError(""); setStep(3); }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all text-sm">
                გადახედვა →
              </button>
            </div>
          </>)}

          {/* ── STEP 3: Review ── */}
          {step === 3 && (<>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl divide-y divide-gray-100">
              {[
                ["ტიპი",       `${TYPES.find(t=>t.key===bookingType)?.icon} ${TYPES.find(t=>t.key===bookingType)?.label}`],
                ["ფორმატი",    isGroup ? `👥 ჯგუფური (${minStudents}–${maxCapacity} სტ.)` : "👤 ინდივიდუალური"],
                ["თარიღი",     date],
                ["დრო",        timeSlot],
                ["ხანგ.",      DURATIONS.find(d => d.v === duration)?.l ?? `${duration} სთ`],
                ["საგანი",     subject || "—"],
                ["ფასი",       isGroup ? `${price} ₾ / სტ. (მაქს. ${Number(price)*maxCapacity} ₾)` : `${price} ₾`],
                ...(isRecurring ? [["სლოტი",   `${weeksCount} კვირა (${weeksCount} ჯერ)`]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs font-semibold text-gray-400">{k}</span>
                  <span className="text-sm font-bold text-gray-900">{v}</span>
                </div>
              ))}
            </div>

            {isGroup && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                ⚠️ გაკვეთილი გაიმართება მხოლოდ მინ. <strong>{minStudents}</strong> სტუდენტის ჩარიცხვის შემდეგ.
                სლოტი <strong>სავსეა</strong> — {maxCapacity} სტ-ის შემდეგ, დამატებები waitlist-ში ვარდება.
              </div>
            )}

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">{error}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} disabled={saving}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all text-sm">
                ← უკან
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> ქმნება...</>
                  : "✅ სლოტის შექმნა"
                }
              </button>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
