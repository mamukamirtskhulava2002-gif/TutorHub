"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { REGIONS, getMunicipalitiesByRegion } from "@/lib/geo-data";

const GRADES = [
  { id: "I კლასი",    label: "I",    group: "დაწყ." },
  { id: "II კლასი",   label: "II",   group: "დაწყ." },
  { id: "III კლასი",  label: "III",  group: "დაწყ." },
  { id: "IV კლასი",   label: "IV",   group: "დაწყ." },
  { id: "V კლასი",    label: "V",    group: "საბაზ." },
  { id: "VI კლასი",   label: "VI",   group: "საბაზ." },
  { id: "VII კლასი",  label: "VII",  group: "საბაზ." },
  { id: "VIII კლასი", label: "VIII", group: "საბაზ." },
  { id: "IX კლასი",   label: "IX",   group: "საბაზ." },
  { id: "X კლასი",    label: "X",    group: "საშ." },
  { id: "XI კლასი",   label: "XI",   group: "საშ." },
  { id: "XII კლასი",  label: "XII",  group: "საშ." },
  { id: "სტუდენტი",   label: "სტ.",  group: "უმაღლ." },
];

const SUBJECTS = [
  { id: "მათემატიკა",   icon: "📐" },
  { id: "ფიზიკა",       icon: "⚛️" },
  { id: "ქიმია",        icon: "🧪" },
  { id: "ბიოლოგია",     icon: "🌿" },
  { id: "ქართული",      icon: "📖" },
  { id: "ინგლისური",    icon: "🇬🇧" },
  { id: "ისტორია",      icon: "🏛️" },
  { id: "პროგრამირება", icon: "💻" },
  { id: "გეოგრაფია",    icon: "🌍" },
  { id: "ეკონომიკა",    icon: "📈" },
  { id: "გერმანული",    icon: "🇩🇪" },
  { id: "რუსული",       icon: "🇷🇺" },
  { id: "ფრანგული",     icon: "🇫🇷" },
  { id: "მუსიკა",       icon: "🎵" },
  { id: "ხელოვნება",    icon: "🎨" },
  { id: "სპორტი",       icon: "⚽" },
];

const FORMATS = [
  { id: "online",  icon: "🌐", label: "ონლაინ",    desc: "Google Meet / Zoom" },
  { id: "offline", icon: "🏠", label: "პირისპირ",   desc: "ჩვენთან ან მასწავლებელთან" },
  { id: "both",    icon: "🌓", label: "ორივე",      desc: "მიწყობს ხელს" },
];

const WEEKDAYS = [
  { key: "mon", full: "ორშ" },
  { key: "tue", full: "სამ" },
  { key: "wed", full: "ოთხ" },
  { key: "thu", full: "ხუთ" },
  { key: "fri", full: "პარ" },
  { key: "sat", full: "შაბ" },
  { key: "sun", full: "კვი" },
];

const TIMES = [
  { id: "morning",   icon: "☀️",  label: "დილა",   range: "09:00 – 12:00" },
  { id: "afternoon", icon: "🌤️", label: "შუადღე",  range: "12:00 – 17:00" },
  { id: "evening",   icon: "🌙",  label: "საღამო",  range: "17:00 – 21:00" },
];

// ─── Step 1 — შვილის ინფო ────────────────────────────────────────────────────
function Step1({ data, onChange }) {
  function toggleSubject(s) {
    const cur = data.subjects || [];
    onChange({
      ...data,
      subjects: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s],
    });
  }

  const groups = [...new Set(GRADES.map(g => g.group))];

  return (
    <div className="space-y-7">

      {/* Child name */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          შვილის სახელი <span className="text-red-400">*</span>
        </label>
        <input
          className="w-full border-2 border-gray-200 focus:border-emerald-400 rounded-2xl px-4 py-3 text-sm outline-none transition-all"
          placeholder="მაგ: გიორგი"
          value={data.childName || ""}
          onChange={e => onChange({ ...data, childName: e.target.value })}
        />
      </div>

      {/* Grade */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-3">
          კლასი / დონე <span className="text-red-400">*</span>
        </p>
        {groups.map(group => (
          <div key={group} className="mb-3">
            <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">{group}</p>
            <div className="flex flex-wrap gap-2">
              {GRADES.filter(g => g.group === group).map(g => (
                <button key={g.id} type="button"
                  onClick={() => onChange({ ...data, grade: g.id })}
                  className={`px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
                    data.grade === g.id
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
                  }`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Subjects */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-1">
          რომელ საგნებში სჭირდება დახმარება? <span className="text-red-400">*</span>
        </p>
        <p className="text-xs text-gray-400 mb-3">მონიშნე ყველა, რაც სჭირდება</p>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map(s => {
            const active = (data.subjects || []).includes(s.id);
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

// ─── Step 2 — ფორმატი + ლოკაცია ─────────────────────────────────────────────
function Step2({ data, onChange }) {
  const muns    = data.region_id ? getMunicipalitiesByRegion(data.region_id) : [];
  const villages = data.municipality_id
    ? REGIONS.flatMap(r => r.municipalities).find(m => m.id === data.municipality_id)?.villages || []
    : [];
  const needsLocation = data.format === "offline" || data.format === "both";

  return (
    <div className="space-y-6">

      {/* Format */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-3">
          სად ისწავლოს? <span className="text-red-400">*</span>
        </p>
        <div className="flex flex-col gap-3">
          {FORMATS.map(f => (
            <button key={f.id} type="button"
              onClick={() => onChange({ ...data, format: f.id })}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                data.format === f.id
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-emerald-300"
              }`}>
              <span className="text-3xl leading-none">{f.icon}</span>
              <div className="flex-1">
                <p className={`font-bold text-sm ${data.format === f.id ? "text-emerald-700" : "text-gray-800"}`}>
                  {f.label}
                </p>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
              {data.format === f.id && (
                <span className="text-emerald-600 font-black text-lg">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      {needsLocation && (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-4">
          <p className="text-sm font-bold text-gray-700">📍 სად ხართ?</p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              რეგიონი <span className="text-red-400">*</span>
            </label>
            <select
              value={data.region_id || ""}
              onChange={e => onChange({ ...data, region_id: e.target.value, municipality_id: "", village: "" })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
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
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
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
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
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

// ─── Step 3 — განრიგი ────────────────────────────────────────────────────────
function Step3({ data, onChange }) {
  function toggleDay(key) {
    const cur = data.days || [];
    onChange({ ...data, days: cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key] });
  }
  function setPreset(preset) {
    if (preset === "weekdays") onChange({ ...data, days: ["mon","tue","wed","thu","fri"] });
    if (preset === "weekends") onChange({ ...data, days: ["sat","sun"] });
    if (preset === "all")      onChange({ ...data, days: ["mon","tue","wed","thu","fri","sat","sun"] });
  }
  function toggleTime(id) {
    const cur = data.times || [];
    onChange({ ...data, times: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] });
  }

  const days  = data.days  || [];
  const times = data.times || [];

  const activePreset =
    days.length === 5 && !days.includes("sat") && !days.includes("sun") ? "weekdays" :
    days.length === 2 &&  days.includes("sat") &&  days.includes("sun") ? "weekends" :
    days.length === 7 ? "all" : null;

  return (
    <div className="space-y-7">

      {/* Days */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-3">
          რომელ დღეებს ამჯობინებს? <span className="text-red-400">*</span>
        </p>
        <div className="flex gap-2 mb-3 flex-wrap">
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
        <div className="flex gap-2">
          {WEEKDAYS.map(d => (
            <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
              className={`flex-1 h-11 rounded-xl font-bold text-xs border-2 transition-all ${
                days.includes(d.key)
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-emerald-400"
              }`}>
              {d.full}
            </button>
          ))}
        </div>
      </div>

      {/* Times */}
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

// ─── Done screen ─────────────────────────────────────────────────────────────
function DoneScreen({ childName, subjects, onGo }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">
          გამარჯობა, მშობელო!
        </h2>
        <p className="text-sm text-gray-500 mb-2">
          {childName
            ? <>{childName}-ის პროფილი <span className="font-semibold text-gray-700">TutorHub-ში</span> შეიქმნა!</>
            : "პროფილი მზადაა!"}
        </p>

        {subjects?.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center my-4">
            {subjects.slice(0, 6).map(s => (
              <span key={s} className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-left space-y-1.5">
          <p className="text-xs font-bold text-emerald-800 mb-2">✨ ახლა შენ შეგიძლია:</p>
          <p className="text-xs text-emerald-700">• {childName || "შვილის"} გაკვეთილების ნახვა</p>
          <p className="text-xs text-emerald-700">• მასწავლებლების ძიება და დაჯავშნა</p>
          <p className="text-xs text-emerald-700">• გადახდების და პროგრესის კონტროლი</p>
          <p className="text-xs text-emerald-700">• პირდაპირ მასწავლებელთან კომუნიკაცია</p>
        </div>

        <button onClick={onGo}
          className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-colors">
          მშობლის დაშბორდი →
        </button>
      </div>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
const TOTAL_STEPS = 3;
const STEP_LABELS = ["შვილის ინფო", "სად ისწავლოს", "განრიგი"];

export default function ParentOnboarding() {
  const router   = useRouter();
  const supabase = createClient();

  const [step, setStep]     = useState(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState("");
  const [userId, setUserId] = useState(null);

  const [data, setData] = useState({
    childName:       "",
    grade:           "",
    subjects:        [],
    format:          "",
    region_id:       "",
    municipality_id: "",
    village:         "",
    days:            [],
    times:           [],
  });

  useEffect(() => {
    let active = true;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) { router.replace("/auth"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role, onboarding_completed").eq("id", session.user.id).single();
      if (!active) return;
      if (profile?.role !== "parent") { router.replace("/dashboard"); return; }
      if (profile?.onboarding_completed) { router.replace("/dashboard/parent"); return; }
      setUserId(session.user.id);
    }
    init();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    if (step === 1) {
      if (!data.childName.trim()) return "შვილის სახელი სავალდებულოა";
      if (!data.grade)            return "კლასი / დონე სავალდებულოა";
      if (!data.subjects.length)  return "მინიმუმ ერთი საგანი სავალდებულოა";
    }
    if (step === 2) {
      if (!data.format) return "ფორმატი სავალდებულოა";
      const needsGeo = data.format === "offline" || data.format === "both";
      if (needsGeo && !data.region_id) return "რეგიონი სავალდებულოა";
    }
    if (step === 3) {
      if (!data.days.length)  return "მინ. ერთი დღე სავალდებულოა";
      if (!data.times.length) return "მინ. ერთი დროის მონაკვეთი სავალდებულოა";
    }
    return null;
  }

  async function saveToDb(complete = false) {
    if (!userId) return;
    const mun = REGIONS.flatMap(r => r.municipalities).find(m => m.id === data.municipality_id);

    // Save parent's search preferences derived from child info
    await supabase.from("profiles").update({
      preferred_subjects: data.subjects,
      preferred_format:   data.format   || null,
      region_id:          data.region_id         || null,
      municipality_id:    data.municipality_id   || null,
      village:            data.village           || null,
      city:               mun?.name || data.village || null,
      preferred_days:     data.days,
      preferred_times:    data.times,
    }).eq("id", userId);

    if (complete) {
      await supabase.from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);
    }
  }

  async function handleNext() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");

    if (step < TOTAL_STEPS) {
      saveToDb(false).catch(() => {});
      setStep(s => s + 1);
      return;
    }

    setSaving(true);
    try {
      await saveToDb(true);
      setDone(true);
    } catch (e) {
      setError("შენახვის შეცდომა: " + (e?.message || "სცადეთ ხელახლა"));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <DoneScreen
        childName={data.childName}
        subjects={data.subjects}
        onGo={() => router.replace("/dashboard/parent")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header / progress */}
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
                  {step}/{TOTAL_STEPS} — {STEP_LABELS[step - 1]}
                </p>
                <span className="text-xs text-gray-400">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <div key={i} className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
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
              {step === 1 && "მოგვიყევი შენს შვილზე 👶"}
              {step === 2 && "სად ისწავლოს?"}
              {step === 3 && "როდის ამჯობინებს სწავლას?"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {step === 1 && "ჩვენ ვიპოვით ზუსტ მასწავლებელს შენს შვილზე მორგებულს"}
              {step === 2 && "ლოკაცია ეხმარება ახლომდებარე მასწავლებლის პოვნაში"}
              {step === 3 && "კალენდარი შვილის გრაფიკზე ავტომ. სინქრონიზდება"}
            </p>
          </div>

          {step === 1 && <Step1 data={data} onChange={setData} />}
          {step === 2 && <Step2 data={data} onChange={setData} />}
          {step === 3 && <Step3 data={data} onChange={setData} />}

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
              {saving ? "ინახება..." : step === TOTAL_STEPS ? "✅ დასრულება" : "შემდეგი →"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
