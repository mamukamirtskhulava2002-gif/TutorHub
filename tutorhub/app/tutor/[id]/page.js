"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
import DashboardSidebar from "@/components/DashboardSidebar";
import { getTutorCoords } from "@/lib/geo-data";

const TutorMap = dynamic(() => import("@/components/TutorMap"), { ssr: false });

const AVATAR_COLORS = ["avatar-green","avatar-blue","avatar-amber","avatar-purple","avatar-coral"];

function getInitials(name) {
  if (!name) return "??";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
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

export default function TutorProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [tutor, setTutor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState("student");
  const [studentName, setStudentName] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();

        if (profileData?.full_name) setStudentName(profileData.full_name);
        if (profileData?.role) setUserRole(profileData.role);
      }

      const { data: tutorData } = await supabase
        .from("tutors")
        .select(`
          id, subject, rating, review_count,
          experience_years, is_online, is_offline, is_verified,
          city, bio,
          tagline, target_levels, teaching_languages,
          location_rule, accepts_packages,
          trial_duration, trial_price,
          region_id, municipality_id,
          intro_video_url,
          exact_lat, exact_lng,
          schedule,
          profiles(full_name, avatar_url)
        `)
        .eq("id", id)
        .single();

      if (!tutorData) { router.push("/search"); return; }
      setTutor(tutorData);

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("id, rating, text, created_at, profiles(full_name)")
        .eq("tutor_id", id)
        .order("created_at", { ascending: false })
        .limit(5);

      setReviews(reviewsData || []);

      if (user) {
        const { data: fav } = await supabase
          .from("favorites")
          .select("id")
          .eq("student_id", user.id)
          .eq("tutor_id", id)
          .single();
        setIsFavorite(!!fav);
      }

      setLoading(false);
    }
    if (id) fetchData();
  }, [id]);

  async function toggleFavorite() {
    if (!currentUser) { router.push("/auth"); return; }
    const supabase = createClient();
    if (isFavorite) {
      await supabase.from("favorites")
        .delete()
        .eq("student_id", currentUser.id)
        .eq("tutor_id", id);
      setIsFavorite(false);
    } else {
      await supabase.from("favorites")
        .insert({ student_id: currentUser.id, tutor_id: id });
      setIsFavorite(true);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">იტვირთება...</p>
      </div>
    );
  }

  if (!tutor) return null;

  const initials = getInitials(tutor.profiles?.full_name);
  const color = AVATAR_COLORS[0];

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Sidebar */}
      {currentUser && (
        <DashboardSidebar role={userRole} userName={studentName} />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
          <div className="px-6 flex items-center justify-between h-16">
            <Link
              href="/search"
              className="text-gray-400 hover:text-gray-600 flex items-center gap-2 text-sm"
            >
              ← ძებნაზე დაბრუნება
            </Link>
            <Link href="/" className="text-lg font-black">
              Tutor<span className="text-emerald-600">Hub</span>
            </Link>
            <div className="w-24" />
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-8 grid md:grid-cols-[1fr_340px] gap-8 items-start">

          {/* მარცხენა */}
          <div className="space-y-6">

            {/* პროფილი */}
            <div className="card p-6">
              <div className="flex items-start gap-5">
                <div
                  onClick={() => tutor.profiles?.avatar_url && setPhotoOpen(true)}
                  className={`avatar w-20 h-20 text-2xl ${color} flex-shrink-0 overflow-hidden ${tutor.profiles?.avatar_url ? "cursor-zoom-in hover:opacity-90 transition-opacity" : ""}`}
                >
                  {tutor.profiles?.avatar_url
                    ? <img src={tutor.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    : initials
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h1 className="text-2xl font-black text-gray-900">
                        {tutor.profiles?.full_name}
                      </h1>
                      {tutor.tagline && (
                        <p className="text-sm text-gray-500 mt-0.5 italic">"{tutor.tagline}"</p>
                      )}
                      <p className="text-gray-400 text-sm mt-0.5">
                        {tutor.subject?.join(", ")}
                        {tutor.experience_years ? ` · ${tutor.experience_years} წლიანი გამოცდ.` : ""}
                      </p>
                    </div>
                    <button
                      onClick={toggleFavorite}
                      className={`text-2xl transition-all flex-shrink-0 ${
                        isFavorite ? "text-red-500" : "text-gray-300 hover:text-red-400"
                      }`}
                    >
                      {isFavorite ? "❤️" : "🤍"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {tutor.is_verified && <span className="badge-green">✓ ვერიფიცირებული</span>}
                    {tutor.is_online && <span className="badge-blue">🌐 ონლაინ</span>}
                    {tutor.is_offline && <span className="badge-amber">🏫 პირისპირ</span>}
                    {tutor.subject?.map(s => (
                      <span key={s} className="badge-gray">{s}</span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-1">
                      <span className="text-amber-400">⭐</span>
                      <span className="font-bold text-sm">{tutor.rating ?? "—"}</span>
                      <span className="text-gray-400 text-xs">
                        ({tutor.review_count ?? 0} შეფასება)
                      </span>
                    </div>
                    {tutor.city && (
                      <span className="text-gray-400 text-xs">📍 {tutor.city}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ბიო */}
            {tutor.bio && (
              <div className="card p-6">
                <h2 className="font-bold text-gray-900 mb-3">📋 ჩემ შესახებ</h2>
                <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-wrap">{tutor.bio}</p>
              </div>
            )}

            {/* ვიდეო-წარდგენა */}
            {tutor.intro_video_url && (
              <div className="card p-6">
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

            {/* სწავლების დეტალები */}
            {(tutor.is_online || tutor.is_offline || tutor.target_levels?.length > 0 || tutor.teaching_languages?.length > 0) && (
              <div className="card p-6">
                <h2 className="font-bold text-gray-900 mb-4">🎓 სწავლების დეტალები</h2>
                <div className="space-y-4">

                  {/* ფორმატი */}
                  {(tutor.is_online || tutor.is_offline) && (
                    <div>
                      <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">ფორმატი</p>
                      <div className="space-y-1.5">
                        {tutor.is_online && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="w-5 text-center">💻</span>
                            <span>ონლაინ</span>
                            <span className="text-xs text-gray-400">— დისტანციური</span>
                          </div>
                        )}
                        {tutor.is_offline && (tutor.location_rule === "student_comes" || tutor.location_rule === "both_ways") && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="w-5 text-center">🏫</span>
                            <span>სტუდენტი მოდის ჩემთან</span>
                          </div>
                        )}
                        {tutor.is_offline && (tutor.location_rule === "tutor_goes" || tutor.location_rule === "both_ways") && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="w-5 text-center">🚗</span>
                            <span>მე მივდივარ სტუდენტთან</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* სასწავლო საფეხური */}
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
                          <span key={l.id} className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg font-medium">
                            {l.icon} {l.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* სწავლების ენა */}
                  {tutor.teaching_languages?.length > 0 && (
                    <div>
                      <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">სწავლების ენა</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id:"ka", label:"ქართული",  flag:"🇬🇪" },
                          { id:"en", label:"ინგლისური", flag:"🇬🇧" },
                          { id:"ru", label:"რუსული",   flag:"🇷🇺" },
                        ].filter(l => tutor.teaching_languages.includes(l.id)).map(l => (
                          <span key={l.id} className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg font-medium">
                            {l.flag} {l.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* პაკეტი */}
                  {tutor.accepts_packages && (
                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-xs text-blue-700 font-medium">
                      📦 ყოველთვიური პაკეტი ხელმისაწვდომია
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* მდებარეობის რუკა — მხოლოდ თუ მასწავლებელმა ზუსტი ლოკაცია მონიშნა */}
            {tutor.exact_lat && tutor.exact_lng && (
              <div className="card p-6">
                <h2 className="font-bold text-gray-900 mb-4">📍 მდებარეობა</h2>
                <TutorMap
                  height="280px"
                  singleMode
                  tutors={[{
                    id:   tutor.id,
                    name: tutor.profiles?.full_name || "მასწავლებელი",
                    city: tutor.city,
                    lat:  tutor.exact_lat,
                    lng:  tutor.exact_lng,
                  }]}
                />
              </div>
            )}

            {/* შეფასებები */}
            <div className="card p-6">
              <h2 className="font-bold text-gray-900 mb-4">
                ⭐ შეფასებები ({tutor.review_count ?? 0})
              </h2>
              {reviews.length === 0 ? (
                <p className="text-gray-400 text-sm">შეფასებები ჯერ არ არის</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map(review => (
                    <div key={review.id} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">
                          {review.profiles?.full_name}
                        </span>
                        <div className="flex gap-0.5">
                          {Array(5).fill(0).map((_, i) => (
                            <span key={i} className={`text-sm ${
                              i < review.rating ? "text-amber-400" : "text-gray-200"
                            }`}>★</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{review.text}</p>
                      <p className="text-xs text-gray-300 mt-2">
                        {new Date(review.created_at).toLocaleDateString("ka-GE", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* მარჯვენა — Booking Card */}
          <div className="card p-6 sticky top-24">
            {(() => {
              const { ind, grp } = getSchedulePrices(tutor.schedule);
              if (!ind && !grp) return (
                <p className="text-sm text-gray-400 mb-3">ფასი: განრიგის მიხედვით</p>
              );
              return (
                <div className="mb-3 space-y-1.5">
                  {ind > 0 && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-gray-900">{ind} ₾</span>
                      <span className="text-sm text-gray-400">👤 ინდ. / სთ</span>
                    </div>
                  )}
                  {grp > 0 && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-emerald-600">{grp} ₾</span>
                      <span className="text-sm text-gray-400">👥 ჯგუფ. / სთ</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center gap-1 mb-5">
              <span className="text-amber-400 text-sm">⭐</span>
              <span className="text-sm font-medium">{tutor.rating ?? "—"}</span>
              <span className="text-gray-400 text-xs">
                · {tutor.review_count ?? 0} შეფასება
              </span>
            </div>

            <div className="space-y-2 mb-5">
              {tutor.is_online && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>💻</span> ონლაინ
                </div>
              )}
              {tutor.is_offline && (tutor.location_rule === "student_comes" || tutor.location_rule === "both_ways" || !tutor.location_rule) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>🏫</span> სტუდენტი მოდის ჩემთან
                </div>
              )}
              {tutor.is_offline && (tutor.location_rule === "tutor_goes" || tutor.location_rule === "both_ways") && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>🚗</span> მე მივდივარ სტუდენტთან
                </div>
              )}
              {tutor.trial_duration && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 rounded-lg px-2 py-1.5 border border-emerald-100">
                  <span>🎓</span>
                  საცდელი {tutor.trial_duration} წთ — {tutor.trial_price === 0 ? "უფასო" : `${tutor.trial_price} ₾`}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>📅</span> გაუქმება 24 სთ-ით ადრე
              </div>
            </div>

            <hr className="border-gray-100 mb-5" />

            <Link
              href={`/booking/${id}`}
              className="btn-primary w-full py-3 text-center block"
            >
              გაკვეთილის დაჯავშნა
            </Link>

            <button
              onClick={() => {
                if (!currentUser) { router.push("/auth"); return; }
                router.push(`/messages?user=${id}`);
              }}
              className="btn-secondary w-full py-3 mt-3"
            >
              💬 შეტყობინების გაგზავნა
            </button>
          </div>
        </div>
      </div>

      {/* Photo lightbox */}
      {photoOpen && tutor.profiles?.avatar_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPhotoOpen(false)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img
              src={tutor.profiles.avatar_url}
              alt={tutor.profiles?.full_name || ""}
              className="max-h-[85vh] max-w-[85vw] rounded-2xl shadow-2xl object-contain"
            />
            <button
              onClick={() => setPhotoOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-gray-700 text-sm font-bold shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
}