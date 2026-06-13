"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
import { REGIONS, getMunicipalitiesByRegion } from "@/lib/geo-data";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });

const TARGET_LEVEL_OPTIONS = [
  { id:"school",     label:"სკოლა",        icon:"🎒" },
  { id:"applicant",  label:"აბიტურიენტი",  icon:"📝" },
  { id:"university", label:"სტუდენტი",     icon:"🎓" },
  { id:"adult",      label:"ზრდასრული",    icon:"💼" },
];
const LANGUAGE_OPTIONS = [
  { id:"ka", label:"ქართული",  flag:"🇬🇪" },
  { id:"en", label:"ინგლისური", flag:"🇬🇧" },
  { id:"ru", label:"რუსული",   flag:"🇷🇺" },
];

const SUBJECTS = [
  "მათემატიკა","ფიზიკა","ქიმია","ბიოლოგია","გეოგრაფია","ისტორია",
  "ქართული","ინგლისური","რუსული","გერმანული","პროგრამირება","ეკონომიკა",
];
const CITIES = ["თბილისი","ბათუმი","ქუთაისი","რუსთავი","გორი","ზუგდიდი"];

// ──────────────────────────────────────────────
// სანდოობის ინდექსის helper ფუნქციები
// ──────────────────────────────────────────────
function calcTrustIndex(totalBooked, cancelledByTutor) {
  if (!totalBooked || totalBooked === 0) return null; // ჯერ სტატისტიკა არ არის
  const completed = totalBooked - cancelledByTutor;
  return Math.round((completed / totalBooked) * 100);
}

function TrustIndexBadge({ index }) {
  if (index === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="text-lg">📊</span>
        <span>სტატისტიკა ჯერ არ არის — გამართეთ პირველი გაკვეთილი</span>
      </div>
    );
  }

  let color, bg, border, emoji, label;
  if (index >= 90) {
    color = "text-emerald-700"; bg = "bg-emerald-50"; border = "border-emerald-200";
    emoji = "🏆"; label = "შესანიშნავი";
  } else if (index >= 75) {
    color = "text-amber-700"; bg = "bg-amber-50"; border = "border-amber-200";
    emoji = "⚠️"; label = "საშუალო";
  } else {
    color = "text-red-700"; bg = "bg-red-50"; border = "border-red-200";
    emoji = "🔴"; label = "დაბლოკვის რისკი";
  }

  const filled = Math.round(index / 10);

  return (
    <div className={`rounded-xl border ${border} ${bg} px-5 py-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <span className={`text-2xl font-black ${color}`}>{index}%</span>
          <span className={`text-sm font-semibold ${color}`}>{label}</span>
        </div>
      </div>

      {/* პროგრეს ბარი */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${
            index >= 90 ? "bg-emerald-500" :
            index >= 75 ? "bg-amber-500" :
            "bg-red-500"
          }`}
          style={{ width: `${index}%` }}
        />
      </div>

      {/* dots ვიზუალიზაცია */}
      <div className="flex gap-1 mb-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full ${
              i < filled
                ? (index >= 90 ? "bg-emerald-400" : index >= 75 ? "bg-amber-400" : "bg-red-400")
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {index < 90 && (
        <p className={`text-xs ${color} font-medium`}>
          {index < 75
            ? "⛔ 75%-ს ქვემოთ — პროფილი 1 კვირით იყინება ავტომატურად"
            : "ინდექსის გასაუმჯობესებლად შეამცირეთ გაუქმებული გაკვეთილები"}
        </p>
      )}
    </div>
  );
}

function TrustIndexSection({ totalBooked, cancelledByTutor, isFrozen, frozenUntil }) {
  const index = calcTrustIndex(totalBooked, cancelledByTutor);
  const completed = (totalBooked || 0) - (cancelledByTutor || 0);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900">🛡️ სანდოობის ინდექსი</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
          ავტომატურად განახლდება
        </span>
      </div>

      {/* გაყინვის ბანერი */}
      {isFrozen && frozenUntil && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
          <span className="text-xl">🔒</span>
          <div>
            <p className="text-sm font-bold text-red-700">პროფილი დროებით გაყინულია</p>
            <p className="text-xs text-red-500 mt-0.5">
              განახლდება: {new Date(frozenUntil).toLocaleDateString("ka-GE", {
                day: "numeric", month: "long", year: "numeric"
              })}
            </p>
            <p className="text-xs text-red-400 mt-1">
              გაუქმებების რაოდენობამ 75%-ის ზღვარს ჩაუვარდა
            </p>
          </div>
        </div>
      )}

      <TrustIndexBadge index={index} />

      {/* სტატისტიკის ბარათები */}
      {totalBooked > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "სულ ჯავშანი", value: totalBooked, emoji: "📅", color: "text-gray-700" },
            { label: "შესრულებული", value: completed, emoji: "✅", color: "text-emerald-600" },
            { label: "გაუქმებული", value: cancelledByTutor, emoji: "❌", color: "text-red-500" },
          ].map(({ label, value, emoji, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <div className="text-lg mb-1">{emoji}</div>
              <div className={`text-xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ახსნა */}
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-blue-700 mb-1">📌 როგორ მუშაობს?</p>
        {[
          ["≥ 90%", "🏆 შესანიშნავი — ძიებაში პრიორიტეტი"],
          ["75–89%", "⚠️ საშუალო — ინდექსი ეცემა"],
          ["< 75%", "⛔ პროფილი 1 კვირით იყინება"],
        ].map(([range, desc]) => (
          <div key={range} className="flex items-center gap-2 text-xs text-blue-600">
            <span className="font-mono font-bold w-14 shrink-0">{range}</span>
            <span>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// მთავარი კომპონენტი
// ──────────────────────────────────────────────
export default function TutorProfilePage() {
  const router   = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError]     = useState("");
  const [tutorName, setTutorName] = useState("მასწავლებელი");

  // სანდოობის მონაცემები
  const [trustData, setTrustData] = useState({
    total_booked_lessons: 0,
    cancelled_by_tutor:   0,
    is_frozen:            false,
    frozen_until:         null,
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    bio: "",
    experience_years: "",
    city: "",
    subject: [],
    is_online: false,
    is_offline: false,
    trial_enabled: true,
    trial_duration: 30,
    trial_price: 0,
    max_sessions_per_week: 2,
    // onboarding fields
    tagline:             "",
    target_levels:       [],
    teaching_languages:  [],
    region_id:           null,
    municipality_id:     null,
    village:             "",
    location_rule:       "both_ways",
    accepts_packages:    false,
    // teaching format — 3 independent toggles
    teaches_online:      false,
    student_comes_mode:  false,
    tutor_goes_mode:     false,
  });
  const [extraAlert, setExtraAlert] = useState(null);
  const [exactCoords, setExactCoords] = useState(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationMsg, setLocationMsg] = useState({ type: "", text: "" });
  const [avatarUrl, setAvatarUrl]         = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg]         = useState({ type: "", text: "" });
  const [introVideoUrl, setIntroVideoUrl] = useState(null);
  const [videoFile, setVideoFile]         = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoMsg, setVideoMsg]           = useState({ type: "", text: "" });
  const [userId, setUserId]               = useState(null);
  const avatarInputRef = useRef();
  const videoInputRef  = useRef();

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, phone, birth_date, avatar_url")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "tutor") { router.push("/dashboard"); return; }

      setUserId(user.id);

      const { data: tutor } = await supabase
        .from("tutors")
        .select(`
          bio, experience_years, city,
          subject, is_online, is_offline,
          trial_duration, trial_price,
          max_sessions_per_week,
          total_booked_lessons,
          cancelled_by_tutor,
          is_frozen,
          frozen_until,
          tagline, target_levels, teaching_languages,
          region_id, municipality_id, village,
          location_rule, accepts_packages,
          intro_video_url,
          exact_lat, exact_lng
        `)
        .eq("id", user.id)
        .single();

      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
      if (tutor?.intro_video_url) setIntroVideoUrl(tutor.intro_video_url);
      if (tutor?.exact_lat && tutor?.exact_lng)
        setExactCoords({ lat: tutor.exact_lat, lng: tutor.exact_lng });

      const name = profile?.full_name || "";
      setTutorName(name.split(" ")[0]);

      // სანდოობის მონაცემები ცალკე state-ში
      setTrustData({
        total_booked_lessons: tutor?.total_booked_lessons || 0,
        cancelled_by_tutor:   tutor?.cancelled_by_tutor   || 0,
        is_frozen:            tutor?.is_frozen             || false,
        frozen_until:         tutor?.frozen_until          || null,
      });

      setForm(f => ({
        ...f,
        full_name:             name,
        email:                 user.email || "",
        phone:                 profile?.phone || "",
        birth_date:            profile?.birth_date || "",
        bio:                   tutor?.bio || "",
        experience_years:      tutor?.experience_years || "",
        city:                  tutor?.city || "",
        subject:               tutor?.subject || [],
        is_online:             tutor?.is_online  || false,
        is_offline:            tutor?.is_offline || false,
        trial_duration:        tutor?.trial_duration || 30,
        trial_price:           tutor?.trial_price ?? 0,
        trial_enabled:         tutor?.trial_duration != null,
        max_sessions_per_week: tutor?.max_sessions_per_week || 2,
        tagline:            tutor?.tagline            || "",
        target_levels:      tutor?.target_levels      || [],
        teaching_languages: tutor?.teaching_languages || [],
        region_id:          tutor?.region_id          ?? null,
        municipality_id:    tutor?.municipality_id    ?? null,
        village:            tutor?.village            || "",
        location_rule:      tutor?.location_rule      || "both_ways",
        accepts_packages:   tutor?.accepts_packages   || false,
        teaches_online:     tutor?.is_online          || false,
        student_comes_mode: tutor?.is_offline
          ? (tutor?.location_rule === "student_comes" || tutor?.location_rule === "both_ways")
          : false,
        tutor_goes_mode:    tutor?.is_offline
          ? (tutor?.location_rule === "tutor_goes" || tutor?.location_rule === "both_ways")
          : false,
      }));

      setLoading(false);
    }
    fetchData();
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleSubject(s) {
    setForm(f => ({
      ...f,
      subject: f.subject.includes(s)
        ? f.subject.filter(x => x !== s)
        : [...f.subject, s],
    }));
  }

  async function handleSaveDetails() {
    setSaving(true);
    setExtraAlert(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const hasOffline = form.student_comes_mode || form.tutor_goes_mode;
      const locRule =
        form.student_comes_mode && form.tutor_goes_mode ? "both_ways" :
        form.student_comes_mode ? "student_comes" :
        form.tutor_goes_mode    ? "tutor_goes" : null;

      const { error: saveErr } = await supabase.from("tutors").upsert({
        id:                 user.id,
        subject:            form.subject,
        tagline:            form.tagline || null,
        target_levels:      form.target_levels,
        teaching_languages: form.teaching_languages,
        is_online:          form.teaches_online,
        is_offline:         hasOffline,
        location_rule:      locRule,
        region_id:          hasOffline ? form.region_id : null,
        municipality_id:    hasOffline ? form.municipality_id : null,
        village:            hasOffline ? (form.village || null) : null,
        accepts_packages:   form.accepts_packages,
      });

      setExtraAlert(saveErr
        ? { type: "error",   msg: saveErr.message || "შეცდომა. სცადეთ ხელახლა." }
        : { type: "success", msg: "სწავლების დეტალები განახლდა!" });
    } catch (err) {
      setExtraAlert({ type: "error", msg: err.message || "შეცდომა. სცადეთ ხელახლა." });
    }
    setTimeout(() => setExtraAlert(null), 3000);
    setSaving(false);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!avatarUrl) {
      setError("პროფილის ფოტო სავალდებულოა. გთხოვთ ატვირთოთ ფოტო.");
      return;
    }
    setSaving(true);
    setError(""); setSuccess("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: pErr } = await supabase
      .from("profiles")
      .update({ full_name: form.full_name, phone: form.phone, birth_date: form.birth_date || null })
      .eq("id", user.id);

    const hasOffline = form.student_comes_mode || form.tutor_goes_mode;
    const locRule    =
      form.student_comes_mode && form.tutor_goes_mode ? "both_ways" :
      form.student_comes_mode ? "student_comes" :
      form.tutor_goes_mode    ? "tutor_goes" : null;

    const { error: tErr } = await supabase
      .from("tutors")
      .upsert({
        id:                    user.id,
        bio:                   form.bio || null,
        experience_years:      form.experience_years !== "" ? Number(form.experience_years) : null,
        city:                  form.city || null,
        subject:               form.subject,
        is_online:             form.teaches_online,
        is_offline:            hasOffline,
        location_rule:         locRule,
        trial_duration:        form.trial_enabled ? (Number(form.trial_duration) || 30) : null,
        trial_price:           form.trial_enabled ? (Number(form.trial_price) || 0) : null,
        max_sessions_per_week: Number(form.max_sessions_per_week) || 2,
        tagline:               form.tagline || null,
        target_levels:         form.target_levels,
        teaching_languages:    form.teaching_languages,
        region_id:             hasOffline ? form.region_id : null,
        municipality_id:       hasOffline ? form.municipality_id : null,
        village:               hasOffline ? (form.village || null) : null,
        accepts_packages:      form.accepts_packages,
      });

    if (pErr || tErr) {
      const msg = pErr?.message || tErr?.message || "შეცდომა. სცადეთ ხელახლა.";
      console.error("Profile save error:", { pErr, tErr });
      setError(msg);
    } else {
      setSuccess("პროფილი წარმატებით განახლდა!");
      setTutorName(form.full_name.split(" ")[0]);
      setTimeout(() => setSuccess(""), 3000);
    }
    setSaving(false);
  }

  async function handleAvatarUpload(file) {
    if (!file || !userId) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg({ type: "error", text: "ფოტო მაქს. 5MB." }); return;
    }
    setAvatarUploading(true);
    setAvatarMsg({ type: "", text: "" });
    const supabase = createClient();
    const ext  = file.name.split(".").pop().toLowerCase();
    const path = `${userId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setAvatarMsg({ type: "error", text: "ატვირთვა ვერ მოხდა: " + upErr.message });
      setAvatarUploading(false); return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    // Sync to tutors.photo_url so landing page shows the updated photo
    await supabase.from("tutors").update({ photo_url: url }).eq("id", userId);
    setAvatarUrl(url);
    setAvatarMsg({ type: "success", text: "✅ ფოტო ატვირთულია!" });
    setTimeout(() => setAvatarMsg({ type: "", text: "" }), 3000);
    setAvatarUploading(false);
  }

  async function handleAvatarDelete() {
    if (!avatarUrl || !userId) return;
    setAvatarUploading(true);
    const supabase = createClient();
    const pathMatch = avatarUrl.match(/avatars\/(.+?)(\?|$)/);
    if (pathMatch?.[1]) {
      await supabase.storage.from("avatars").remove([decodeURIComponent(pathMatch[1])]);
    }
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
    await supabase.from("tutors").update({ photo_url: null }).eq("id", userId);
    setAvatarUrl(null);
    setAvatarMsg({ type: "success", text: "✅ ფოტო წაიშალა." });
    setTimeout(() => setAvatarMsg({ type: "", text: "" }), 3000);
    setAvatarUploading(false);
  }

  async function handleSaveExactLocation() {
    setLocationSaving(true);
    setLocationMsg({ type: "", text: "" });
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("tutors").update({
      exact_lat: exactCoords?.lat ?? null,
      exact_lng: exactCoords?.lng ?? null,
    }).eq("id", user.id);
    setLocationMsg(error
      ? { type: "error",   text: "შეცდომა. სცადეთ ხელახლა." }
      : { type: "success", text: exactCoords ? "✅ ლოკაცია შენახულია!" : "✅ ლოკაცია წაიშალა." }
    );
    setTimeout(() => setLocationMsg({ type: "", text: "" }), 3000);
    setLocationSaving(false);
  }

  async function handleVideoDelete() {
    if (!introVideoUrl || !userId) return;
    const supabase = createClient();
    const path = introVideoUrl.split("/tutor-videos/")[1];
    if (path) {
      await supabase.storage.from("tutor-videos").remove([path]);
    }
    await supabase.from("tutors").update({ intro_video_url: null }).eq("id", userId);
    setIntroVideoUrl(null);
    setVideoMsg({ type: "success", text: "✅ ვიდეო წაიშალა." });
    setTimeout(() => setVideoMsg({ type: "", text: "" }), 3000);
  }

  async function handleVideoUpload() {
    if (!videoFile || !userId) return;
    if (videoFile.size > 300 * 1024 * 1024) {
      setVideoMsg({ type: "error", text: "ვიდეო მაქს. 300MB." }); return;
    }
    setVideoUploading(true);
    setVideoMsg({ type: "", text: "" });
    const supabase = createClient();
    const ext  = videoFile.name.split(".").pop().toLowerCase();
    const path = `videos/${userId}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("tutor-videos")
      .upload(path, videoFile, { upsert: true });
    if (upErr) {
      setVideoMsg({ type: "error", text: "ატვირთვა ვერ მოხდა: " + upErr.message });
      setVideoUploading(false); return;
    }
    const { data: { publicUrl } } = supabase.storage.from("tutor-videos").getPublicUrl(path);
    const { error: updateErr } = await supabase.from("tutors")
      .update({ intro_video_url: publicUrl }).eq("id", userId);
    if (updateErr) {
      setVideoMsg({ type: "error", text: "განახლება ვერ მოხდა." });
      setVideoUploading(false); return;
    }
    setIntroVideoUrl(publicUrl);
    setVideoFile(null);
    setVideoMsg({ type: "success", text: "✅ ვიდეო ატვირთულია!" });
    setVideoUploading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />

      {/* Main */}
      <main className="p-6 md:p-8">
        <div className="max-w-2xl">
        <h1 className="text-2xl font-black text-gray-900 mb-6">👤 პროფილი</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
            ❌ {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-5">
            ✅ {success}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                <div className="h-10 bg-gray-200 rounded mb-3" />
                <div className="h-10 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">

            {/* ══ სანდოობის ინდექსი ══ */}
            <TrustIndexSection
              totalBooked={trustData.total_booked_lessons}
              cancelledByTutor={trustData.cancelled_by_tutor}
              isFrozen={trustData.is_frozen}
              frozenUntil={trustData.frozen_until}
            />

            {/* ══ პირადი ინფო ══ */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">📋 პირადი ინფორმაცია</h2>

              {/* Avatar */}
              <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
                <div className="relative flex-shrink-0">
                  <div className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold ring-2 ${
                    avatarUrl ? "bg-emerald-100 text-emerald-700 ring-emerald-300" : "bg-red-50 text-red-300 ring-red-200"
                  }`}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      : <span className="text-3xl">👤</span>
                    }
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-800">პროფილის ფოტო</p>
                    <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full font-medium">სავალდებულო</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">JPG, PNG, WEBP · მაქს. 5MB</p>
                  {avatarMsg.text && (
                    <p className={`text-xs mb-2 ${avatarMsg.type === "error" ? "text-red-600" : "text-emerald-600"}`}>
                      {avatarMsg.text}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-all font-medium disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {avatarUploading
                      ? <><span className="w-3 h-3 border border-emerald-400 border-t-emerald-600 rounded-full animate-spin" /> იტვირთება...</>
                      : <>{avatarUrl ? "📷 ფოტოს შეცვლა" : "📷 ფოტოს ატვირთვა"}</>
                    }
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                  />
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">

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
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
                      required />
                  </div>
                </div>

                <div>
                  <label className="label">ჩემ შესახებ</label>
                  <textarea className="input resize-none" rows={4}
                    value={form.bio} onChange={e => set("bio", e.target.value)}
                    placeholder="მოკლედ აღწერეთ თქვენი გამოცდილება..." />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">გამოცდილება (წელი)</label>
                    <input className="input" type="number" min="0"
                      value={form.experience_years}
                      onChange={e => set("experience_years", e.target.value)}
                      placeholder="3" />
                  </div>
                  <div>
                    <label className="label">ქალაქი</label>
                    <select className="input" value={form.city}
                      onChange={e => set("city", e.target.value)}>
                      <option value="">აირჩიეთ</option>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">საგნები</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {SUBJECTS.map(s => (
                      <button key={s} type="button" onClick={() => toggleSubject(s)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                          form.subject.includes(s)
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ══ საცდელი გაკვეთილი ══ */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">🎓 საცდელი გაკვეთილი</p>
                      <p className="text-xs text-gray-400">სტუდენტს ერთხელ შეუძლია სარგებლობა</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => set("trial_enabled", !form.trial_enabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        form.trial_enabled ? "bg-emerald-600" : "bg-gray-200"
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        form.trial_enabled ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {form.trial_enabled && (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          ხანგრძლივობა
                        </p>
                        <div className="flex gap-2">
                          {[15, 30].map(min => (
                            <button
                              key={min}
                              type="button"
                              onClick={() => set("trial_duration", min)}
                              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                form.trial_duration === min
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "border-gray-200 text-gray-600 hover:border-emerald-400"
                              }`}
                            >
                              {min} წუთი
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          ფასი
                        </p>
                        <div className="flex gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => set("trial_price", 0)}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                              form.trial_price === 0
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "border-gray-200 text-gray-600 hover:border-emerald-400"
                            }`}
                          >
                            🆓 უფასო
                          </button>
                          <button
                            type="button"
                            onClick={() => set("trial_price", form.trial_price || 5)}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                              form.trial_price > 0
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "border-gray-200 text-gray-600 hover:border-emerald-400"
                            }`}
                          >
                            💰 ფასიანი
                          </button>
                        </div>
                        {form.trial_price > 0 && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="50"
                              className="input"
                              value={form.trial_price}
                              onChange={e => set("trial_price", Number(e.target.value))}
                              placeholder="5"
                            />
                            <span className="text-sm text-gray-500">₾</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                        📌 სტუდენტი ნახავს: <strong>{form.trial_duration} წუთი</strong>
                        {form.trial_price === 0 ? " — უფასო" : ` — ${form.trial_price} ₾`}
                      </div>
                    </div>
                  )}
                </div>

                {/* ══ კვირაში გაკვეთილების რაოდენობა ══ */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-800 mb-1">
                    📅 კვირაში გაკვეთილების მაქსიმუმი ერთ სტუდენტს
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    თუ 2-ს აირჩევ — სტუდენტს კვირაში 2-ზე მეტის დაჯავშნა არ შეეძლება.
                    თუ 3-ს — სტუდენტს 2 ან 3-ის არჩევის საშუალება ექნება.
                  </p>
                  <div className="flex gap-2">
                    {[2, 3].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => set("max_sessions_per_week", n)}
                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                          form.max_sessions_per_week === n
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "border-gray-200 text-gray-600 hover:border-emerald-400"
                        }`}
                      >
                        კვირაში {n}-ჯერ
                        {n === 3 && (
                          <span className="block text-xs mt-0.5 opacity-70">
                            სტუდენტი ირჩევს 2 ან 3
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={saving} className="btn-primary w-full py-3">
                  {saving ? "ინახება..." : "ცვლილებების შენახვა"}
                </button>
              </form>
            </div>

            {/* ══ სწავლების დეტალები ══ */}
            {(() => {
              const munis = form.region_id ? getMunicipalitiesByRegion(form.region_id) : [];
              const toggleLevel = (id) =>
                set("target_levels",
                  form.target_levels.includes(id)
                    ? form.target_levels.filter(l => l !== id)
                    : [...form.target_levels, id]);
              const toggleLang = (id) =>
                set("teaching_languages",
                  form.teaching_languages.includes(id)
                    ? form.teaching_languages.filter(l => l !== id)
                    : [...form.teaching_languages, id]);

              return (
                <div className="card p-6">
                  <h2 className="font-bold text-gray-900 mb-5">🎓 სწავლების დეტალები</h2>

                  {extraAlert && (
                    <div className={`text-sm px-4 py-3 rounded-xl mb-4 border ${
                      extraAlert.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}>
                      {extraAlert.type === "success" ? "✅" : "❌"} {extraAlert.msg}
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Tagline */}
                    <div>
                      <label className="label">
                        სლოგანი / ტეგლაინი
                        <span className="text-gray-300 font-normal ml-1">({(form.tagline || "").length}/80)</span>
                      </label>
                      <input className="input" value={form.tagline}
                        onChange={e => e.target.value.length <= 80 && set("tagline", e.target.value)}
                        placeholder="მაგ: ვეხმარები აბიტურიენტებს ოცნებების უნივერსიტეტში მოხვედრაში" />
                    </div>

                    {/* Target levels */}
                    <div>
                      <label className="label mb-2">სასწავლო საფეხურები</label>
                      <div className="grid grid-cols-2 gap-2">
                        {TARGET_LEVEL_OPTIONS.map(l => (
                          <button key={l.id} type="button"
                            onClick={() => toggleLevel(l.id)}
                            className={`py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 justify-center transition-all ${
                              form.target_levels.includes(l.id)
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "border-gray-200 text-gray-600 hover:border-emerald-300"
                            }`}>
                            {l.icon} {l.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Teaching languages */}
                    <div>
                      <label className="label mb-2">სწავლების ენა</label>
                      <div className="flex gap-2">
                        {LANGUAGE_OPTIONS.map(l => (
                          <button key={l.id} type="button"
                            onClick={() => toggleLang(l.id)}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                              form.teaching_languages.includes(l.id)
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "border-gray-200 text-gray-600 hover:border-emerald-300"
                            }`}>
                            {l.flag} {l.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Teaching format — 3 independent toggles */}
                    <div>
                      <label className="label mb-1">სწავლების ფორმატი</label>
                      <p className="text-xs text-gray-400 mb-3">აირჩიეთ ერთი ან რამდენიმე</p>
                      <div className="space-y-2">
                        {[
                          { key:"teaches_online",     icon:"💻", label:"ონლაინ",                   desc:"დისტანციური გაკვეთილი" },
                          { key:"student_comes_mode", icon:"🏫", label:"სტუდენტი მოდის ჩემთან",   desc:"პირისპირ, ჩემს ადგილას" },
                          { key:"tutor_goes_mode",    icon:"🚗", label:"მე მივდივარ სტუდენტთან",  desc:"პირისპირ, სტუდენტის ადგილას" },
                        ].map(({ key, icon, label, desc }) => (
                          <button key={key} type="button"
                            onClick={() => set(key, !form[key])}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              form[key]
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "border-gray-200 text-gray-600 hover:border-emerald-300"
                            }`}>
                            <span className="text-xl shrink-0">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold">{label}</p>
                              <p className={`text-xs ${form[key] ? "text-emerald-100" : "text-gray-400"}`}>{desc}</p>
                            </div>
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              form[key] ? "border-white bg-white" : "border-gray-300"
                            }`}>
                              {form[key] && <span className="text-emerald-600 text-xs font-black">✓</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                      {!form.teaches_online && !form.student_comes_mode && !form.tutor_goes_mode && (
                        <p className="text-xs text-amber-600 mt-2">⚠️ მინიმუმ ერთი ვარიანტი უნდა იყოს არჩეული</p>
                      )}
                    </div>

                    {/* Location — only for offline modes */}
                    {(form.student_comes_mode || form.tutor_goes_mode) && (
                      <div className="space-y-3">
                        <label className="label">მდებარეობა (ოფლაინ გაკვეთილებისთვის)</label>
                        <select className="input" value={form.region_id || ""}
                          onChange={e => { set("region_id", e.target.value || null); set("municipality_id", null); set("village", ""); }}>
                          <option value="">-- აირჩიეთ რეგიონი --</option>
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

                    {/* Accepts packages */}
                    <div className="flex items-center justify-between py-3 border-t border-gray-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">📦 გამოწერის პაკეტები</p>
                        <p className="text-xs text-gray-400">სტუდენტებს შეუძლიათ ყოველთვიური პაკეტის ყიდვა</p>
                      </div>
                      <button type="button"
                        onClick={() => set("accepts_packages", !form.accepts_packages)}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${form.accepts_packages ? "bg-emerald-600" : "bg-gray-200"}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.accepts_packages ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>

                    <button type="button"
                      disabled={saving}
                      onClick={handleSaveDetails}
                      className="btn-primary w-full py-3">
                      {saving ? "ინახება..." : "დეტალების შენახვა"}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ══ ვიდეო-წარდგენა ══ */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-bold text-gray-900">🎥 ვიდეო-წარდგენა</h2>
                <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">
                  1–3 წუთი
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                სტუდენტებსა და მშობლებს ეჩვენებათ შენს პროფილზე.
                მოკლე ვიდეო წარდგენა <strong>3×-ით მეტ სტუდენტს</strong> მოგიყვანს —
                წარადგინე თავი, მოყვი გამოცდილება.
              </p>

              {/* existing video preview */}
              {introVideoUrl && (
                <div className="mb-4">
                  <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black mb-2">
                    <video
                      src={introVideoUrl}
                      controls
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVideoDelete}
                    className="text-xs text-red-400 hover:text-red-600 font-medium flex items-center gap-1">
                    🗑 ვიდეოს წაშლა
                  </button>
                </div>
              )}

              {/* drop zone */}
              <div
                onClick={() => videoInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 hover:border-emerald-400 rounded-2xl p-6 text-center cursor-pointer transition-all mb-3">
                {videoFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">🎬</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800 truncate max-w-[220px]">{videoFile.name}</p>
                      <p className="text-xs text-gray-400">{(videoFile.size / 1024 / 1024).toFixed(0)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setVideoFile(null); }}
                      className="ml-4 text-red-400 hover:text-red-600 font-bold text-lg leading-none">
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-4xl mb-2">🎬</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {introVideoUrl ? "ვიდეოს შეცვლა — დააჭირე ასატვირთად" : "ვიდეოს ასატვირთად დააჭირე"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">MP4, MOV, AVI · მაქს. 300MB · 1–3 წუთი</p>
                  </>
                )}
              </div>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && setVideoFile(e.target.files[0])}
              />

              {videoMsg.text && (
                <p className={`text-sm px-4 py-2.5 rounded-xl mb-3 ${
                  videoMsg.type === "error"
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                }`}>{videoMsg.text}</p>
              )}

              {videoFile && (
                <button
                  type="button"
                  onClick={handleVideoUpload}
                  disabled={videoUploading}
                  className="btn-primary w-full py-3 font-bold disabled:opacity-50">
                  {videoUploading ? "იტვირთება..." : "🎥 ვიდეოს ატვირთვა"}
                </button>
              )}
            </div>

            {/* ══ ზუსტი ლოკაცია ══ */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="font-bold text-gray-900">📍 ზუსტი ლოკაცია</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    სტუდენტი / მშობელი ზუსტ ადგილმდებარეობას მხოლოდ მაშინ ნახავს, თუ მონიშნავთ.
                    არარჩევის შემთხვევაში — ლოკაცია პროფილზე არ ჩანს.
                  </p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg shrink-0 ml-3">
                  არასავალდებულო
                </span>
              </div>

              {locationMsg.text && (
                <div className={`text-sm px-4 py-2.5 rounded-xl mb-3 border ${
                  locationMsg.type === "error"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}>
                  {locationMsg.text}
                </div>
              )}

              <div className="mt-3">
                <LocationPicker
                  value={exactCoords}
                  onChange={coords => setExactCoords(coords)}
                  height="300px"
                />
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleSaveExactLocation}
                  disabled={locationSaving}
                  className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50"
                >
                  {locationSaving ? "ინახება..." : "📍 ლოკაციის შენახვა"}
                </button>
                {exactCoords && (
                  <button
                    type="button"
                    disabled={locationSaving}
                    onClick={async () => {
                      setExactCoords(null);
                      setLocationSaving(true);
                      setLocationMsg({ type: "", text: "" });
                      const supabase = createClient();
                      const { data: { user } } = await supabase.auth.getUser();
                      const { error } = await supabase.from("tutors")
                        .update({ exact_lat: null, exact_lng: null })
                        .eq("id", user.id);
                      setLocationMsg(error
                        ? { type: "error",   text: "შეცდომა. სცადეთ ხელახლა." }
                        : { type: "success", text: "✅ ლოკაცია წაიშალა." }
                      );
                      setTimeout(() => setLocationMsg({ type: "", text: "" }), 3000);
                      setLocationSaving(false);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm hover:bg-red-50 transition-all disabled:opacity-50"
                  >
                    🗑 მოხსნა
                  </button>
                )}
              </div>
            </div>

          </div>
        )}
        </div>
      </main>
    </div>
  );
}