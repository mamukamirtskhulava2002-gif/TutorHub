"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase";
import {
  REGIONS,
  getMunicipalitiesByRegion,
  findNearestLocation,
  cityInRegion,
  cityInMunicipality,
  getTutorCoords,
} from "@/lib/geo-data";

const TutorMap = dynamic(() => import("@/components/TutorMap"), { ssr: false });

const SUBJECTS = [
  // სკოლა
  "მათემატიკა","ფიზიკა","ქიმია","ბიოლოგია","გეოგრაფია","ისტორია",
  "ქართული ენა და ლიტერატურა","სამოქალაქო განათლება","ინფორმატიკა",
  // უცხო ენები
  "ინგლისური ენა","გერმანული ენა","ფრანგული ენა","ესპანური ენა",
  "ჩინური ენა","იაპონური ენა","არაბული ენა","რუსული ენა",
  "IELTS / TOEFL / SAT მომზადება",
  // პროგრამირება & ტექნოლოგია
  "Python","JavaScript","Java","C# / C++","Swift",
  "UI/UX დიზაინი","გრაფიკული დიზაინი","3D მოდელირება",
  "კიბერუსაფრთხოება","Cloud Computing","მონაცემთა ბაზები (SQL)",
  // ბიზნესი & ფინანსები
  "ციფრული მარკეტინგი","SMM და SEO","ბუღალტერია",
  "ფინანსური მოდელირება","პროექტების მართვა (Agile/Scrum)",
  // მუსიკა & ხელოვნება
  "ფორტეპიანო","გიტარა","ვიოლინო","დრამი","სოლფეჯიო","მუსიკალური თეორია",
  "ხატვა","ფოტოგრაფია","კინომონტაჟი",
  // სხვა
  "იოგა და მედიტაცია","კულინარია","ჭადრაკი","საჯარო გამოსვლები",
  "სწრაფი კითხვა","მართვის მოწმობის თეორია",
];
const CITIES   = ["თბილისი","ბათუმი","ქუთაისი","რუსთავი","გორი","ზუგდიდი"];
const COLORS   = ["avatar-green","avatar-blue","avatar-amber","avatar-purple","avatar-coral"];
const WEEK_KEYS   = ["sun","mon","tue","wed","thu","fri","sat"];
const WEEK_LABELS = { mon:"ორშ", tue:"სამ", wed:"ოთხ", thu:"ხუთ", fri:"პარ", sat:"შაბ", sun:"კვი" };
const WEEK_NAMES  = {
  mon:"ორშაბათი", tue:"სამშაბათი", wed:"ოთხშაბათი",
  thu:"ხუთშაბათი", fri:"პარასკევი", sat:"შაბათი", sun:"კვირა",
};
const WEEKDAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const TIME_OPTIONS = [
  { value: "",      label: "ნებისმიერ დროს" },
  { value: "08:00", label: "08:00-ის შემდეგ" },
  { value: "10:00", label: "10:00-ის შემდეგ" },
  { value: "14:00", label: "14:00-ის შემდეგ" },
  { value: "17:00", label: "17:00-ის შემდეგ" },
  { value: "18:00", label: "18:00-ის შემდეგ" },
  { value: "19:00", label: "19:00-ის შემდეგ" },
  { value: "20:00", label: "20:00-ის შემდეგ" },
];

function getInitials(name) {
  if (!name) return "??";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function timeToMinutes(t) {
  if (!t || typeof t !== "string") return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

const SCHED_DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
function getSchedulePrices(schedule) {
  if (!schedule) return { ind: null, grp: null };
  const defInd = schedule._prices?.individual || null;
  const defGrp = schedule._prices?.group || null;
  let minInd = null, minGrp = null;
  for (const day of SCHED_DAYS) {
    for (const sl of (schedule[day] || [])) {
      if (typeof sl !== "object") continue;
      const pi = sl.priceInd ?? defInd;
      const pg = sl.isGroup ? (sl.priceGrp ?? defGrp) : null;
      if (pi > 0 && (minInd === null || pi < minInd)) minInd = pi;
      if (pg > 0 && (minGrp === null || pg < minGrp)) minGrp = pg;
    }
  }
  if (minInd === null && defInd > 0) minInd = defInd;
  if (minGrp === null && defGrp > 0) minGrp = defGrp;
  return { ind: minInd, grp: minGrp };
}

function getNextDays(count = 7) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = WEEK_KEYS[d.getDay()];
    return {
      key,
      label: i === 0 ? "დღეს" : i === 1 ? "ხვალ" : WEEK_LABELS[key],
      dateStr: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
      dayNum: d.getDate(),
    };
  });
}

// ─────────────────────────────────────
// Price Range Slider
// ─────────────────────────────────────
function PriceRangeSlider({ min, max, value, onChange }) {
  const pct = v => Math.round(((v - min) / (max - min)) * 100);
  return (
    <div className="relative h-6 mt-1">
      <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200 rounded-full">
        <div className="absolute h-full bg-emerald-500 rounded-full"
          style={{ left: `${pct(value[0])}%`, right: `${100 - pct(value[1])}%` }} />
      </div>
      <input type="range" min={min} max={max} step={5} value={value[0]}
        onChange={e => onChange([Math.min(Number(e.target.value), value[1]-5), value[1]])}
        className="absolute w-full h-full opacity-0 cursor-pointer" style={{ zIndex: value[0] > max-10 ? 5 : 3 }} />
      <input type="range" min={min} max={max} step={5} value={value[1]}
        onChange={e => onChange([value[0], Math.max(Number(e.target.value), value[0]+5)])}
        className="absolute w-full h-full opacity-0 cursor-pointer" style={{ zIndex: 4 }} />
      {[value[0], value[1]].map((v, i) => (
        <div key={i} className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-500 rounded-full shadow-sm pointer-events-none"
          style={{ left: `calc(${pct(v)}% - 8px)` }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────
// Quick Slot Strip — next 7 days
// ─────────────────────────────────────
function QuickSlotStrip({ tutor }) {
  const days = getNextDays(7);
  const [activeDayIdx, setActiveDayIdx] = useState(() => {
    const first = days.findIndex(d => (tutor.schedule?.[d.key] || []).length > 0);
    return first >= 0 ? first : 0;
  });

  const activeDay  = days[activeDayIdx];
  const rawSlots   = tutor.schedule?.[activeDay?.key] || [];
  const slotTimes  = rawSlots.map(s => (typeof s === "string" ? s : (s.start || s.time))).filter(Boolean);
  const shown      = slotTimes.slice(0, 4);
  const extra      = slotTimes.length - shown.length;

  const hasDays = days.some(d => (tutor.schedule?.[d.key] || []).length > 0);
  if (!hasDays) return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-400 text-center py-1">განრიგი ჯერ არ არის</p>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Day pills */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth:"none" }}>
        {days.map((d, i) => {
          const has = (tutor.schedule?.[d.key] || []).length > 0;
          return (
            <button key={i} onClick={() => setActiveDayIdx(i)} disabled={!has}
              className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                !has
                  ? "text-gray-300 cursor-not-allowed"
                  : activeDayIdx === i
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600"
              }`}>
              {d.label}
            </button>
          );
        })}
      </div>
      {/* Time slots */}
      <div className="flex gap-1.5 flex-wrap">
        {shown.length === 0 ? (
          <p className="text-xs text-gray-400">ამ დღეს სლოტი არ არის</p>
        ) : (
          <>
            {shown.map(time => (
              <Link key={time}
                href={`/booking/${tutor.id}?date=${activeDay.dateStr}&time=${encodeURIComponent(time)}`}
                className="text-xs px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all">
                {time}
              </Link>
            ))}
            {extra > 0 && (
              <Link href={`/booking/${tutor.id}`}
                className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 transition-all">
                +{extra} →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// Tutor List Card
// ─────────────────────────────────────
function TutorListCard({ tutor, index }) {
  const name       = tutor.profiles?.full_name || "—";
  const color      = COLORS[index % COLORS.length];
  const isFreeTrial = tutor.trial_price === 0;
  const isPopular  = (tutor.review_count || 0) >= 15 || (tutor.rating || 0) >= 4.8;
  const hasPackages = (tutor.max_sessions_per_week || 0) > 0 || !!tutor.accepts_packages;
  const hasGroup   = Object.values(tutor.schedule || {}).flat().some(
    s => typeof s === "object" && s?.type === "group"
  );
  const stars = Math.round(tutor.rating || 0);

  const isCertified = tutor.tier === "certified";

  return (
    <div className={`card p-5 hover:shadow-md transition-all ${
      isCertified
        ? "border-2 border-amber-300 hover:border-amber-400 shadow-amber-100"
        : "border border-gray-100 hover:border-emerald-200"
    }`}>
      {isCertified && (
        <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
          👑 <span>Certified Tutor — ლიცენზირებული პედაგოგი</span>
        </div>
      )}
      <div className="flex gap-4">

        {/* ── Left: Avatar + special badges ── */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
          <div className={`avatar w-14 h-14 text-base relative ${color} overflow-hidden ${isCertified ? "ring-2 ring-amber-400 ring-offset-1" : ""}`}>
            {tutor.profiles?.avatar_url
              ? <img src={tutor.profiles.avatar_url} alt={name} className="w-full h-full object-cover" />
              : getInitials(name)
            }
            {tutor.is_verified && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs shadow-sm font-bold">✓</span>
            )}
          </div>
          {isFreeTrial  && <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">🆓 უფასო</span>}
          {isPopular    && <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">🔥 პოპ.</span>}
          {hasPackages  && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">🔄 პაკ.</span>}
        </div>

        {/* ── Center/Right: Info ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">

            {/* Name + rating */}
            <div>
              <h3 className="font-bold text-gray-900 text-base leading-tight">{name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-amber-400 text-xs leading-none">
                  {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                </span>
                <span className="text-sm font-bold text-gray-900">{tutor.rating ?? "—"}</span>
                <span className="text-xs text-gray-400">({tutor.review_count ?? 0} შეფ.)</span>
                {(tutor.experience_years || 0) > 0 && (
                  <span className="text-xs text-gray-400">· {tutor.experience_years} წ. გამოცდ.</span>
                )}
              </div>
            </div>

            {/* Price */}
            {(() => {
              const { ind, grp } = getSchedulePrices(tutor.schedule);
              if (!ind && !grp) return null;
              return (
                <div className="text-right flex-shrink-0 space-y-1">
                  {ind > 0 && (
                    <div>
                      <span className="text-2xl font-black text-gray-900 leading-none">{ind}</span>
                      <span className="text-base text-gray-400"> ₾</span>
                      <p className="text-xs text-gray-400">👤 ინდ. / სთ</p>
                    </div>
                  )}
                  {grp > 0 && (
                    <div>
                      <span className="text-xl font-bold text-emerald-600 leading-none">{grp}</span>
                      <span className="text-sm text-gray-400"> ₾</span>
                      <p className="text-xs text-gray-400">👥 ჯგუფ. / სთ</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Bio tagline */}
          {tutor.bio && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">{tutor.bio}</p>
          )}

          {/* Tags */}
          <div className="flex gap-1.5 flex-wrap mt-2">
            {(tutor.subject || []).slice(0, 3).map(s => (
              <span key={s} className="badge-green text-xs">{s}</span>
            ))}
            {(tutor.subject || []).length > 3 && (
              <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full border border-gray-200">
                +{tutor.subject.length - 3}
              </span>
            )}
            {tutor.is_online  && <span className="badge-blue text-xs">🌐 ონლაინ</span>}
            {tutor.is_offline && <span className="badge-amber text-xs">🏫 პირისპირ</span>}
            {hasGroup         && <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full">👥 ჯგუფური</span>}
            {tutor.city       && <span className="text-xs text-gray-400">📍 {tutor.city}</span>}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <Link href={`/tutor/${tutor.id}`}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-emerald-300 hover:text-emerald-600 transition-all font-medium">
              პროფილი
            </Link>
            <Link href={`/booking/${tutor.id}`}
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all">
              განრიგი / დაჯავშნა →
            </Link>
          </div>
        </div>
      </div>

      {/* Quick slot strip */}
      <QuickSlotStrip tutor={tutor} />
    </div>
  );
}

// ─────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex gap-4">
        <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex justify-between">
            <div>
              <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
          <div className="h-3 bg-gray-200 rounded w-full mt-3 mb-1.5" />
          <div className="h-3 bg-gray-200 rounded w-4/5" />
          <div className="flex gap-2 mt-3">
            <div className="h-6 bg-gray-200 rounded-full w-16" />
            <div className="h-6 bg-gray-200 rounded-full w-14" />
          </div>
          <div className="flex gap-2 mt-3">
            <div className="h-9 bg-gray-200 rounded-xl w-24" />
            <div className="h-9 bg-gray-200 rounded-xl flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// Subject searchable dropdown
// ─────────────────────────────────────
function SubjectDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery("");
  }, [open]);

  const filtered = query.trim()
    ? SUBJECTS.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : SUBJECTS;

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">საგანი</p>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-all ${
          value
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
            : "border-gray-200 text-gray-500 hover:border-emerald-300"
        }`}
      >
        <span className="truncate">{value || "საგნის არჩევა..."}</span>
        <span className="ml-2 text-gray-400 flex-shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="საგნის ძებნა..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none"
            />
          </div>
          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {value && (
              <button
                onClick={() => { onChange(""); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-b border-gray-50"
              >
                ✕ გასუფთავება
              </button>
            )}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">არ მოიძებნა</p>
            )}
            {filtered.map(s => (
              <button
                key={s}
                onClick={() => { onChange(s === value ? "" : s); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  s === value
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────
// Filters Panel — must be OUTSIDE SearchContent to avoid remounting
// ─────────────────────────────────────
function FiltersPanel({ filters, setF, geoLoading, handleNearMe, filtered, toggleDay, hasActive, clearAll }) {
  return (
    <div className="space-y-5">

      {/* Subject — searchable dropdown */}
      <SubjectDropdown value={filters.subject} onChange={v => setF("subject", v)} />

      {/* Price */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">ფასი / საათი</p>
        <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
          <span>{filters.priceRange[0]} ₾</span>
          <span>{filters.priceRange[1]} ₾</span>
        </div>
        <PriceRangeSlider min={0} max={200} value={filters.priceRange} onChange={v => setF("priceRange", v)} />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>10 ₾</span><span>200 ₾</span>
        </div>
      </div>

      {/* 📍 Geographic filter */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
            📍 მდებარეობა
          </p>
          <button
            onClick={handleNearMe}
            disabled={geoLoading}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-1">
            {geoLoading ? (
              <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin inline-block" />
            ) : "🎯"} ჩემს გარშემო
          </button>
        </div>

        {/* Region */}
        <div className="mb-2">
          <label className="text-xs text-gray-500 mb-1 block">რეგიონი</label>
          <select
            value={filters.region}
            onChange={e => { setF("region", e.target.value); setF("municipality", ""); setF("village", ""); }}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-blue-400 text-gray-700">
            <option value="">ყველა რეგიონი</option>
            {REGIONS.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Municipality */}
        {filters.region && (
          <div className="mb-2">
            <label className="text-xs text-gray-500 mb-1 block">მუნიციპალიტეტი</label>
            <select
              value={filters.municipality}
              onChange={e => { setF("municipality", e.target.value); setF("village", ""); }}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-blue-400 text-gray-700">
              <option value="">ყველა მუნიციპ.</option>
              {getMunicipalitiesByRegion(filters.region).map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Village */}
        {filters.municipality && (
          <div className="mb-2">
            <label className="text-xs text-gray-500 mb-1 block">სოფელი / უბანი</label>
            <select
              value={filters.village}
              onChange={e => setF("village", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-blue-400 text-gray-700">
              <option value="">ყველა სოფელი / უბანი</option>
              {getMunicipalitiesByRegion(filters.region)
                .find(m => m.name === filters.municipality)
                ?.villages.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
            </select>
          </div>
        )}

        {/* Mini map */}
        <div className="mt-2 rounded-xl overflow-hidden border border-blue-200" style={{ height: 200 }}>
          <TutorMap
            height="200px"
            focusRegion={filters.region || null}
            tutors={filtered.map(t => {
              const coords = getTutorCoords(t);
              return {
                id:             t.id,
                name:           t.profiles?.full_name || "მასწავლებელი",
                subject:        t.subject || [],
                price_per_hour: t.price_per_hour,
                rating:         t.rating,
                is_verified:    t.is_verified,
                city:           t.city,
                avatar_url:     t.profiles?.avatar_url || null,
                lat:            t.exact_lat  ?? coords?.lat  ?? null,
                lng:            t.exact_lng  ?? coords?.lng  ?? null,
              };
            })}
          />
        </div>
      </div>

      {/* ⚡ Time */}
      <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-0.5 flex items-center gap-1">
          ⚡ თავისუფალი დრო
        </p>
        <p className="text-xs text-gray-400 mb-3">მონიშნეთ სასწავლო დღეები და სასურველი საათი</p>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(day => (
            <button key={day} onClick={() => toggleDay(day)}
              className={`py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                filters.availDays.includes(day)
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600"
              }`}>
              {WEEK_LABELS[day]}
            </button>
          ))}
        </div>
        <select value={filters.availAfter} onChange={e => setF("availAfter", e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-emerald-400 text-gray-600">
          {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Lesson type */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">გაკვეთილის ტიპი</p>
        <div className="flex gap-2">
          {[
            { k: "",           icon: "📚", l: "ყველა" },
            { k: "individual", icon: "👤", l: "ინდ." },
            { k: "group",      icon: "👥", l: "ჯგუფ." },
          ].map(({ k, icon, l }) => (
            <button key={k} onClick={() => setF("lessonType", k)}
              className={`flex-1 text-xs py-2.5 rounded-xl border font-semibold transition-all ${
                filters.lessonType === k
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-gray-200 text-gray-500 hover:border-emerald-300"
              }`}>
              {icon} {l}
            </button>
          ))}
        </div>
      </div>

      {/* Booking flexibility */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">ჯავშნის ტიპი</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={filters.hasTrial}
              onChange={e => setF("hasTrial", e.target.checked)}
              className="accent-emerald-600 w-4 h-4 rounded" />
            🆓 საცდელი გაკვეთილი (Trial)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={filters.hasPackages}
              onChange={e => setF("hasPackages", e.target.checked)}
              className="accent-emerald-600 w-4 h-4 rounded" />
            🔄 გრძელვადიანი პაკეტები (1-6 თვე)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={filters.certifiedOnly}
              onChange={e => setF("certifiedOnly", e.target.checked)}
              className="accent-amber-500 w-4 h-4 rounded" />
            <span className="font-semibold text-amber-700">👑 მხოლოდ ლიცენზირებული</span>
          </label>
        </div>
      </div>

      {/* Format */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">ფორმატი</p>
        <div className="flex flex-col gap-2">
          {[["online","🌐 ონლაინ"],["offline","🏫 პირისპირ"]].map(([k,l]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={filters[k]}
                onChange={e => setF(k, e.target.checked)}
                className="accent-emerald-600 w-4 h-4 rounded" />
              {l}
            </label>
          ))}
        </div>
      </div>

      {/* City */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">ქალაქი</p>
        <select value={filters.city} onChange={e => setF("city", e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-emerald-400 text-gray-600">
          <option value="">ყველა ქალაქი</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Min rating */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">მინ. რეიტინგი</p>
        <div className="flex gap-1.5 flex-wrap">
          {[0, 3, 4, 4.5].map(r => (
            <button key={r} onClick={() => setF("minRating", r)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                filters.minRating === r
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-gray-200 text-gray-500 hover:border-emerald-300"
              }`}>
              {r === 0 ? "ყველა" : `⭐ ${r}+`}
            </button>
          ))}
        </div>
      </div>

      {/* Experience */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          მინ. გამოცდილება:{" "}
          <span className="text-emerald-600 normal-case font-bold">{filters.minExperience} წელი</span>
        </p>
        <input type="range" min={0} max={15} step={1} value={filters.minExperience}
          onChange={e => setF("minExperience", Number(e.target.value))}
          className="w-full accent-emerald-600" />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0</span><span>15+ წელი</span>
        </div>
      </div>

      {hasActive && (
        <button onClick={clearAll}
          className="w-full text-sm text-red-500 hover:text-red-600 py-2 rounded-xl border border-red-100 hover:bg-red-50 transition-all font-medium">
          ✕ ყველა ფილტრის გასუფთავება
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────
// Main Search Page
// ─────────────────────────────────────
function SearchContent() {
  const params = useSearchParams();
  const [tutors, setTutors]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState(params.get("q") || "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sort, setSort]       = useState("rating");
  const [viewMode, setViewMode] = useState("list");
  const [geoLoading, setGeoLoading] = useState(false);
  const [filters, setFilters] = useState({
    subject:      params.get("subject") || "",
    priceRange:   [0, 200],
    minRating:    0,
    online:       false,
    offline:      false,
    city:         "",
    minExperience: 0,
    availDays:    [],
    availAfter:   "",
    lessonType:   "",
    hasTrial:     false,
    hasPackages:  false,
    // geo
    region:        "",
    municipality:  "",
    village:       "",
    certifiedOnly: false,
  });

  function setF(k, v) { setFilters(f => ({ ...f, [k]: v })); }
  function toggleDay(day) {
    setFilters(f => ({
      ...f,
      availDays: f.availDays.includes(day)
        ? f.availDays.filter(d => d !== day)
        : [...f.availDays, day],
    }));
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tutors")
        .select(`
          id, price_per_hour, rating, review_count,
          is_online, is_offline, is_verified, tier,
          subject, experience_years, city, bio, schedule,
          trial_price, max_sessions_per_week, accepts_packages,
          region_id, municipality_id,
          exact_lat, exact_lng,
          profiles(full_name, avatar_url)
        `)
        .eq("is_verified", true)
        .order("rating", { ascending: false });
      if (!error && data) setTutors(data);
      setLoading(false);
    }
    load();
  }, []);

  // ── Filter logic ──
  function matchesTime(t) {
    if (!filters.availDays.length && !filters.availAfter) return true;
    const sched = t.schedule || {};
    const minMin = filters.availAfter ? timeToMinutes(filters.availAfter) : 0;
    const days   = filters.availDays.length ? filters.availDays : Object.keys(sched);
    return days.some(day =>
      (sched[day] || []).some(s => {
        const time = typeof s === "string" ? s : s.time;
        return !filters.availAfter || timeToMinutes(time) >= minMin;
      })
    );
  }

  function matchesLessonType(t) {
    if (!filters.lessonType) return true;
    const all = Object.values(t.schedule || {}).flat();
    if (filters.lessonType === "group")
      return all.some(s => typeof s === "object" && s?.type === "group");
    return all.some(s => typeof s === "string" || s?.type === "individual");
  }

  function matchesGeo(t) {
    const city = (t.city || "").toLowerCase();
    const bio  = (t.bio  || "").toLowerCase();

    if (filters.village) {
      const v = filters.village.toLowerCase();
      return city.includes(v) || bio.includes(v);
    }
    if (filters.municipality) {
      return cityInMunicipality(t.city, filters.municipality);
    }
    if (filters.region) {
      return cityInRegion(t.city, filters.region);
    }
    return true;
  }


  async function handleNearMe() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const result = findNearestLocation(pos.coords.latitude, pos.coords.longitude);
        if (result) {
          setF("region", result.region.id);
          setF("municipality", result.municipality.name);
          setF("village", "");
        }
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  }

  const filtered = tutors
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (t.profiles?.full_name || "").toLowerCase().includes(q) ||
             (t.subject || []).join(" ").toLowerCase().includes(q) ||
             (t.bio || "").toLowerCase().includes(q);
    })
    .filter(t => !filters.subject || (t.subject || []).includes(filters.subject))
    .filter(t => { const { ind } = getSchedulePrices(t.schedule); if (!ind) return true; return ind >= filters.priceRange[0] && ind <= filters.priceRange[1]; })
    .filter(t => (t.rating || 0) >= filters.minRating)
    .filter(t => !filters.online  || t.is_online)
    .filter(t => !filters.offline || t.is_offline)
    .filter(t => !filters.city    || t.city === filters.city)
    .filter(t => (t.experience_years || 0) >= filters.minExperience)
    .filter(matchesTime)
    .filter(matchesLessonType)
    .filter(t => !filters.hasTrial    || t.trial_price === 0)
    .filter(t => !filters.hasPackages    || (t.max_sessions_per_week > 0 || t.accepts_packages))
    .filter(t => !filters.certifiedOnly || t.tier === "certified")
    .filter(matchesGeo)
    .sort((a, b) =>
      sort === "price_asc"  ? (a.price_per_hour||0) - (b.price_per_hour||0)
      : sort === "price_desc" ? (b.price_per_hour||0) - (a.price_per_hour||0)
      : sort === "reviews"    ? (b.review_count||0)  - (a.review_count||0)
      : (b.rating||0) - (a.rating||0)
    );

  function clearAll() {
    setFilters({
      subject:"", priceRange:[0,200], minRating:0, online:false, offline:false,
      city:"", minExperience:0, availDays:[], availAfter:"",
      lessonType:"", hasTrial:false, hasPackages:false,
      region:"", municipality:"", village:"",
      certifiedOnly: false,
    });
    setSearch("");
  }

  const hasActive =
    filters.subject || filters.minRating > 0 || filters.online || filters.offline ||
    filters.city || filters.minExperience > 0 || filters.availDays.length > 0 ||
    filters.availAfter || filters.lessonType || filters.hasTrial || filters.hasPackages ||
    filters.region || filters.municipality || filters.village || filters.certifiedOnly ||
    filters.priceRange[0] > 0 || filters.priceRange[1] < 200 || search;

  const chips = [
    search && { label: `"${search}"`, clear: () => setSearch("") },
    filters.subject && { label: filters.subject, clear: () => setF("subject", "") },
    filters.city    && { label: `📍 ${filters.city}`, clear: () => setF("city", "") },
    filters.online  && { label: "🌐 ონლაინ", clear: () => setF("online", false) },
    filters.offline && { label: "🏫 პირისპირ", clear: () => setF("offline", false) },
    filters.minRating > 0 && { label: `⭐ ${filters.minRating}+`, clear: () => setF("minRating", 0) },
    filters.availDays.length > 0 && {
      label: `📅 ${filters.availDays.map(d => WEEK_LABELS[d]).join(", ")}`,
      clear: () => setF("availDays", []),
    },
    filters.availAfter && { label: `⏰ ${filters.availAfter}+`, clear: () => setF("availAfter", "") },
    filters.lessonType === "individual" && { label: "👤 ინდ.", clear: () => setF("lessonType", "") },
    filters.lessonType === "group"      && { label: "👥 ჯგუფ.", clear: () => setF("lessonType", "") },
    filters.hasTrial     && { label: "🆓 საცდელი",   clear: () => setF("hasTrial", false) },
    filters.hasPackages  && { label: "🔄 პაკეტები", clear: () => setF("hasPackages", false) },
    filters.certifiedOnly && { label: "👑 ლიცენზ.",  clear: () => setF("certifiedOnly", false) },
    filters.region && {
      label: `📍 ${REGIONS.find(r=>r.id===filters.region)?.name || filters.region}`,
      clear: () => { setF("region",""); setF("municipality",""); setF("village",""); }
    },
    filters.municipality && { label: `🏘 ${filters.municipality}`, clear: () => { setF("municipality",""); setF("village",""); } },
    filters.village && { label: `🏡 ${filters.village}`, clear: () => { setF("village",""); } },
    filters.minExperience > 0 && { label: `${filters.minExperience}+ წელი`, clear: () => setF("minExperience", 0) },
    (filters.priceRange[0] > 0 || filters.priceRange[1] < 200) && {
      label: `${filters.priceRange[0]}–${filters.priceRange[1]} ₾`,
      clear: () => setF("priceRange", [0,200]),
    },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* ── Sticky search bar ── */}
      <div className="bg-white border-b border-gray-100 py-3 sticky top-16 z-40 shadow-sm">
        <div className="page-container">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white min-w-[200px] focus-within:border-emerald-400 transition-colors">
              <span className="pl-4 flex items-center text-gray-400">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent placeholder-gray-400"
                placeholder="სახელი, საგანი, ბიო..." />
              {search && (
                <button onClick={() => setSearch("")}
                  className="px-3 text-gray-300 hover:text-gray-500">✕</button>
              )}
            </div>
            <button onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-emerald-400 transition-all">
              ⚙️ ფილტრები
              {chips.length > 0 && (
                <span className="bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {chips.length}
                </span>
              )}
            </button>
          </div>
          {chips.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2.5">
              {chips.map(f => (
                <button key={f.label} onClick={f.clear}
                  className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full hover:bg-emerald-100 transition-all font-medium">
                  {f.label} <span className="text-emerald-400 ml-0.5">✕</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Filters Drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-lg">🎯 ძებნის ფილტრები</h3>
              <button onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
            </div>
            <FiltersPanel
              filters={filters} setF={setF} geoLoading={geoLoading} handleNearMe={handleNearMe}
              filtered={filtered} toggleDay={toggleDay} hasActive={hasActive} clearAll={clearAll}
            />
            <button onClick={() => setMobileOpen(false)} className="w-full mt-6 btn-primary py-3 text-base">
              {filtered.length} მასწავლებლის ჩვენება
            </button>
          </div>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="page-container py-6 grid md:grid-cols-[280px_1fr] gap-6 items-start">

        {/* Desktop sidebar */}
        <aside className="hidden md:block card p-5 sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-base">
            🎯 ძებნის ფილტრები
          </h2>
          <FiltersPanel
            filters={filters} setF={setF} geoLoading={geoLoading} handleNearMe={handleNearMe}
            filtered={filtered} toggleDay={toggleDay} hasActive={hasActive} clearAll={clearAll}
          />
        </aside>

        {/* Tutor list / map */}
        <div>
          <div className="flex justify-between items-center mb-4 gap-2">
            <p className="text-sm text-gray-500 shrink-0">
              {loading
                ? "იტვირთება..."
                : <><span className="font-bold text-gray-900">{filtered.length}</span> მასწავლებელი</>}
            </p>
            <div className="flex items-center gap-2">
              {/* List / Map toggle */}
              <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-emerald-600 text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}>
                  ☰ სია
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "map"
                      ? "bg-emerald-600 text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}>
                  🗺 რუკა
                </button>
              </div>
              {viewMode === "list" && (
                <select value={sort} onChange={e => setSort(e.target.value)}
                  className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white outline-none focus:border-emerald-400 text-gray-600">
                  <option value="rating">⭐ რეიტინგით</option>
                  <option value="reviews">💬 შეფასებათა რაოდ.</option>
                  <option value="price_asc">💸 ფასი: იაფიდან</option>
                  <option value="price_desc">💸 ფასი: ძვირიდან</option>
                </select>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">🔍</p>
              <p className="font-bold text-gray-700 text-lg">მასწავლებელი ვერ მოიძებნა</p>
              <p className="text-sm text-gray-400 mt-1 mb-6">
                სცადეთ ფილტრების შეცვლა ან ძიების გასუფთავება
              </p>
              <button onClick={clearAll} className="btn-primary px-6 py-2.5">
                ყველა ფილტრის გასუფთავება
              </button>
            </div>
          ) : viewMode === "map" ? (
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <TutorMap
                height="600px"
                tutors={filtered.map(t => {
                  const coords = getTutorCoords(t);
                  return {
                    id:            t.id,
                    name:          t.profiles?.full_name || "მასწავლებელი",
                    subject:       t.subject || [],
                    price_per_hour: t.price_per_hour,
                    rating:        t.rating,
                    review_count:  t.review_count,
                    is_verified:   t.is_verified,
                    city:          t.city,
                    avatar_url:    t.profiles?.avatar_url || null,
                    lat:           t.exact_lat  ?? coords?.lat  ?? null,
                    lng:           t.exact_lng  ?? coords?.lng  ?? null,
                  };
                })}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((t, i) => (
                <TutorListCard key={t.id} tutor={t} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
