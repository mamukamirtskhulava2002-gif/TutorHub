"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { REGIONS, getMunicipalitiesByRegion } from "@/lib/geo-data";

const STUDENT_LEVELS = [
  { id: "school",     icon: "🎒", label: "სკოლის მოსწავლე" },
  { id: "applicant",  icon: "📝", label: "აბიტურიენტი" },
  { id: "university", icon: "🎓", label: "სტუდენტი" },
  { id: "adult",      icon: "💼", label: "ზრდასრული" },
];
const PREF_SUBJECTS = [
  { id:"მათემატიკა",icon:"📐"},{id:"ფიზიკა",icon:"⚛️"},{id:"ქიმია",icon:"🧪"},
  {id:"ბიოლოგია",icon:"🌿"},{id:"ქართული",icon:"📖"},{id:"ინგლისური",icon:"🇬🇧"},
  {id:"ისტორია",icon:"🏛️"},{id:"პროგრამ.",icon:"💻"},{id:"გეოგრაფია",icon:"🌍"},
  {id:"ეკონომიკა",icon:"📈"},{id:"გერმანული",icon:"🇩🇪"},{id:"რუსული",icon:"🇷🇺"},
  {id:"ფრანგული",icon:"🇫🇷"},{id:"მუსიკა",icon:"🎵"},{id:"ხელოვნება",icon:"🎨"},
];
const PREF_TIMES = [
  { id:"morning",   icon:"☀️",  label:"დილა",   range:"09–12" },
  { id:"afternoon", icon:"🌤️", label:"შუადღე",  range:"12–17" },
  { id:"evening",   icon:"🌙",  label:"საღამო",  range:"17–21" },
];
const PREF_DAYS = [
  {key:"mon",label:"ორშ"},{key:"tue",label:"სამ"},{key:"wed",label:"ოთხ"},
  {key:"thu",label:"ხუთ"},{key:"fri",label:"პარ"},{key:"sat",label:"შაბ"},{key:"sun",label:"კვი"},
];
const GRADES_BY_LEVEL = {
  school:    Array.from({ length: 12 }, (_, i) => i + 1),
  applicant: [11, 12],
};

function SectionAlert({ alert }) {
  if (!alert) return null;
  return (
    <div className={`text-sm px-4 py-3 rounded-xl mt-4 border ${
      alert.type === "success"
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-red-50 border-red-200 text-red-700"
    }`}>
      {alert.type === "success" ? "✅" : "❌"} {alert.msg}
    </div>
  );
}

export default function StudentProfilePage() {
  const router         = useRouter();
  const avatarInputRef = useRef(null);

  const [loading,         setLoading]         = useState(true);
  const [savingInfo,      setSavingInfo]       = useState(false);
  const [savingPrefs,     setSavingPrefs]      = useState(false);
  const [uploadingAvatar, setUploadingAvatar]  = useState(false);
  const [userId,          setUserId]           = useState(null);

  const [infoAlert,  setInfoAlert]  = useState(null);
  const [prefAlert,  setPrefAlert]  = useState(null);

  const [form, setForm] = useState({
    full_name:          "",
    email:              "",
    phone:              "",
    birth_date:         "",
    bio:                "",
    avatar_url:         "",
    student_levels:     [],
    student_grade:      null,
    preferred_subjects: [],
    preferred_format:   "online",
    region_id:          null,
    municipality_id:    null,
    village:            "",
    preferred_days:     [],
    preferred_times:    [],
    parent_name:        "",
    parent_phone:       "",
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, phone, birth_date, bio, avatar_url, student_level, student_levels, student_grade, preferred_subjects, preferred_format, region_id, municipality_id, village, preferred_days, preferred_times, parent_name, parent_phone")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "student") { router.push("/dashboard"); return; }

      // Normalise student_levels: new array field takes priority over old string field
      const levelsArr = profile?.student_levels?.length
        ? profile.student_levels
        : (profile?.student_level ? [profile.student_level] : []);

      setForm(f => ({
        ...f,
        full_name:          profile?.full_name          || "",
        email:              user.email                  || "",
        phone:              profile?.phone              || "",
        birth_date:         profile?.birth_date         || "",
        bio:                profile?.bio                || "",
        avatar_url:         profile?.avatar_url         || "",
        student_levels:     levelsArr,
        student_grade:      profile?.student_grade      ?? null,
        preferred_subjects: profile?.preferred_subjects || [],
        preferred_format:   profile?.preferred_format   || "online",
        region_id:          profile?.region_id          ?? null,
        municipality_id:    profile?.municipality_id    ?? null,
        village:            profile?.village            || "",
        preferred_days:     profile?.preferred_days     || [],
        preferred_times:    profile?.preferred_times    || [],
        parent_name:        profile?.parent_name        || "",
        parent_phone:       profile?.parent_phone       || "",
      }));

      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 2 * 1024 * 1024) {
      setInfoAlert({ type: "error", msg: "ფოტო მაქსიმუმ 2MB უნდა იყოს." });
      return;
    }
    setUploadingAvatar(true);
    const supabase = createClient();
    const ext  = file.name.split(".").pop().toLowerCase();
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) {
      setInfoAlert({ type: "error", msg: `ატვირთვა ვერ მოხერხდა: ${uploadErr.message}` });
      setUploadingAvatar(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
    set("avatar_url", `${publicUrl}?t=${Date.now()}`);
    setUploadingAvatar(false);
    setInfoAlert({ type: "success", msg: "ფოტო განახლდა!" });
    setTimeout(() => setInfoAlert(null), 3000);
  }

  async function handleSaveInfo(e) {
    e.preventDefault();
    setSavingInfo(true);
    setInfoAlert(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      full_name:  form.full_name.trim(),
      phone:      form.phone.trim(),
      bio:        form.bio.trim(),
      birth_date: form.birth_date || null,
    }).eq("id", userId);
    setInfoAlert(error
      ? { type: "error",   msg: "შეცდომა. სცადეთ ხელახლა." }
      : { type: "success", msg: "პროფილი განახლდა!" });
    setTimeout(() => setInfoAlert(null), 3000);
    setSavingInfo(false);
  }

  async function handleSavePrefs(e) {
    e.preventDefault();
    if (!form.student_levels.length) {
      setPrefAlert({ type: "error", msg: "სწავლის საფეხური სავალდებულოა." });
      return;
    }
    if (!form.preferred_subjects.length) {
      setPrefAlert({ type: "error", msg: "მიუთითეთ მინიმუმ ერთი საგანი." });
      return;
    }
    setSavingPrefs(true);
    setPrefAlert(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      student_levels:     form.student_levels,
      student_level:      form.student_levels[0] || null,
      student_grade:      form.student_grade,
      preferred_subjects: form.preferred_subjects,
      preferred_format:   form.preferred_format,
      region_id:          form.region_id,
      municipality_id:    form.municipality_id,
      village:            form.village || null,
      preferred_days:     form.preferred_days,
      preferred_times:    form.preferred_times,
      parent_name:        form.parent_name || null,
      parent_phone:       form.parent_phone || null,
    }).eq("id", userId);
    setPrefAlert(error
      ? { type: "error",   msg: "შეცდომა. სცადეთ ხელახლა." }
      : { type: "success", msg: "პრეფერენციები განახლდა!" });
    setTimeout(() => setPrefAlert(null), 3000);
    setSavingPrefs(false);
  }

  const initials   = form.full_name
    ? form.full_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";
  const isSchool   = form.student_levels.includes("school") || form.student_levels.includes("applicant");
  const munis      = form.region_id ? getMunicipalitiesByRegion(form.region_id) : [];
  const showOfflineLoc = form.preferred_format === "offline" || form.preferred_format === "both";

  function toggleSubject(id) {
    set("preferred_subjects",
      form.preferred_subjects.includes(id)
        ? form.preferred_subjects.filter(s => s !== id)
        : [...form.preferred_subjects, id]);
  }
  function toggleLevel(id) {
    set("student_levels",
      form.student_levels.includes(id)
        ? form.student_levels.filter(l => l !== id)
        : [...form.student_levels, id]);
    set("student_grade", null);
  }
  function toggleDay(key) {
    set("preferred_days",
      form.preferred_days.includes(key)
        ? form.preferred_days.filter(d => d !== key)
        : [...form.preferred_days, key]);
  }
  function toggleTime(id) {
    set("preferred_times",
      form.preferred_times.includes(id)
        ? form.preferred_times.filter(t => t !== id)
        : [...form.preferred_times, id]);
  }

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="student" userName={form.full_name?.split(" ")[0]} />

      <main className="p-6 md:p-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-black text-gray-900 mb-6">👤 პროფილი</h1>

          {loading ? (
            <div className="space-y-4">
              {[1,2].map(i => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                  <div className="h-10 bg-gray-200 rounded mb-3" />
                  <div className="h-10 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">

              {/* ─── Personal info ─── */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-5">📋 პირადი ინფორმაცია</h2>

                {/* Avatar */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative shrink-0">
                    {form.avatar_url ? (
                      <img src={form.avatar_url} alt="avatar"
                        className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl">
                        {initials}
                      </div>
                    )}
                    <button type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-emerald-700 transition-colors shadow-sm">
                      {uploadingAvatar ? "⋯" : "✎"}
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*"
                      className="hidden" onChange={handleAvatarUpload} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{form.full_name || "სახელი"}</p>
                    <p className="text-xs text-gray-400">{form.email}</p>
                    <button type="button" onClick={() => avatarInputRef.current?.click()}
                      className="text-xs text-emerald-600 hover:underline mt-0.5">
                      ფოტოს შეცვლა
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveInfo} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">სახელი და გვარი</label>
                      <input className="input" value={form.full_name}
                        onChange={e => set("full_name", e.target.value)}
                        placeholder="გიორგი მამულაძე" required />
                    </div>
                    <div>
                      <label className="label">ტელეფონი</label>
                      <input className="input" value={form.phone}
                        onChange={e => set("phone", e.target.value)}
                        placeholder="+995 5XX XXX XXX" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">ელ. ფოსტა</label>
                      <input className="input bg-gray-50 cursor-not-allowed" value={form.email} disabled />
                      <p className="text-xs text-gray-400 mt-1">ელ. ფოსტის შეცვლა შეუძლებელია</p>
                    </div>
                    <div>
                      <label className="label">დაბადების თარიღი *</label>
                      <input type="date" className="input" value={form.birth_date}
                        onChange={e => set("birth_date", e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        required />
                    </div>
                  </div>
                  <div>
                    <label className="label">
                      ბიო <span className="text-gray-300 font-normal">({(form.bio || "").length}/200)</span>
                    </label>
                    <textarea className="input resize-none h-20" value={form.bio}
                      onChange={e => e.target.value.length <= 200 && set("bio", e.target.value)}
                      placeholder="მოკლე ინფორმაცია..." />
                  </div>
                  <button type="submit" disabled={savingInfo} className="btn-primary w-full py-3">
                    {savingInfo ? "ინახება..." : "პირადი ინფოს შენახვა"}
                  </button>
                </form>
                <SectionAlert alert={infoAlert} />
              </div>

              {/* ─── Learning preferences ─── */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-5">📚 სასწავლო პრეფერენციები</h2>
                <form onSubmit={handleSavePrefs} className="space-y-6">

                  {/* Level — multi-select */}
                  <div>
                    <label className="label mb-1">სწავლის საფეხური * <span className="text-gray-400 font-normal">(შეგიძლია რამდენიმეს არჩევა)</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      {STUDENT_LEVELS.map(l => (
                        <button key={l.id} type="button"
                          onClick={() => toggleLevel(l.id)}
                          className={`py-3 rounded-xl border text-sm font-semibold flex items-center gap-2 justify-center transition-all ${
                            form.student_levels.includes(l.id)
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "border-gray-200 text-gray-600 hover:border-emerald-300"
                          }`}>
                          {l.icon} {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grade */}
                  {(form.student_levels.includes("school") || form.student_levels.includes("applicant")) && (
                    <div>
                      <label className="label mb-2">კლასი</label>
                      <div className="flex flex-wrap gap-2">
                        {[...new Set([
                          ...(GRADES_BY_LEVEL["school"]    || []),
                          ...(GRADES_BY_LEVEL["applicant"] || []),
                        ])].sort((a,b) => a - b).map(g => (
                          <button key={g} type="button"
                            onClick={() => set("student_grade", g)}
                            className={`w-10 h-10 rounded-xl border text-sm font-semibold transition-all ${
                              form.student_grade === g
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "border-gray-200 text-gray-600 hover:border-emerald-300"
                            }`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subjects */}
                  <div>
                    <label className="label mb-2">სასურველი საგნები *</label>
                    <div className="flex flex-wrap gap-2">
                      {PREF_SUBJECTS.map(s => (
                        <button key={s.id} type="button" onClick={() => toggleSubject(s.id)}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1 transition-all ${
                            form.preferred_subjects.includes(s.id)
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "border-gray-200 text-gray-600 hover:border-emerald-300"
                          }`}>
                          {s.icon} {s.id}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Format */}
                  <div>
                    <label className="label mb-2">სწავლის ფორმატი</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id:"online",  icon:"💻", label:"ონლაინ" },
                        { id:"offline", icon:"🏫", label:"ოფლაინ" },
                        { id:"both",    icon:"🔄", label:"ორივე"  },
                      ].map(f => (
                        <button key={f.id} type="button"
                          onClick={() => set("preferred_format", f.id)}
                          className={`py-3 rounded-xl border text-sm font-semibold flex flex-col items-center gap-1 transition-all ${
                            form.preferred_format === f.id
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "border-gray-200 text-gray-600 hover:border-emerald-300"
                          }`}>
                          <span className="text-lg">{f.icon}</span>
                          <span className="text-xs">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  {showOfflineLoc && (
                    <div className="space-y-3">
                      <label className="label">მდებარეობა</label>
                      <select className="input" value={form.region_id || ""}
                        onChange={e => { set("region_id", e.target.value || null); set("municipality_id", null); set("village", ""); }}>
                        <option value="">-- რეგიონი --</option>
                        {REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      {form.region_id && munis.length > 0 && (
                        <select className="input" value={form.municipality_id || ""}
                          onChange={e => { set("municipality_id", e.target.value || null); set("village", ""); }}>
                          <option value="">-- მუნიციპალიტეტი --</option>
                          {munis.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      )}
                      {form.municipality_id && (
                        <input className="input" value={form.village}
                          onChange={e => set("village", e.target.value)}
                          placeholder="სოფელი / უბანი (არასავალდებულო)" />
                      )}
                    </div>
                  )}

                  {/* Days */}
                  <div>
                    <label className="label mb-2">თავისუფალი დღეები</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {PREF_DAYS.map(d => (
                        <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                          className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                            form.preferred_days.includes(d.key)
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "border-gray-200 text-gray-600 hover:border-emerald-300"
                          }`}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Times */}
                  <div>
                    <label className="label mb-2">სასურველი დრო</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PREF_TIMES.map(t => (
                        <button key={t.id} type="button" onClick={() => toggleTime(t.id)}
                          className={`py-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-0.5 transition-all ${
                            form.preferred_times.includes(t.id)
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "border-gray-200 text-gray-600 hover:border-emerald-300"
                          }`}>
                          <span className="text-base">{t.icon}</span>
                          <span>{t.label}</span>
                          <span className={`text-[10px] ${form.preferred_times.includes(t.id) ? "text-emerald-100" : "text-gray-400"}`}>{t.range}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Parent info */}
                  {isSchool && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                      <p className="text-sm font-semibold text-blue-800">👪 მშობლის ინფორმაცია</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label text-xs">მშობლის სახელი</label>
                          <input className="input text-sm" value={form.parent_name}
                            onChange={e => set("parent_name", e.target.value)}
                            placeholder="სახელი გვარი" />
                        </div>
                        <div>
                          <label className="label text-xs">მშობლის ტელეფონი</label>
                          <input className="input text-sm" value={form.parent_phone}
                            onChange={e => set("parent_phone", e.target.value)}
                            placeholder="+995 5XX XXX XXX" />
                        </div>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={savingPrefs} className="btn-primary w-full py-3">
                    {savingPrefs ? "ინახება..." : "პრეფერენციების შენახვა"}
                  </button>
                </form>
                <SectionAlert alert={prefAlert} />
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
