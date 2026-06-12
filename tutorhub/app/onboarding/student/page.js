"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { REGIONS, getMunicipalitiesByRegion } from "@/lib/geo-data";

// ─── Constants ────────────────────────────────────────────────
const LEVELS = [
  { id: "school",      icon: "🎒", label: "სკოლის მოსწავლე",  desc: "I–XII კლასი" },
  { id: "applicant",   icon: "📝", label: "აბიტურიენტი",       desc: "გამოცდებს ვემზადები" },
  { id: "university",  icon: "🎓", label: "სტუდენტი",          desc: "უმაღლესი სასწავლებელი" },
  { id: "adult",       icon: "💼", label: "ზრდასრული",         desc: "პროფ. განვითარება" },
];

const GRADES = [1,2,3,4,5,6,7,8,9,10,11,12];

const SUBJECTS = [
  { id: "მათემატიკა",  icon: "📐" },
  { id: "ფიზიკა",     icon: "⚛️" },
  { id: "ქიმია",      icon: "🧪" },
  { id: "ბიოლოგია",   icon: "🌿" },
  { id: "ქართული",    icon: "📖" },
  { id: "ინგლისური",  icon: "🇬🇧" },
  { id: "ისტორია",    icon: "🏛️" },
  { id: "პროგრამ.",   icon: "💻" },
  { id: "გეოგრაფია",  icon: "🌍" },
  { id: "ეკონომიკა",  icon: "📈" },
  { id: "გერმანული",  icon: "🇩🇪" },
  { id: "რუსული",     icon: "🇷🇺" },
  { id: "ფრანგული",   icon: "🇫🇷" },
  { id: "მუსიკა",     icon: "🎵" },
  { id: "ხელოვნება",  icon: "🎨" },
  { id: "სპორტი",     icon: "⚽" },
];

const FORMATS = [
  { id: "online",  icon: "🌐", label: "ონლაინ",   desc: "Google Meet / Zoom" },
  { id: "offline", icon: "🏠", label: "პირისპირ",  desc: "ჩემი ან მასწ. ადგილი" },
  { id: "both",    icon: "🌓", label: "ორივე",     desc: "მიწყობს ხელს" },
];

const WEEKDAYS = [
  { key: "mon", short: "ო", full: "ორშ" },
  { key: "tue", short: "ს", full: "სამ" },
  { key: "wed", short: "ო", full: "ოთხ" },
  { key: "thu", short: "ხ", full: "ხუთ" },
  { key: "fri", short: "პ", full: "პარ" },
  { key: "sat", short: "შ", full: "შაბ" },
  { key: "sun", short: "კ", full: "კვი" },
];

const TIMES = [
  { id: "morning",   icon: "☀️",  label: "დილა",    range: "09:00 – 12:00" },
  { id: "afternoon", icon: "🌤️", label: "შუადღე",   range: "12:00 – 17:00" },
  { id: "evening",   icon: "🌙",  label: "საღამო",   range: "17:00 – 21:00" },
];

const TOTAL_STEPS = 3; // step 4 is conditional

// ─── Pill toggle button ───────────────────────────────────────
function Pill({ active, onClick, children, size = "md" }) {
  const sz = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button type="button" onClick={onClick}
      className={`${sz} rounded-full font-semibold border-2 transition-all ${
        active
          ? "bg-emerald-600 text-white border-emerald-600"
          : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
      }`}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 1 — Level + Grade + Subjects
// ─────────────────────────────────────────────────────────────
function Step1({ data, onChange }) {
  function toggleSubject(s) {
    const current = data.preferred_subjects || [];
    onChange({
      ...data,
      preferred_subjects: current.includes(s) ? current.filter(x => x !== s) : [...current, s],
    });
  }

  return (
    <div className="space-y-7">
      {/* Level selector */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-3">ვინ ხარ? <span className="text-red-400">*</span></p>
        <div className="grid grid-cols-2 gap-3">
          {LEVELS.map(l => (
            <button key={l.id} type="button"
              onClick={() => onChange({ ...data, student_level: l.id, student_grade: l.id !== "school" ? null : data.student_grade })}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                data.student_level === l.id
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-emerald-300"
              }`}>
              <span className="text-2xl block mb-1">{l.icon}</span>
              <p className={`font-bold text-sm ${data.student_level === l.id ? "text-emerald-700" : "text-gray-800"}`}>
                {l.label}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{l.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Grade picker (only for school) */}
      {data.student_level === "school" && (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-3">კლასი <span className="text-red-400">*</span></p>
          <div className="flex flex-wrap gap-2">
            {GRADES.map(g => (
              <button key={g} type="button"
                onClick={() => onChange({ ...data, student_grade: g })}
                className={`w-10 h-10 rounded-xl font-bold text-sm border-2 transition-all ${
                  data.student_grade === g
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
                }`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subjects */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-1">
          რომელ საგნებს ეძებ? <span className="text-red-400">*</span>
        </p>
        <p className="text-xs text-gray-400 mb-3">მონიშნე ყველა, რაც გჭირდება</p>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map(s => {
            const active = (data.preferred_subjects || []).includes(s.id);
            return (
              <button key={s.id} type="button" onClick={() => toggleSubject(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                  active
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
                }`}>
                <span className="text-base leading-none">{s.icon}</span>
                {s.id}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2 — Format + Location
// ─────────────────────────────────────────────────────────────
function Step2({ data, onChange }) {
  const muns = data.region_id ? getMunicipalitiesByRegion(data.region_id) : [];
  const villages = data.municipality_id
    ? REGIONS.flatMap(r => r.municipalities).find(m => m.id === data.municipality_id)?.villages || []
    : [];

  const needsLocation = data.preferred_format === "offline" || data.preferred_format === "both";

  return (
    <div className="space-y-6">
      {/* Format */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-3">სად გინდა სწავლა? <span className="text-red-400">*</span></p>
        <div className="flex flex-col gap-3">
          {FORMATS.map(f => (
            <button key={f.id} type="button"
              onClick={() => onChange({ ...data, preferred_format: f.id })}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                data.preferred_format === f.id
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-emerald-300"
              }`}>
              <span className="text-3xl leading-none">{f.icon}</span>
              <div>
                <p className={`font-bold text-sm ${data.preferred_format === f.id ? "text-emerald-700" : "text-gray-800"}`}>
                  {f.label}
                </p>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
              {data.preferred_format === f.id && (
                <span className="ml-auto text-emerald-600 font-bold">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Location cascade */}
      {needsLocation && (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-4">
          <p className="text-sm font-bold text-gray-700">📍 სად ხარ?</p>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              რეგიონი <span className="text-red-400">*</span>
            </label>
            <select
              value={data.region_id || ""}
              onChange={e => onChange({ ...data, region_id: e.target.value, municipality_id: "", village: "" })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">— რეგიონი —</option>
              {REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {muns.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">მუნიციპალიტეტი</label>
              <select
                value={data.municipality_id || ""}
                onChange={e => onChange({ ...data, municipality_id: e.target.value, village: "" })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">— მუნიციპ. —</option>
                {muns.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          {villages.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">სოფელი / უბანი</label>
              <select
                value={data.village || ""}
                onChange={e => onChange({ ...data, village: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">— სოფელი / უბანი —</option>
                {villages.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 3 — Free time
// ─────────────────────────────────────────────────────────────
function Step3({ data, onChange }) {
  function toggleDay(key) {
    const current = data.preferred_days || [];
    onChange({
      ...data,
      preferred_days: current.includes(key) ? current.filter(x => x !== key) : [...current, key],
    });
  }

  function setPreset(preset) {
    if (preset === "weekdays") onChange({ ...data, preferred_days: ["mon","tue","wed","thu","fri"] });
    if (preset === "weekends") onChange({ ...data, preferred_days: ["sat","sun"] });
    if (preset === "all")      onChange({ ...data, preferred_days: ["mon","tue","wed","thu","fri","sat","sun"] });
  }

  function toggleTime(id) {
    const current = data.preferred_times || [];
    onChange({
      ...data,
      preferred_times: current.includes(id) ? current.filter(x => x !== id) : [...current, id],
    });
  }

  const days = data.preferred_days || [];
  const times = data.preferred_times || [];

  const activePreset =
    days.length === 5 && !days.includes("sat") && !days.includes("sun") ? "weekdays" :
    days.length === 2 && days.includes("sat") && days.includes("sun") ? "weekends" :
    days.length === 7 ? "all" : null;

  return (
    <div className="space-y-7">
      {/* Days */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-3">
          რომელ დღეებში ხარ თავისუფალი? <span className="text-red-400">*</span>
        </p>

        {/* Quick presets */}
        <div className="flex gap-2 mb-3">
          {[
            ["weekdays", "სამ. დღეები"],
            ["weekends", "შაბ–კვი"],
            ["all",      "ყოველდღე"],
          ].map(([preset, label]) => (
            <button key={preset} type="button" onClick={() => setPreset(preset)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                activePreset === preset
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-emerald-400"
              }`}>{label}</button>
          ))}
        </div>

        {/* Day pills */}
        <div className="flex gap-2">
          {WEEKDAYS.map(d => (
            <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
              className={`flex-1 h-11 rounded-xl font-bold text-sm border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
                days.includes(d.key)
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-emerald-400"
              }`}>
              <span className="text-xs leading-none">{d.full}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time of day */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-1">
          დღის რომელ მონაკვეთში? <span className="text-red-400">*</span>
        </p>
        <p className="text-xs text-gray-400 mb-3">შეგიძლია ყველა მონიშნო</p>
        <div className="flex flex-col gap-3">
          {TIMES.map(t => (
            <button key={t.id} type="button" onClick={() => toggleTime(t.id)}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                times.includes(t.id)
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-emerald-300"
              }`}>
              <span className="text-2xl leading-none">{t.icon}</span>
              <div className="flex-1 text-left">
                <p className={`font-bold text-sm ${times.includes(t.id) ? "text-emerald-700" : "text-gray-800"}`}>
                  {t.label}
                </p>
                <p className="text-xs text-gray-400">{t.range}</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                times.includes(t.id) ? "bg-emerald-600 border-emerald-600" : "border-gray-300"
              }`}>
                {times.includes(t.id) && <span className="text-white text-xs font-bold">✓</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 4 — Parent info (school students only)
// ─────────────────────────────────────────────────────────────
function Step4({ data, onChange }) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
        <p className="font-bold mb-1">👨‍👩‍👧 მშობლის / მეურვის ინფორმაცია</p>
        <p className="text-xs text-blue-600">
          ყოველთვიური ავტო-ჩამოჭრის ან გაკვეთილის გაუქმების შემთხვევაში
          SMS შეტყობინება მივა მშობელთან.
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          მშობლის / მეურვის სახელი
        </label>
        <input
          value={data.parent_name || ""}
          onChange={e => onChange({ ...data, parent_name: e.target.value })}
          placeholder="სახელი გვარი"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          მშობლის ტელეფონი
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">🇬🇪 +995</span>
          <input
            type="tel"
            value={data.parent_phone || ""}
            onChange={e => onChange({ ...data, parent_phone: e.target.value })}
            placeholder="5XX XXX XXX"
            className="w-full border border-gray-200 rounded-xl pl-20 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        მშობლის ინფორმაცია არჩევითია — შეგიძლია გამოტოვო
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Done screen
// ─────────────────────────────────────────────────────────────
function DoneScreen({ name, subjects, onGo }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">
          გამარჯობა, {name || "სტუდენტო"}!
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          შენი პროფილი მზადაა. მასბოარდი ახლა პერსონალიზებულია.
        </p>

        {subjects?.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {subjects.slice(0, 5).map(s => (
              <span key={s} className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6 text-left">
          <p className="text-xs font-semibold text-emerald-800 mb-1">✨ ახლა შენ გელის:</p>
          <p className="text-xs text-emerald-700">• შენთვის მორგებული მასწავლებლები</p>
          <p className="text-xs text-emerald-700">• ფილტრები ავტო-დაყენებულია</p>
          <p className="text-xs text-emerald-700">• კალენდარი შენს გრაფიკზე</p>
        </div>

        <button onClick={onGo}
          className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-colors">
          სტუდენტის დაშბორდი →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────────────────────
export default function StudentOnboarding() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep]     = useState(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState("");
  const [userId, setUserId] = useState(null);
  const [firstName, setFirstName] = useState("");

  const [data, setData] = useState({
    student_level:      "",
    student_grade:      null,
    preferred_subjects: [],
    preferred_format:   "",
    region_id:          "",
    municipality_id:    "",
    village:            "",
    preferred_days:     [],
    preferred_times:    [],
    parent_name:        "",
    parent_phone:       "",
  });

  const isSchool = data.student_level === "school";
  const totalSteps = isSchool ? 4 : 3;

  useEffect(() => {
    let active = true;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) { router.replace("/auth"); return; }
      const user = session.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (!active) return;
      setUserId(user.id);
      if (profile?.full_name) setFirstName(profile.full_name.split(" ")[0]);
    }
    init();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    if (step === 1) {
      if (!data.student_level) return "სტატუსი სავალდებულოა";
      if (data.student_level === "school" && !data.student_grade) return "კლასი სავალდებულოა";
      if (!data.preferred_subjects.length) return "მინიმუმ ერთი საგანი სავალდებულოა";
    }
    if (step === 2) {
      if (!data.preferred_format) return "ფორმატი სავალდებულოა";
      const needsGeo = data.preferred_format === "offline" || data.preferred_format === "both";
      if (needsGeo && !data.region_id) return "რეგიონი სავალდებულოა";
    }
    if (step === 3) {
      if (!data.preferred_days.length) return "მინ. ერთი დღე სავალდებულოა";
      if (!data.preferred_times.length) return "მინ. ერთი დროის მონაკვეთი სავალდებულოა";
    }
    return null;
  }

  async function saveToDb(isComplete = false) {
    if (!userId) return;
    const mun = REGIONS.flatMap(r => r.municipalities).find(m => m.id === data.municipality_id);

    // Save preference fields — may fail silently if some columns don't exist yet
    await supabase.from("profiles").update({
      student_level:      data.student_level || null,
      student_grade:      data.student_grade || null,
      preferred_subjects: data.preferred_subjects,
      preferred_format:   data.preferred_format || null,
      region_id:          data.region_id || null,
      municipality_id:    data.municipality_id || null,
      village:            data.village || null,
      preferred_days:     data.preferred_days,
      preferred_times:    data.preferred_times,
      parent_name:        data.parent_name || null,
      parent_phone:       data.parent_phone || null,
      city:               mun?.name || data.village || null,
    }).eq("id", userId);

    // Critical: mark completion separately so a missing column can't block it
    if (isComplete) {
      const { data: updated, error } = await supabase.from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId)
        .select("id");
      if (error) throw new Error(error.message);
      if (!updated?.length) {
        // Row doesn't exist — create minimal profile row first
        const { error: insertError } = await supabase.from("profiles").insert({
          id: userId,
          role: "student",
          onboarding_completed: true,
        });
        if (insertError) throw new Error(insertError.message);
      }
    }
  }

  async function handleNext() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");

    if (step < totalSteps) {
      // Auto-save progress silently
      saveToDb(false).catch(() => {});
      setStep(s => s + 1);
      return;
    }

    // Final step → save + complete
    setSaving(true);
    try {
      await saveToDb(true);
      setDone(true);
    } catch (e) {
      console.error("onboarding saveToDb error:", e);
      setError("შენახვის შეცდომა: " + (e?.message || "სცადეთ ხელახლა"));
    } finally {
      setSaving(false);
    }
  }

  function handleSkipParent() {
    setError("");
    setSaving(true);
    saveToDb(true)
      .then(() => setDone(true))
      .catch(() => setError("შეცდომა"))
      .finally(() => setSaving(false));
  }

  const STEP_LABELS = ["ვინ ხარ", "სად სწავლობ", "თავისუფ. დრო", "მშობელი"];

  if (done) {
    return (
      <DoneScreen
        name={firstName}
        subjects={data.preferred_subjects}
        onGo={() => router.replace("/dashboard/student")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={() => { setStep(s => s - 1); setError(""); }}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
                ←
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-gray-500">
                  {step}/{totalSteps} — {STEP_LABELS[step - 1]}
                </p>
                <span className="text-xs text-gray-400">{Math.round((step / totalSteps) * 100)}%</span>
              </div>
              {/* Progress dots */}
              <div className="flex gap-1.5">
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div key={i}
                    className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                      i < step ? "bg-emerald-500" : "bg-gray-200"
                    }`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-36">
        <div className="max-w-lg mx-auto">
          {/* Step title */}
          <div className="mb-6">
            <h1 className="text-2xl font-black text-gray-900 leading-tight">
              {step === 1 && "მოგვიყევი შენს შესახებ 👋"}
              {step === 2 && "სად გინდა სწავლა?"}
              {step === 3 && "როდის ხარ თავისუფალი?"}
              {step === 4 && "მშობლის ინფორმაცია"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {step === 1 && "ჩვენ ვიპოვით ზუსტ მასწავლებელს შენთვის"}
              {step === 2 && "ლოკაცია ეხმარება ახლომდებარე მასწ. პოვნაში"}
              {step === 3 && "კალენდარი შენს გრაფიკზე ავტომ. სინქრონიზდება"}
              {step === 4 && "12 წლამდე საჭიროა მშობლის ინფო — სურვილისამებრ"}
            </p>
          </div>

          {step === 1 && <Step1 data={data} onChange={setData} />}
          {step === 2 && <Step2 data={data} onChange={setData} />}
          {step === 3 && <Step3 data={data} onChange={setData} />}
          {step === 4 && <Step4 data={data} onChange={setData} />}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-20">
        <div className="max-w-lg mx-auto">
          {error && (
            <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            {step > 1 && (
              <button onClick={() => { setStep(s => s - 1); setError(""); }}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                ← უკან
              </button>
            )}
            <button onClick={handleNext} disabled={saving}
              className="flex-1 bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm">
              {saving ? "ინახება..." : step === totalSteps ? "✅ დასრულება" : "შემდეგი →"}
            </button>
          </div>

          {/* Skip for parent step */}
          {step === 4 && (
            <button onClick={handleSkipParent} disabled={saving}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3 py-1">
              გამოვტოვებ →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
