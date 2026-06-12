"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";

const TODAY_BOOKINGS = [
  { id:"1", student:"ანა კახიძე", subject:"მათემატიკა", time:"10:00", format:"ონლაინ", dur:"1სთ", status:"confirmed" },
  { id:"2", student:"ლევან მეფარიშვილი", subject:"ალგებრა", time:"13:00", format:"ოფლაინ", dur:"1.5სთ", status:"confirmed" },
  { id:"3", student:"სოფო თოდუა", subject:"გეომეტრია", time:"17:00", format:"ონლაინ", dur:"1სთ", status:"pending" },
];

const REVIEWS = [
  { name:"ანა კ.", stars:5, text:"ძალიან კარგი მასწავლებელია!", date:"2 კვირის წინ" },
  { name:"ლევან მ.", stars:5, text:"პაციენტური და გამოცდილი.", date:"1 თვის წინ" },
  { name:"სოფო თ.", stars:4, text:"კარგი გაკვეთილები.", date:"2 თვის წინ" },
];

const WEEK_INCOME = [42, 70, 52, 87, 105, 35, 0];
const WEEK_DAYS = ["ორ", "სამ", "ოთ", "ხუთ", "პარ", "შაბ", "კვი"];
const MAX_INCOME = Math.max(...WEEK_INCOME);

const NAV_ITEMS = [
  { icon:"📊", label:"მთავარი",        href:"/dashboard/tutor" },
  { icon:"📅", label:"ჯავშნები",       href:"/dashboard/tutor/bookings" },
  { icon:"✉️", label:"შეტყობინებები", href:"/dashboard/tutor/messages" },
  { icon:"🕐", label:"განრიგი",        href:"/dashboard/tutor/schedule" },
  { icon:"⭐", label:"შეფასებები",     href:"/dashboard/tutor/reviews" },
  { icon:"💰", label:"შემოსავლები",    href:"/dashboard/tutor/income" },
  { icon:"👤", label:"პროფილი",        href:"/dashboard/tutor/profile" },
];

const DEFAULT_STATS = { revenue: 840, lessons: 24, students: 11, rating: 4.9 };

export default function TutorDashboardPage() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [tutorName, setTutorName] = useState("გიორგი");
  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();

          if (profile?.full_name) {
            setTutorName(profile.full_name.split(" ")[0]);
          }
          // TODO: რეალური სტატისტიკა bookings ცხრილიდან
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        setStats(DEFAULT_STATS);
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">

      {/* Sidebar */}
      <aside className="hidden md:flex bg-white border-r border-gray-100 flex-col py-6">
        <Link href="/" className="text-lg font-black px-6 mb-6 block">
          Tutor<span className="text-emerald-600">Hub</span>
        </Link>

        <div className="flex items-center gap-3 px-4 py-3 mx-3 mb-4 bg-gray-50 rounded-2xl">
          <div className="avatar w-10 h-10 avatar-green text-sm">
            {tutorName.slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold">{tutorName}</p>
            <p className="text-xs text-emerald-600 font-medium">✓ ვერიფ. მასწ.</p>
          </div>
        </div>

        <nav className="space-y-0.5 flex-1">
          {NAV_ITEMS.map(({ icon, label, href }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "sidebar-item-active" : "sidebar-item"}
            >
              <span>{icon}</span> {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-100 pt-3 mt-3">
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="sidebar-item text-red-400 w-full text-left"
          >
            🚪 გასვლა
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              გამარჯობა, {tutorName} 👋
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date().toLocaleDateString("ka-GE", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
            </p>
          </div>
          <button className="btn-primary">+ განრიგის დამატება</button>
        </div>

        {/* Metrics */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="stat-card animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-7 bg-gray-200 rounded w-1/2 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              [`${stats.revenue}₾`, "ამ თვის შემოსავ.", "↑ 12%"],
              [stats.lessons,       "გაკვეთილი (თვე)", "↑ 3"],
              [stats.students,      "აქტ. სტუდენტი",   "↑ 2 ახალი"],
              [stats.rating,        "რეიტინგი",         "142 შეფ."],
            ].map(([v, l, d], i) => (
              <div key={i} className="stat-card">
                <p className="text-xs text-gray-400 mb-1">{l}</p>
                <p className="text-2xl font-black text-gray-900">{v}</p>
                <p className="text-xs text-emerald-600 mt-0.5">{d}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">

          {/* დღევანდელი ჯავშნები */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">დღევანდელი ჯავშნები</h2>
              <span className="badge-green">{TODAY_BOOKINGS.length} გაკვეთ.</span>
            </div>
            <div className="space-y-2.5">
              {TODAY_BOOKINGS.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-400 w-10 text-center flex-shrink-0 font-medium">
                    {b.time}
                  </div>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${b.format === "ონლაინ" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{b.student}</p>
                    <p className="text-xs text-gray-400">{b.subject} · {b.format} · {b.dur}</p>
                  </div>
                  <span className={b.status === "confirmed" ? "badge-green text-xs" : "badge-blue text-xs"}>
                    {b.status === "confirmed" ? "დადასტ." : "მოლოდ."}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* კვირის შემოსავალი */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">კვირის შემოსავალი</h2>
              <span className="text-lg font-black text-emerald-600">
                {WEEK_INCOME.reduce((a, b) => a + b, 0)}₾
              </span>
            </div>
            <div className="flex items-end gap-1.5 h-24 mb-2">
              {WEEK_INCOME.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: MAX_INCOME > 0 ? `${(v / MAX_INCOME) * 100}%` : "0%",
                      minHeight: v > 0 ? "4px" : "0",
                      backgroundColor: i === 4 ? "#059669" : "#D1FAE5",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              {WEEK_DAYS.map((d, i) => (
                <div key={i} className="flex-1 text-center text-xs text-gray-400">{d}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">

          {/* შეფასებები */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">ბოლო შეფასებები</h2>
              <Link href="/dashboard/tutor/reviews" className="text-sm text-emerald-600">
                ყველა →
              </Link>
            </div>
            <div className="space-y-3">
              {REVIEWS.map(r => (
                <div key={r.name} className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold">{r.name}</span>
                    <div className="flex gap-0.5">
                      {Array(5).fill(0).map((_, i) => (
                        <span key={i} className={`text-xs ${i < r.stars ? "star" : "text-gray-200"}`}>★</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{r.text}</p>
                  <p className="text-xs text-gray-300 mt-1">{r.date}</p>
                </div>
              ))}
            </div>
          </div>

          {/* კვირის განრიგი */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">კვირის განრიგი</h2>
              <button className="text-sm text-emerald-600">შეცვლა →</button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_DAYS.map((d, i) => (
                <div key={i} className="text-center text-xs text-gray-400 mb-1">{d}</div>
              ))}
              {[
                ["on","busy","on"],
                ["on","on","on"],
                ["busy","on","on"],
                ["on","busy","on"],
                ["on","on","busy"],
                ["on","on",""],
                ["","",""],
              ].map((col, ci) => (
                <div key={ci} className="flex flex-col gap-1">
                  {col.map((slot, si) => (
                    <div key={si} className={`h-5 rounded text-center text-xs flex items-center justify-center ${
                      slot === "on"   ? "bg-emerald-100 text-emerald-700" :
                      slot === "busy" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-50"
                    }`} />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded bg-emerald-100 inline-block" />თავისუფ.
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded bg-amber-100 inline-block" />დაჯავშ.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}