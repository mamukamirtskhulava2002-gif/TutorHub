"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { REGIONS, getMunicipalitiesByRegion } from "@/lib/geo-data";
import TutorCertificationModal from "@/components/TutorCertificationModal";

// ─── Constants ───────────────────────────────────────────────
const SUBJECTS = [
  // სკოლა
  "მათემატიკა","ფიზიკა","ქიმია","ბიოლოგია","გეოგრაფია","ისტორია",
  "ქართული ენა და ლიტერატურა","სამოქალაქო განათლება","ინფორმატიკა",
  // უცხო ენები
  "ინგლისური ენა","გერმანული ენა","ფრანგული ენა","ესპანური ენა",
  "ჩინური ენა","იაპონური ენა","არაბული ენა","რუსული ენა",
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

const LEVELS = [
  { id: "preschool",  label: "სკოლამდელი" },
  { id: "primary",    label: "დაწყებითი (I–VI)" },
  { id: "middle",     label: "საბაზო (VII–IX)" },
  { id: "high",       label: "საშუალო (X–XII)" },
  { id: "university", label: "სტუდენტი" },
  { id: "adult",      label: "მოზრდილი / პროფ." },
];

const LANGS = [
  { id: "ka", label: "🇬🇪 ქართ." },
  { id: "en", label: "🇬🇧 ინგლ." },
  { id: "ru", label: "🇷🇺 რუს." },
  { id: "de", label: "🇩🇪 გერმ." },
  { id: "fr", label: "🇫🇷 ფრანგ." },
];

const WEEKDAYS = [
  { key: "mon", label: "ორშ" },
  { key: "tue", label: "სამ" },
  { key: "wed", label: "ოთხ" },
  { key: "thu", label: "ხუთ" },
  { key: "fri", label: "პარ" },
  { key: "sat", label: "შაბ" },
  { key: "sun", label: "კვი" },
];

const TIMES = Array.from({ length: 29 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const TOTAL = 4;

// ─── Toggle helper ───────────────────────────────────────────
function toggle(arr, item) {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}

// ─── Pill button ─────────────────────────────────────────────
function Pill({ active, onClick, children, color = "emerald" }) {
  const on  = color === "emerald" ? "bg-emerald-600 text-white border-emerald-600"
            : color === "blue"    ? "bg-blue-600 text-white border-blue-600"
            :                       "bg-amber-500 text-white border-amber-500";
  const off = color === "emerald" ? "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
            : color === "blue"    ? "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
            :                       "bg-white text-gray-600 border-gray-200 hover:border-amber-400";
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${active ? on : off}`}>
      {children}
    </button>
  );
}

// ─── Toggle switch ───────────────────────────────────────────
function Switch({ on, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? "bg-emerald-500" : "bg-gray-300"}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 1 — Personal Branding
// ─────────────────────────────────────────────────────────────
function Step1({ data, onChange }) {
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    onChange({ ...data, photoFile: file, photo_preview: URL.createObjectURL(file) });
  }

  return (
    <div className="space-y-6">
      {/* Photo */}
      <div className="flex flex-col items-center gap-2">
        <div
          onClick={() => fileRef.current?.click()}
          className="w-28 h-28 rounded-full bg-emerald-50 flex items-center justify-center cursor-pointer border-2 border-dashed border-emerald-400 overflow-hidden relative group"
        >
          {data.photo_preview
            ? <img src={data.photo_preview} className="w-full h-full object-cover" alt="avatar" />
            : <span className="text-4xl">📷</span>}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            <span className="text-white text-xs font-bold">შეცვლა</span>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <p className="text-xs text-gray-400">ფოტო სავალდებულოა (JPG / PNG)</p>
      </div>

      {/* Full name (editable) */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          სახელი და გვარი <span className="text-red-400">*</span>
        </label>
        <input
          value={data.full_name}
          onChange={e => onChange({ ...data, full_name: e.target.value })}
          placeholder="მაგ: ანა გელაშვილი"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          ტეგლაინი <span className="text-red-400">*</span>
          <span className="ml-2 text-gray-400 font-normal text-xs">(max 70 სიმბ.)</span>
        </label>
        <input
          value={data.tagline}
          maxLength={70}
          onChange={e => onChange({ ...data, tagline: e.target.value })}
          placeholder="მაგ: 7+ წლის გამოცდილება. ინდ. მიდგომა. შედეგი — 100%."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <p className="text-xs text-right text-gray-400 mt-1">{data.tagline.length}/70</p>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">ბიოგრაფია / აღწერა</label>
        <textarea
          value={data.bio}
          rows={4}
          onChange={e => onChange({ ...data, bio: e.target.value })}
          placeholder="გაგვიზიარეთ გამოცდილება, სწავლების მეთოდი, წარმატებები..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      {/* Experience */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">სასწავლო გამოცდილება (წლები)</label>
        <input
          type="number" min={0} max={50}
          value={data.experience_years || ""}
          onChange={e => onChange({ ...data, experience_years: Math.max(0, Number(e.target.value)) })}
          placeholder="0"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Searchable multi-select for subjects
// ─────────────────────────────────────────────────────────────
function SubjectMultiSelect({ selected, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref      = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = SUBJECTS.filter(
    s => !selected.includes(s) && s.toLowerCase().includes(query.toLowerCase())
  );

  function add(s) {
    onChange([...selected, s]);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function remove(s) {
    onChange(selected.filter(x => x !== s));
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selected.map(s => (
            <span key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-full">
              {s}
              <button type="button" onClick={() => remove(s)}
                className="text-white/70 hover:text-white leading-none ml-0.5">✕</button>
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          placeholder="საგნის ძებნა და დამატება..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 placeholder-gray-400"
        />
        {open && filtered.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="max-h-52 overflow-y-auto">
              {filtered.map(s => (
                <button key={s} type="button"
                  onMouseDown={e => { e.preventDefault(); add(s); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {open && filtered.length === 0 && query && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-4 py-3 text-sm text-gray-400">
            არ მოიძებნა
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2 — Subject Specialization
// ─────────────────────────────────────────────────────────────
function Step2({ data, onChange }) {
  return (
    <div className="space-y-7">
      {/* Subjects */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          საგნები <span className="text-red-400">*</span>
          <span className="ml-2 text-gray-400 font-normal text-xs">(min 1)</span>
        </label>
        <SubjectMultiSelect
          selected={data.subject || []}
          onChange={v => onChange({ ...data, subject: v })}
        />
      </div>

      {/* Target levels */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          სამიზნე აუდიტორია <span className="text-red-400">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map(l => (
            <Pill key={l.id} active={(data.target_levels || []).includes(l.id)} color="blue"
              onClick={() => onChange({ ...data, target_levels: toggle(data.target_levels || [], l.id) })}>
              {l.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* Teaching languages */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">სწავლების ენა</label>
        <div className="flex flex-wrap gap-2">
          {LANGS.map(l => (
            <Pill key={l.id} active={(data.teaching_languages || []).includes(l.id)} color="amber"
              onClick={() => onChange({ ...data, teaching_languages: toggle(data.teaching_languages || [], l.id) })}>
              {l.label}
            </Pill>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 3 — Format & Geography
// ─────────────────────────────────────────────────────────────
function Step3({ data, onChange }) {
  const muns = data.region_id ? getMunicipalitiesByRegion(data.region_id) : [];
  const villages = data.municipality_id
    ? [...new Set(REGIONS.flatMap(r => r.municipalities).find(m => m.id === data.municipality_id)?.villages || [])]
    : [];

  function setFormat(fmt) {
    onChange({
      ...data,
      format: fmt,
      is_online:  fmt === "online"  || fmt === "both",
      is_offline: fmt === "offline" || fmt === "both",
    });
  }

  const fmt = data.format;
  const needsGeo = fmt === "offline" || fmt === "both";

  return (
    <div className="space-y-6">
      {/* Format */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          სწავლების ფორმატი <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-3">
          {[
            { id: "online",  label: "🌐 ონლაინ" },
            { id: "offline", label: "🏫 პირისპირ" },
            { id: "both",    label: "🔀 ორივე" },
          ].map(f => (
            <button key={f.id} type="button" onClick={() => setFormat(f.id)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                fmt === f.id
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
              }`}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Geography (shown only if offline involved) */}
      {needsGeo && (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-4">
          <p className="text-sm font-semibold text-gray-700">📍 პირისპირ სასწავლო მდებარეობა</p>

          {/* Region */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              რეგიონი <span className="text-red-400">*</span>
            </label>
            <select
              value={data.region_id}
              onChange={e => onChange({ ...data, region_id: e.target.value, municipality_id: "", village: "" })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">— რეგიონი —</option>
              {REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {/* Municipality */}
          {muns.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">მუნიციპალიტეტი</label>
              <select
                value={data.municipality_id}
                onChange={e => onChange({ ...data, municipality_id: e.target.value, village: "" })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">— მუნიციპ. —</option>
                {muns.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          {/* Village / neighbourhood */}
          {villages.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">სოფელი / უბანი</label>
              <select
                value={data.village}
                onChange={e => onChange({ ...data, village: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">— სოფელი / უბანი —</option>
                {villages.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          {/* Location rule */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">ვინ მიდის ვისთან?</p>
            <div className="space-y-2">
              {[
                { id: "tutor_goes",    label: "🚗 მე მივდივარ მოსწავლესთან" },
                { id: "student_comes", label: "🏠 მოსწავლე მოდის ჩემთან" },
                { id: "both_ways",     label: "🔀 ორივე ვარიანტი" },
              ].map(r => (
                <label key={r.id}
                  className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-gray-100 transition-colors">
                  <input type="radio" name="loc_rule" value={r.id}
                    checked={data.location_rule === r.id}
                    onChange={() => onChange({ ...data, location_rule: r.id })}
                    className="accent-emerald-600 w-4 h-4" />
                  <span className="text-sm text-gray-700">{r.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 4 — Pricing
// ─────────────────────────────────────────────────────────────
function Step4({ data, onChange }) {
  return (
    <div className="space-y-6">
      {/* Hourly rate */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          საათობრივი ტარიფი (₾) <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type="number" min={0} step={5}
            value={data.price_per_hour || ""}
            onChange={e => onChange({ ...data, price_per_hour: Number(e.target.value) })}
            placeholder="0"
            className="w-full border border-gray-200 rounded-xl pl-4 pr-14 py-3.5 text-2xl font-black focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">₾</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">საშ. ფასი GeorgiaHub-ზე: 30–60 ₾/სთ</p>
      </div>

      {/* Trial lesson */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-sm font-semibold text-gray-700">🆓 საცდელი გაკვეთილი</p>
            <p className="text-xs text-gray-400">პირველი გაკვეთილი შეღავათიანი ფასით</p>
          </div>
          <Switch on={data.trial_enabled} onToggle={() => onChange({ ...data, trial_enabled: !data.trial_enabled })} />
        </div>
        {data.trial_enabled && (
          <div className="mt-4">
            <label className="block text-xs text-gray-500 font-medium mb-1">
              საცდელი ფასი (₾) — 0 = უფასო
              <span className="ml-2 text-amber-500 font-bold">მაქს. 10 ₾</span>
            </label>
            <div className="relative">
              <input
                type="number" min={0} max={10} step={1}
                value={data.trial_price || ""}
                onChange={e => {
                  const v = Math.min(10, Math.max(0, Number(e.target.value)));
                  onChange({ ...data, trial_price: v });
                }}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₾</span>
            </div>
            {Number(data.trial_price) > 10 && (
              <p className="text-xs text-red-500 mt-1">⚠️ მაქსიმუმი 10 ₾</p>
            )}
          </div>
        )}
      </div>

      {/* Packages */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">🔄 გრძელვადიანი პაკეტი</p>
            <p className="text-xs text-gray-400">10+ გაკვეთილი — სპეციალური ფასები</p>
          </div>
          <Switch on={data.accepts_packages} onToggle={() => onChange({ ...data, accepts_packages: !data.accepts_packages })} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 5 — Schedule Template
// ─────────────────────────────────────────────────────────────
function Step5({ data, onChange }) {
  const schedule = data.schedule || {};

  function toggleDay(key) {
    if (schedule[key]) {
      const next = { ...schedule };
      delete next[key];
      onChange({ ...data, schedule: next });
    } else {
      onChange({ ...data, schedule: { ...schedule, [key]: [{ start: "09:00", end: "17:00" }] } });
    }
  }

  function addSlot(key) {
    const slots = schedule[key] || [];
    onChange({ ...data, schedule: { ...schedule, [key]: [...slots, { start: "09:00", end: "17:00" }] } });
  }

  function removeSlot(key, idx) {
    const slots = (schedule[key] || []).filter((_, i) => i !== idx);
    if (!slots.length) {
      const next = { ...schedule };
      delete next[key];
      onChange({ ...data, schedule: next });
    } else {
      onChange({ ...data, schedule: { ...schedule, [key]: slots } });
    }
  }

  function updateSlot(key, idx, field, val) {
    const slots = (schedule[key] || []).map((s, i) => i === idx ? { ...s, [field]: val } : s);
    onChange({ ...data, schedule: { ...schedule, [key]: slots } });
  }

  const activeDays = WEEKDAYS.filter(d => schedule[d.key]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">გამოარჩიეთ სამუშაო დღეები და დაამატეთ დრო</p>

      {/* Day toggles */}
      <div className="flex gap-2 flex-wrap">
        {WEEKDAYS.map(d => (
          <Pill key={d.key} active={!!schedule[d.key]} onClick={() => toggleDay(d.key)}>
            {d.label}
          </Pill>
        ))}
      </div>

      {/* Time slots per active day */}
      {activeDays.length === 0 && (
        <p className="text-sm text-center text-gray-400 py-8">☝️ გამოარჩიეთ სამუშაო დღე</p>
      )}

      <div className="space-y-3">
        {activeDays.map(d => (
          <div key={d.key} className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-800">{d.label}</p>
              <button type="button" onClick={() => addSlot(d.key)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors">
                + დამატება
              </button>
            </div>
            <div className="space-y-2">
              {(schedule[d.key] || []).map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={slot.start}
                    onChange={e => updateSlot(d.key, idx, "start", e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-gray-400 text-xs font-medium">—</span>
                  <select
                    value={slot.end}
                    onChange={e => updateSlot(d.key, idx, "end", e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button type="button" onClick={() => removeSlot(d.key, idx)}
                    className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeDays.length > 0 && (
        <p className="text-xs text-center text-gray-400">
          ✅ {activeDays.length} სამუშაო დღე დაყენებულია
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Done screen
// ─────────────────────────────────────────────────────────────
function DoneScreen({ onDashboard, certDone }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <span className="text-5xl">🎉</span>
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">პროფილი შეიქმნა!</h2>
        {certDone ? (
          <>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              შენი დოკუმენტი ადმინისტრაციას გადაეგზავნა. 1–3 სამუშაო დღეში მოგივა
              <strong className="text-gray-700"> შეტყობინება</strong> შედეგზე.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-left">
              <p className="text-xs text-amber-700 font-medium">⏳ ძებნაში გამოჩნდებით ვერიფიკაციის შემდეგ</p>
              <p className="text-xs text-amber-600 mt-1">ამ დროის განმავლობაში შეგიძლიათ პარამეტრები შეცვალოთ.</p>
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            გთხოვ შეავსო სერტიფიკაციის ველი რომელიც გამოჩნდება...
          </p>
        )}
        {certDone && (
          <button
            onClick={onDashboard}
            className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm"
          >
            დასბოარდზე გადასვლა →
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────────────────────
export default function TutorOnboarding() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep]     = useState(1);
  const [saving, setSaving] = useState(false);
  const [done,  setDone]    = useState(false);
  const [certDone, setCertDone] = useState(false);
  const [error, setError]   = useState("");
  const [userId, setUserId] = useState(null);

  const [data, setData] = useState({
    full_name:          "",
    tagline:            "",
    bio:                "",
    experience_years:   0,
    photo_preview:      null,
    photoFile:          null,
    subject:            [],
    target_levels:      [],
    teaching_languages: ["ka"],
    format:             "",
    is_online:          false,
    is_offline:         false,
    region_id:          "",
    municipality_id:    "",
    village:            "",
    location_rule:      "",
    price_per_hour:     "",
    trial_enabled:      false,
    trial_price:        0,
    accepts_packages:   false,
    schedule:           {},
  });

  // Initialise
  useEffect(() => {
    let active = true;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) { router.replace("/auth"); return; }
      const user = session.user;

      // Already onboarded → redirect to dashboard
      const { data: tutor } = await supabase
        .from("tutors")
        .select("onboarding_completed, bio, photo_url, price_per_hour, subject")
        .eq("id", user.id)
        .single();
      if (!active) return;
      if (tutor?.onboarding_completed) { router.replace("/dashboard/tutor"); return; }
      setUserId(user.id);

      // Pre-fill from existing tutor row (draft recovery)
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setData(prev => ({
        ...prev,
        full_name:      profile?.full_name || "",
        bio:            tutor?.bio || "",
        photo_preview:  tutor?.photo_url || null,
        price_per_hour: tutor?.price_per_hour || "",
        subject:        Array.isArray(tutor?.subject) ? tutor.subject : [],
      }));
    }
    init();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft (fire-and-forget, debounced 1.5 s)
  const draftTimer = useRef(null);
  function handleChange(newData) {
    setData(newData);
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => saveDraft(newData), 1500);
  }

  async function saveDraft(d) {
    if (!userId) return;
    const mun = REGIONS.flatMap(r => r.municipalities).find(m => m.id === d.municipality_id);
    supabase.from("tutors").upsert({
      id:              userId,
      bio:             d.bio || null,
      experience_years: d.experience_years || 0,
      subject:         d.subject,
      is_online:       d.is_online,
      is_offline:      d.is_offline,
      price_per_hour:  d.price_per_hour || null,
      trial_price:     d.trial_enabled ? (d.trial_price || 0) : null,
      accepts_packages: d.accepts_packages,
      city:            mun?.name || d.village || "",
      is_verified:     false,
    }).then(() => {});
  }

  // Validation per step
  function validate() {
    if (step === 1) {
      if (!data.full_name.trim())              return "სახელი და გვარი სავალდებულოა";
      if (!data.tagline.trim())                return "ტეგლაინი სავალდებულოა";
      if (!data.photo_preview && !data.photoFile) return "ფოტო სავალდებულოა";
    }
    if (step === 2) {
      if (!data.subject.length)       return "მინიმუმ ერთი საგანი სავალდებულოა";
      if (!data.target_levels.length) return "სამიზნე აუდიტორია სავალდებულოა";
    }
    if (step === 3) {
      if (!data.format) return "სწავლების ფორმატი სავალდებულოა";
      if ((data.format === "offline" || data.format === "both") && !data.region_id)
        return "პირისპირ სწავლისთვის რეგიონი სავალდებულოა";
    }
    if (step === 4) {
      if (!data.price_per_hour || Number(data.price_per_hour) <= 0)
        return "საათობრივი ფასი სავალდებულოა";
      if (data.trial_enabled && Number(data.trial_price) > 10)
        return "საცდელი გაკვეთილის ფასი მაქსიმუმ 10 ₾ შეიძლება იყოს";
    }
    return null;
  }

  async function uploadPhoto() {
    if (!data.photoFile) return data.photo_preview;
    const ext  = data.photoFile.name.split(".").pop();
    const path = `avatars/${userId}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, data.photoFile, { upsert: true });
    if (error) throw new Error("ფოტოს ატვირთვა ვერ მოხდა: " + error.message);
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  async function handleNext() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");

    if (step < TOTAL) {
      setStep(s => s + 1);
      return;
    }

    // Final submission
    setSaving(true);
    clearTimeout(draftTimer.current); // pending draft-ი გავაუქმოთ
    try {
      const photoUrl = await uploadPhoto();
      const mun = REGIONS.flatMap(r => r.municipalities).find(m => m.id === data.municipality_id);
      const fullName = data.full_name.trim();

      // Core tutors columns
      const { error: tutorErr } = await supabase.from("tutors").upsert({
        id:              userId,
        photo_url:       photoUrl,
        bio:             data.bio || null,
        experience_years: data.experience_years || 0,
        subject:         data.subject,
        is_online:       data.is_online,
        is_offline:      data.is_offline,
        price_per_hour:  data.price_per_hour,
        trial_price:     data.trial_enabled ? (data.trial_price || 0) : null,
        accepts_packages: data.accepts_packages,
        city:            mun?.name || data.village || "",
        is_verified:     false,
        onboarding_completed: true,
      });
      if (tutorErr) throw new Error("tutors: " + tutorErr.message);

      // profiles.onboarding_completed — auth callback ამ ველს ამოწმებს
      const { error: profErr } = await supabase.from("profiles").update({
        onboarding_completed: true,
        full_name:            fullName,
        ...(photoUrl ? { avatar_url: photoUrl } : {}),
      }).eq("id", userId);
      if (profErr) throw new Error("profiles: " + profErr.message);

      // Extended columns (fire-and-forget)
      supabase.from("tutors").update({
        tagline:            data.tagline,
        target_levels:      data.target_levels,
        teaching_languages: data.teaching_languages,
        region_id:          data.region_id || null,
        municipality_id:    data.municipality_id || null,
        village:            data.village || null,
        location_rule:      data.location_rule || null,
      }).eq("id", userId).then(() => {});

      setDone(true);
    } catch (e) {
      setError(e.message || "შეცდომა. სცადეთ ხელახლა.");
    } finally {
      setSaving(false);
    }
  }

  const STEP_LABELS = ["პირადი ბრენდი", "საგნები", "ფორმატი", "ფასი"];

  if (done) {
    return (
      <>
        <DoneScreen onDashboard={() => router.replace("/dashboard/tutor")} certDone={certDone} />
        {!certDone && userId && (
          <TutorCertificationModal
            userId={userId}
            onClose={() => setCertDone(true)}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Sticky header with progress ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={() => { setStep(s => s - 1); setError(""); }}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            >←</button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-500 truncate">
                {step}/{TOTAL} — {STEP_LABELS[step - 1]}
              </p>
              <span className="text-xs text-gray-400 ml-2">{Math.round((step / TOTAL) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${(step / TOTAL) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-36">
        <div className="max-w-lg mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-gray-900 leading-tight">
              {step === 1 && "გაგვიყევი შენი ამბავი 👋"}
              {step === 2 && "რას ასწავლი?"}
              {step === 3 && "სად და როგორ ასწავლი?"}
              {step === 4 && "შეაფასე შენი სამსახური"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {step === 1 && "პირველი შთაბეჭდილება ყველაზე მნიშვნელოვანია"}
              {step === 2 && "კონკრეტული საგნები მეტ მოსწავლეს მოიზიდავს"}
              {step === 3 && "ზუსტი ადგილი = სწორი მოსწავლე"}
              {step === 4 && "გამჭვირვალე ფასი აყალიბებს ნდობას"}
            </p>
          </div>

          {step === 1 && <Step1 data={data} onChange={handleChange} />}
          {step === 2 && <Step2 data={data} onChange={handleChange} />}
          {step === 3 && <Step3 data={data} onChange={handleChange} />}
          {step === 4 && <Step4 data={data} onChange={handleChange} />}
        </div>
      </div>

      {/* ── Fixed footer ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-20">
        <div className="max-w-lg mx-auto">
          {error && (
            <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
              <span className="flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => { setStep(s => s - 1); setError(""); }}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >← უკან</button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="flex-1 bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm shadow-sm"
            >
              {saving ? "ინახება..." : step === TOTAL ? "🚀 პროფილის გამოქვეყნება" : "შემდეგი →"}
            </button>
          </div>
          {step < TOTAL && (
            <p className="text-center text-xs text-gray-400 mt-2">🔒 ავტომატური შენახვა მუშაობს</p>
          )}
        </div>
      </div>
    </div>
  );
}
