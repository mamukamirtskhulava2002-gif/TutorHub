import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import LandingNavbar from "@/components/LandingNavbar";
import MatchWidget from "@/components/landing/MatchWidget";
import AnimatedStats from "@/components/landing/AnimatedStats";
import EarningsCalculator from "@/components/landing/EarningsCalculator";
import { createSupabaseServer } from "@/lib/supabase-server";

// ─── Static data ───────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: "📍",
    title: "გეოგრაფიული ფილტრი",
    desc: "პირველი საქართველოში — მოძებნე მასწავლებელი კონკრეტულ სოფელში, მუნიციპალიტეტსა თუ ქალაქში.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: "🛡️",
    title: "Escrow გარანტია",
    desc: "შენი ფული ჩვენთანაა. მასწავლებელი თანხას მიიღებს მხოლოდ წარმატებული გაკვეთილის შემდეგ.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: "✅",
    title: "ვერიფიცირებული პედაგოგები",
    desc: "ყოველი მასწავლებელი გადის ჩვენს შიდა შემოწმებას — განათლება, გამოცდილება, ლიცენზია.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: "📅",
    title: "მოქნილი განრიგი",
    desc: "სამუშაო კალენდარი, პაკეტური გამოწერები, ავტომატური შეხსენებები — ყველაფერი ერთ ადგილას.",
    color: "bg-amber-50 text-amber-600",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "მოიძიე & გაფილტრე",
    desc: "გამოიყენე საგნის, ბიუჯეტის, ლოკაციისა და ფორმატის ფილტრები. ნახე ყოველი მასწავლებლის პროფილი, ვიდეო, რეიტინგი.",
    icon: "🔍",
  },
  {
    step: "02",
    title: "დაჯავშნე გაკვეთილი",
    desc: "დაათვალიერე ხელმისაწვდომი დრო, მონიშნე საათი. გადაიხადე უსაფრთხოდ ონლაინ — ფული ჩვენთანაა გაკვეთილამდე.",
    icon: "📅",
  },
  {
    step: "03",
    title: "ისწავლე. შეაფასე.",
    desc: "მასწავლებელმა ჩაატარა გაკვეთილი? შეაფასე პროცესი. დადებითი შეფასების შემთხვევაში, თანხა მასწავლებელს ჩაერიცხება. პრეტენზიის შემთხვევაში, გთხოვთ, მოგვმართოთ გაკვეთილის დასრულებიდან 24 საათის განმავლობაში.",
    icon: "🎓",
  },
];

const REVIEW_COLORS = [
  "bg-emerald-100 text-emerald-800",
  "bg-blue-100 text-blue-800",
  "bg-violet-100 text-violet-800",
];

const SUBJECTS_GRID = [
  { icon: "📐", label: "მათემატიკა" },
  { icon: "⚛️", label: "ფიზიკა" },
  { icon: "🧪", label: "ქიმია" },
  { icon: "🌿", label: "ბიოლოგია" },
  { icon: "📖", label: "ქართული" },
  { icon: "🇬🇧", label: "ინგლისური" },
  { icon: "🏛️", label: "ისტორია" },
  { icon: "💻", label: "პროგრამირება" },
];

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-800",
  "bg-blue-100 text-blue-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
];

function getInitials(name) {
  if (!name) return "??";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const supabase = await createSupabaseServer();

  // Redirect logged-in users to their dashboard
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      const dest = {
        tutor: "/dashboard/tutor", student: "/dashboard/student",
        parent: "/dashboard/parent", admin: "/dashboard/admin",
      }[profile?.role] ?? "/dashboard";
      redirect(dest);
    }
  } catch { /* not logged in — show landing */ }

  // Fetch real data
  let tutorsCount = 0, studentsCount = 0, featuredTutors = [];
  let recentReviews = [], avgRating = null, totalReviews = 0;

  try {
    const [
      { count: tc },
      { count: sc },
      { data: tutorsData },
      { data: reviewsData },
    ] = await Promise.all([
      supabase.from("tutors").select("*", { count: "exact", head: true }).eq("is_verified", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
      supabase.from("tutors")
        .select("id, subject, price_per_hour, rating, review_count, photo_url, city, is_online, is_offline, profiles!id(full_name, avatar_url)")
        .eq("is_verified", true)
        .order("rating", { ascending: false })
        .limit(6),
      // Real reviews for testimonials section
      supabase.from("reviews")
        .select("id, rating, comment, created_at, profiles!student_id(full_name), tutors!tutor_id(subject)")
        .eq("hidden", false)
        .not("comment", "is", null)
        .neq("comment", "")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    tutorsCount    = tc ?? 0;
    studentsCount  = sc ?? 0;
    featuredTutors = (tutorsData ?? []).map((t, i) => ({
      ...t,
      // profiles.avatar_url is always up-to-date (user edits it directly)
      photo_url:  t.profiles?.avatar_url || t.photo_url || null,
      initials:   getInitials(t.profiles?.full_name),
      colorClass: AVATAR_COLORS[i % AVATAR_COLORS.length],
    }));
    recentReviews  = reviewsData ?? [];

    // Compute average rating across all tutors that have reviews
    if (tutorsData?.length) {
      const withRatings = tutorsData.filter(t => t.review_count > 0);
      if (withRatings.length) {
        const sum    = withRatings.reduce((s, t) => s + (t.rating ?? 0) * (t.review_count ?? 0), 0);
        const count  = withRatings.reduce((s, t) => s + (t.review_count ?? 0), 0);
        totalReviews = count;
        avgRating    = count > 0 ? (sum / count).toFixed(1) : null;
      }
    }
  } catch (e) {
    console.error("Landing data fetch error:", e);
  }

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[92svh] md:min-h-[92vh] flex items-center overflow-hidden">
        {/* Background image */}
        {/* Mobile image — portrait, shows all 4 people */}
        <Image
          src="/hero-mobile.jpg"
          alt="TutorHub hero"
          fill
          className="object-cover object-top md:hidden"
          priority
        />
        {/* Desktop image */}
        <Image
          src="/hero2.jpg"
          alt="TutorHub hero"
          fill
          className="object-cover object-center hidden md:block"
          priority
        />
        {/* Overlay — mobile: uniform; desktop: left-heavy gradient */}
        <div className="absolute inset-0 bg-gray-950/50 md:hidden" />
        <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-gray-950/85 via-gray-950/60 to-gray-950/20" />
        {/* Subtle bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-16 pb-6 md:pt-28 md:pb-24">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-emerald-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-4 md:mb-8">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              საქართველოს #1 სასწავლო პლატფორმა
            </div>

            {/* H1 */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white mb-3 md:mb-6 leading-[1.05]">
              იპოვე{" "}
              <span className="relative inline-block">
                <span className="text-emerald-400 italic">სანდო</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" style={{height:"6px"}}>
                  <path d="M0 6 Q50 0 100 5 Q150 9 200 4" stroke="#34d399" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                </svg>
              </span>{" "}
              მასწავლებელი
            </h1>

            {/* Subheadline */}
            <p className="text-white/75 text-base sm:text-xl max-w-xl mb-4 md:mb-10 font-light leading-relaxed">
              ვერიფიცირებული მასწავლებლები ნებისმიერ საგანში.
              ონლაინ ან ადგილზე — შენთვის ხელსაყრელ დროს.
              <strong className="text-white font-semibold"> გარანტირებული</strong> გადახდის სისტემით.
            </p>

            {/* Match widget */}
            <div className="mb-4 md:mb-12">
              <MatchWidget />
              <p className="text-xs text-white/50 mt-2">
                რეგისტრაციის გარეშეც შეგიძლია ნახო მასწავლებლები ↑
              </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 md:gap-8">
              <AnimatedStats
                tutorsCount={tutorsCount}
                studentsCount={studentsCount}
                avgRating={avgRating}
                totalReviews={totalReviews}
                dark
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURED TUTORS ════════════════════════════════════════════════════ */}
      <section className="py-20 bg-gray-50/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">გამორჩეული მასწავლებლები</h2>
              <p className="text-gray-400 text-sm mt-1.5">ხელით შერჩეული, ვერიფიცირებული — ყველაზე მაღალი შეფასებით</p>
            </div>
            <Link href="/search" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
              ყველა ნახვა <span aria-hidden>→</span>
            </Link>
          </div>

          {featuredTutors.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-4xl mb-3">🚀</p>
              <p className="text-gray-500 font-medium">მასწავლებლები მალე დაემატებიანა</p>
              <p className="text-gray-400 text-sm mt-1">გამოაქვეყნე შენი პროფილი პირველი!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredTutors.map((t) => {
                const subjectList = Array.isArray(t.subject) ? t.subject : [t.subject].filter(Boolean);
                const formatTag = t.is_online && t.is_offline ? "ორივე"
                  : t.is_online ? "ონლაინ" : t.is_offline ? "პირისპირ" : null;

                return (
                  <Link href={`/tutor/${t.id}`} key={t.id}
                    className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-emerald-300 hover:shadow-lg transition-all duration-200 block">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-4">
                      {t.photo_url ? (
                        <img src={t.photo_url} alt={t.profiles?.full_name}
                          className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${t.colorClass}`}>
                          {t.initials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-gray-900 truncate">
                            {t.profiles?.full_name || "მასწავლებელი"}
                          </p>
                          <span className="text-emerald-500 text-xs flex-shrink-0" title="ვერიფიცირებული">✓</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {subjectList.slice(0, 2).join(" · ")}
                          {subjectList.length > 2 && ` +${subjectList.length - 2}`}
                        </p>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {subjectList.slice(0, 2).map(s => (
                        <span key={s} className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium">{s}</span>
                      ))}
                      {formatTag && (
                        <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">{formatTag}</span>
                      )}
                      {t.city && (
                        <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">📍 {t.city}</span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-1">
                        <span className="text-amber-400 text-sm">★</span>
                        <span className="text-sm font-semibold text-gray-900">{(t.rating || 0).toFixed(1)}</span>
                        <span className="text-xs text-gray-400">({t.review_count || 0})</span>
                      </div>
                      <div>
                        <span className="text-base font-black text-gray-900">{t.price_per_hour}₾</span>
                        <span className="text-xs text-gray-400 font-normal"> /სთ</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="text-center mt-8">
            <Link href="/search" className="inline-flex items-center gap-2 border border-gray-200 bg-white text-gray-700 font-semibold px-7 py-3 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-sm">
              ნახე ყველა მასწავლებელი
              <span className="text-gray-400">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-3">როგორ მუშაობს</h2>
            <p className="text-gray-400 max-w-md mx-auto text-sm">სამი ნაბიჯი — და შეგიძლია დაიწყო სწავლა</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connector line — desktop only */}
            <div className="hidden md:block absolute top-10 left-[22%] right-[22%] h-0.5 bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-200 -z-0" />

            {HOW_IT_WORKS.map((s, i) => (
              <div key={i} className="relative bg-white border border-gray-100 rounded-2xl p-7 hover:shadow-md transition-shadow z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    {s.icon}
                  </div>
                  <span className="text-4xl font-black text-gray-900 tabular-nums">{s.step}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-base">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed font-light">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WHY TUTORHUB ══════════════════════════════════════════════════════ */}
      <section className="py-20 bg-gray-50/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-3">რატომ TutorHub?</h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">ის, რაც სხვა პლატფორმებს არ აქვს</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 flex gap-4 hover:shadow-md transition-shadow">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${f.color}`}>
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed font-light">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOR TUTORS + CALCULATOR ═══════════════════════════════════════════ */}
      <section id="for-tutors" className="py-20 bg-emerald-700 relative overflow-hidden">
        {/* Bg decoration */}
        <div className="absolute inset-0 -z-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-400 rounded-full" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-emerald-500 rounded-full" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                👨‍🏫 მასწავლებლებისთვის
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-5">
                გაიმრავლე შემოსავალი.
                <br />
                <span className="text-emerald-200">თავად განსაზღვრე წესები.</span>
              </h2>
              <p className="text-emerald-100 text-base font-light leading-relaxed mb-8">
                ასწავლე ონლაინ ან ადგილზე, დააწესე საკუთარი ტარიფი, მართე განრიგი.
                TutorHub ზრუნავს გადახდაზე, ჯავშნებზე და სტუდენტების მოძიებაზე.
                შენ — ისწავლებ.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  ["0%", "Subscription"],
                  ["24/7", "სტუდენტები"],
                  ["100%", "კონტროლი"],
                ].map(([num, lbl]) => (
                  <div key={lbl} className="text-center">
                    <div className="text-2xl font-black text-white">{num}</div>
                    <div className="text-xs text-emerald-200 mt-0.5">{lbl}</div>
                  </div>
                ))}
              </div>

              <Link href="/register?role=tutor"
                className="inline-flex items-center gap-2 bg-white text-emerald-700 font-bold px-7 py-3.5 rounded-xl hover:bg-emerald-50 transition-colors active:scale-95">
                დაიწყე სწავლება დღესვე →
              </Link>
            </div>

            {/* Right — calculator */}
            <div>
              <EarningsCalculator />
            </div>
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS — shown only when real reviews exist ════════════════ */}
      {recentReviews.length > 0 && (
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-3">სტუდენტები ამბობენ</h2>
              {avgRating && totalReviews > 0 && (
                <>
                  <div className="flex items-center justify-center gap-1 text-amber-400 text-lg mb-1">
                    {"★".repeat(Math.round(Number(avgRating)))}
                  </div>
                  <p className="text-gray-400 text-sm">{avgRating} / 5 — {totalReviews} შეფასება</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentReviews.map((r, i) => {
                const name     = r.profiles?.full_name || "სტუდენტი";
                const initials = getInitials(name);
                const subject  = Array.isArray(r.tutors?.subject)
                  ? r.tutors.subject[0]
                  : r.tutors?.subject ?? "";
                const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);

                return (
                  <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex text-amber-400 text-sm gap-0.5 mb-4">{stars}</div>
                    <p className="text-gray-600 text-sm leading-relaxed font-light flex-1 mb-5">
                      &ldquo;{r.comment}&rdquo;
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${REVIEW_COLORS[i % REVIEW_COLORS.length]}`}>
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{name}</p>
                        {subject && <p className="text-xs text-gray-400">{subject}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══ SUBJECTS GRID ═════════════════════════════════════════════════════ */}
      <section className="py-16 bg-gray-50/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">პოპულარული საგნები</h2>
            <p className="text-gray-400 text-sm">ყველა ასაკის სტუდენტისთვის</p>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {SUBJECTS_GRID.map(({ icon, label }) => (
              <Link key={label} href={`/search?subject=${label}`}
                className="group flex flex-col items-center gap-2 p-4 bg-white border border-gray-100 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50 transition-all">
                <span className="text-2xl">{icon}</span>
                <span className="text-xs font-medium text-gray-600 group-hover:text-emerald-700 text-center leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ═════════════════════════════════════════════════════════ */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-900 rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 -z-0 opacity-20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-4">
                დაიწყე ახლავე — უფასოა
              </p>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
                მზად ხარ შემდეგ<br />დონეზე ასასვლელად?
              </h2>
              <p className="text-gray-400 text-base mb-10 font-light max-w-md mx-auto">
                გახსენი ანგარიში, იპოვე შენი მასწავლებელი და დაიწყე სწავლა — სულ 5 წუთში.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/register"
                  className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-xl transition-colors active:scale-95 text-base">
                  სტუდენტად რეგისტრაცია →
                </Link>
                <Link href="/register?role=tutor"
                  className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-xl transition-colors active:scale-95 text-base border border-white/20">
                  გახდი მასწავლებელი
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="sm:col-span-2">
              <Link href="/" className="font-black text-xl text-gray-900 block mb-3">
                Tutor<span className="text-emerald-600">Hub</span>
              </Link>
              <p className="text-sm text-gray-400 font-light leading-relaxed max-w-xs">
                საქართველოს პირველი ვერიფიცირებული კერძო მასწავლებლების პლატფორმა.
                ისწავლე უსაფრთხოდ, ნდობით.
              </p>
              <div className="flex items-center gap-3 mt-4">
                {[
                  { label: "FB", href: "#" },
                  { label: "IG", href: "#" },
                  { label: "LI", href: "#" },
                ].map(s => (
                  <a key={s.label} href={s.href}
                    className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                    {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">პლატფორმა</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { href: "/search", label: "მასწავლებლების ძებნა" },
                  { href: "/register", label: "სტუდენტის რეგისტრაცია" },
                  { href: "/register?role=tutor", label: "მასწ. რეგისტრაცია" },
                  { href: "/auth", label: "შესვლა" },
                ].map(l => (
                  <Link key={l.href} href={l.href}
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-light">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">კომპანია</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { href: "/about", label: "ჩვენ შესახებ" },
                  { href: "/terms", label: "სარგებლობის წესები" },
                  { href: "/privacy", label: "კონფიდ. პოლიტიკა" },
                  { href: "/contact", label: "კონტაქტი" },
                ].map(l => (
                  <Link key={l.href} href={l.href}
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-light">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400">© 2026 TutorHub Georgia. ყველა უფლება დაცულია.</p>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                ყველა სისტემა მუშაობს
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
