"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const DAY_LABELS = { mon:"ორშ", tue:"სამ", wed:"ოთხ", thu:"ხუთ", fri:"პარ", sat:"შაბ", sun:"კვი" };
const TIME_LABELS = { morning:"დილა (09–12)", afternoon:"შუადღე (12–17)", evening:"საღამო (17–21)" };

function StarRating({ value = 0, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < Math.round(value) ? "text-amber-400" : "text-gray-200"}>★</span>
      ))}
    </div>
  );
}

export default function TutorPublicProfile() {
  const { id }  = useParams();
  const router  = useRouter();
  const [tutor,      setTutor]      = useState(null);
  const [reviews,    setReviews]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [role,       setRole]       = useState("student");
  const [myName,     setMyName]     = useState("");
  const [myId,       setMyId]       = useState(null);
  const [notFound,   setNotFound]   = useState(false);
  const [slots,      setSlots]      = useState([]);
  const [enrolling,  setEnrolling]  = useState(null); // slotId

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setMyId(user.id);
        const { data: p } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
        if (p) { setRole(p.role); setMyName(p.full_name?.split(" ")[0] || ""); }
      }

      const { data: t } = await supabase
        .from("tutors")
        .select(`
          id, subject, price_per_hour, experience_years, bio, city,
          is_online, is_offline, location_rule,
          trial_duration, trial_price,
          tagline, target_levels, teaching_languages,
          region_id, municipality_id, village,
          accepts_packages, average_rating, total_reviews,
          intro_video_url,
          profiles!id(full_name, avatar_url),
          schedule
        `)
        .eq("id", id)
        .eq("is_verified", true)
        .single();

      if (!t) { setNotFound(true); setLoading(false); return; }
      setTutor(t);

      const { data: rv } = await supabase
        .from("reviews")
        .select("rating, comment, created_at, profiles!student_id(full_name, avatar_url)")
        .eq("tutor_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      setReviews(rv || []);

      // Load upcoming lesson slots
      const today = new Date().toLocaleDateString("en-CA");
      const future = new Date(); future.setDate(future.getDate() + 30);
      const to = future.toLocaleDateString("en-CA");
      const slotsRes = await fetch(`/api/lesson-slots?tutorId=${id}&from=${today}&to=${to}`);
      const slotsData = await slotsRes.json();
      setSlots(Array.isArray(slotsData) ? slotsData : []);

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role={role} userName={myName} />
      <main className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </main>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role={role} userName={myName} />
      <main className="p-8 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-gray-500">მასწავლებელი ვერ მოიძებნა</p>
        <Link href="/search" className="text-emerald-600 text-sm mt-4 inline-block hover:underline">← ძიებაზე დაბრუნება</Link>
      </main>
    </div>
  );

  const name      = tutor.profiles?.full_name || "მასწავლებელი";
  const avatar    = tutor.profiles?.avatar_url;
  const initials  = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const subjects  = Array.isArray(tutor.subject) ? tutor.subject : [];
  const rating    = tutor.average_rating || 0;
  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role={role} userName={myName} />

      <main className="p-6 md:p-8">
        <div className="max-w-3xl">

          {/* Back */}
          <Link href="/search" className="text-sm text-gray-400 hover:text-emerald-600 flex items-center gap-1 mb-6">
            ← ძიებაზე დაბრუნება
          </Link>

          {/* Hero card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-5">
            <div className="flex items-start gap-5">
              {avatar ? (
                <img src={avatar} alt={name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100 shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-black shrink-0">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-black text-gray-900">{name}</h1>
                {tutor.tagline && <p className="text-sm text-gray-500 mt-0.5 italic">"{tutor.tagline}"</p>}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {rating > 0 && (
                    <div className="flex items-center gap-1">
                      <StarRating value={rating} />
                      <span className="text-sm font-semibold text-gray-700">{rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({tutor.total_reviews || 0})</span>
                    </div>
                  )}
                  {tutor.experience_years > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">
                      {tutor.experience_years} წ. გამოცდ.
                    </span>
                  )}
                  {tutor.city && (
                    <span className="text-xs text-gray-400">📍 {tutor.city}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {subjects.map(s => (
                    <span key={s} className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium border border-emerald-100">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price + CTA */}
              <div className="text-right shrink-0">
                <p className="text-2xl font-black text-gray-900">{tutor.price_per_hour} ₾</p>
                <p className="text-xs text-gray-400 mb-3">/ საათი</p>
                {myId && myId !== id && (
                  <Link
                    href={`/booking/${id}`}
                    className="btn-primary text-sm px-5 py-2.5 inline-block">
                    ჯავშნის გაფორმება →
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_280px] gap-5">
            <div className="space-y-5">

              {/* Bio */}
              {tutor.bio && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-3">📋 ჩემ შესახებ</h2>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{tutor.bio}</p>
                </div>
              )}

              {/* Intro video */}
              {tutor.intro_video_url && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-3">🎥 ვიდეო-წარდგენა</h2>
                  <div className="rounded-xl overflow-hidden border border-gray-100 bg-black">
                    <video
                      src={tutor.intro_video_url}
                      controls
                      preload="metadata"
                      className="w-full max-h-72 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* ── Lesson Slots ── */}
              {slots.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-gray-900">📅 ხელმისაწვდომი სლოტები</h2>
                    <span className="text-xs text-gray-400">{slots.length} სლოტი · მომდ. 30 დღე</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {slots.map(slot => {
                      const enrolled = (slot.slot_enrollments || []).filter(e => e.status === "enrolled").length;
                      const waiting  = (slot.slot_waitlist  || []).filter(w => w.status === "waiting").length;
                      const isFull   = slot.status === "full" || enrolled >= slot.max_capacity;
                      const myEnroll = myId && (slot.slot_enrollments || []).some(e => e.student_id === myId && e.status === "enrolled");
                      const myWait   = myId && (slot.slot_waitlist  || []).some(w => w.student_id === myId && w.status === "waiting");
                      const dateObj  = new Date(`${slot.date}T${slot.time_slot}`);
                      const TYPE_ICONS = { trial:"🎓", single:"📅", package:"📦", recurring:"🔁" };

                      async function handleEnroll() {
                        if (!myId) { window.location.href = "/auth"; return; }
                        setEnrolling(slot.id);
                        const res = await fetch(`/api/lesson-slots/${slot.id}/enroll`, { method: "POST" });
                        const json = await res.json();
                        setEnrolling(null);
                        if (json.enrolled) {
                          setSlots(prev => prev.map(s => s.id !== slot.id ? s : {
                            ...s,
                            status: json.enrolledCount >= s.max_capacity ? "full" : "open",
                            slot_enrollments: [...(s.slot_enrollments||[]), { student_id: myId, status: "enrolled" }],
                          }));
                        } else if (json.waitlisted) {
                          setSlots(prev => prev.map(s => s.id !== slot.id ? s : {
                            ...s,
                            slot_waitlist: [...(s.slot_waitlist||[]), { student_id: myId, status: "waiting" }],
                          }));
                          alert(`✅ მომლოდინეთა სიაში ხარ (#${json.position}). შეტყობინება გამოგიგზავნება ადგილის გამოთავისუფლებისას.`);
                        }
                      }

                      return (
                        <div key={slot.id} className="px-5 py-4 flex items-center gap-4">
                          {/* Date block */}
                          <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm text-white font-black text-xs ${
                            isFull ? "bg-orange-500" : slot.is_group ? "bg-blue-600" : "bg-violet-600"
                          }`}>
                            <span className="text-base leading-none">{dateObj.getDate()}</span>
                            <span className="text-[10px] opacity-80 leading-none">
                              {["იან","თებ","მარ","აპრ","მაი","ივნ","ივლ","აგვ","სექ","ოქტ","ნოე","დეკ"][dateObj.getMonth()]}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-sm font-black text-gray-900">{slot.time_slot?.slice(0,5)}</span>
                              <span className="text-xs text-gray-400">· {slot.duration_hours} სთ</span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                                {TYPE_ICONS[slot.booking_type]} {slot.booking_type === "trial" ? "საცდელი" : slot.booking_type === "single" ? "ერთჯ." : slot.booking_type === "package" ? "პაკეტი" : "განმეორ."}
                              </span>
                              {slot.subject?.[0] && (
                                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-100">
                                  {slot.subject[0]}
                                </span>
                              )}
                            </div>

                            {slot.is_group ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-blue-700">👥 {slot.price_per_student} ₾/სტ.</span>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: slot.max_capacity }).map((_, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full border ${
                                      i < enrolled ? "bg-blue-500 border-blue-500" : "bg-gray-100 border-gray-300"
                                    }`} />
                                  ))}
                                  <span className={`text-xs font-semibold ml-1 ${isFull ? "text-orange-600" : "text-gray-500"}`}>
                                    {isFull ? "სავსე" : `${enrolled}/${slot.max_capacity} ადგილი`}
                                  </span>
                                  {waiting > 0 && (
                                    <span className="text-xs text-amber-600 font-semibold">· {waiting}⏳ მოლოდ.</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-violet-700">👤 {slot.price_per_student} ₾</span>
                            )}
                          </div>

                          {/* Action */}
                          <div className="shrink-0">
                            {myId === id ? null : myEnroll ? (
                              <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-xl">✓ ჩარიცხული</span>
                            ) : myWait ? (
                              <span className="text-xs bg-amber-100 text-amber-700 font-bold px-3 py-1.5 rounded-xl">⏳ რიგში</span>
                            ) : isFull ? (
                              <button
                                onClick={handleEnroll}
                                disabled={enrolling === slot.id}
                                className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold px-3 py-2 rounded-xl transition-all disabled:opacity-50">
                                {enrolling === slot.id ? "..." : "⏳ რიგში შედგომა"}
                              </button>
                            ) : (
                              <button
                                onClick={handleEnroll}
                                disabled={enrolling === slot.id}
                                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50 shadow-sm">
                                {enrolling === slot.id ? "..." : "ჩარიცხვა →"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reviews */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">⭐ შეფასებები ({tutor.total_reviews || 0})</h2>
                {reviews.length === 0 ? (
                  <p className="text-sm text-gray-400">შეფასება ჯერ არ არის</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((r, i) => (
                      <div key={i} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                            {(r.profiles?.full_name || "?").slice(0, 1)}
                          </div>
                          <span className="text-sm font-semibold text-gray-800">{r.profiles?.full_name || "სტუდენტი"}</span>
                          <StarRating value={r.rating} />
                          <span className="text-xs text-gray-300 ml-auto">
                            {new Date(r.created_at).toLocaleDateString("ka-GE", { day: "numeric", month: "long" })}
                          </span>
                        </div>
                        {r.comment && <p className="text-sm text-gray-600 leading-snug pl-9">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar info */}
            <div className="space-y-4">

              {/* Trial */}
              {tutor.trial_duration && (
                <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                  <h3 className="font-bold text-emerald-800 mb-1 text-sm">🎓 საცდელი გაკვეთილი</h3>
                  <p className="text-sm text-emerald-700">
                    {tutor.trial_duration} წუთი —{" "}
                    {tutor.trial_price === 0 ? "უფასო" : `${tutor.trial_price} ₾`}
                  </p>
                </div>
              )}

              {/* Teaching details card */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 text-sm">🎓 სწავლების დეტალები</h3>
                <div className="space-y-4">

                  {/* Format */}
                  {(tutor.is_online || tutor.is_offline) && (
                    <div>
                      <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">ფორმატი</p>
                      <div className="space-y-1.5">
                        {tutor.is_online && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="w-5 text-center text-base">💻</span>
                            <span>ონლაინ</span>
                            <span className="text-xs text-gray-400">— დისტანციური</span>
                          </div>
                        )}
                        {tutor.is_offline && (tutor.location_rule === "student_comes" || tutor.location_rule === "both_ways") && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="w-5 text-center text-base">🏫</span>
                            <span>სტუდენტი მოდის ჩემთან</span>
                          </div>
                        )}
                        {tutor.is_offline && (tutor.location_rule === "tutor_goes" || tutor.location_rule === "both_ways") && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="w-5 text-center text-base">🚗</span>
                            <span>მე მივდივარ სტუდენტთან</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Target levels */}
                  {tutor.target_levels?.length > 0 && (
                    <div>
                      <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">სასწავლო საფეხური</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id:"school",     label:"სკოლა",        icon:"🎒" },
                          { id:"applicant",  label:"აბიტურიენტი",  icon:"📝" },
                          { id:"university", label:"სტუდენტი",     icon:"🎓" },
                          { id:"adult",      label:"ზრდასრული",    icon:"💼" },
                        ].filter(l => tutor.target_levels.includes(l.id)).map(l => (
                          <span key={l.id} className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium">
                            {l.icon} {l.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {tutor.teaching_languages?.length > 0 && (
                    <div>
                      <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">სწავლების ენა</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id:"ka", label:"ქართული",  flag:"🇬🇪" },
                          { id:"en", label:"ინგლისური", flag:"🇬🇧" },
                          { id:"ru", label:"რუსული",   flag:"🇷🇺" },
                        ].filter(l => tutor.teaching_languages.includes(l.id)).map(l => (
                          <span key={l.id} className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium">
                            {l.flag} {l.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Packages */}
                  {tutor.accepts_packages && (
                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-xs text-blue-700 font-medium flex items-center gap-2">
                      📦 ყოველთვიური პაკეტი ხელმისაწვდომია
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
