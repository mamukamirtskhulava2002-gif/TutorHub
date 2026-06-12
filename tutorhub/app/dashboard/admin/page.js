"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AdminLayout from "@/components/AdminLayout";

const WEEK_DAYS = ["ორ","სამ","ოთხ","ხუთ","პარ","შაბ","კვი"];
const MONTHS    = ["იან","თებ","მარ","აპრ","მაი","ივნ","ივლ","აგვ","სექ","ოქტ","ნოე","დეკ"];

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [today, setToday]     = useState("");
  const [adminName, setAdminName] = useState("ადმინი");
  const [stats, setStats] = useState({
    totalStudents: 0, totalTutors: 0, totalBookings: 0, totalRevenue: 0,
    pendingTutors: 0, activeBookings: 0, reportedReviews: 0, openDisputes: 0,
  });
  const [recentBookings,  setRecentBookings]  = useState([]);
  const [pendingTutors,   setPendingTutors]   = useState([]);
  const [weeklyData,      setWeeklyData]      = useState(Array(7).fill(0));
  const [monthlyRevenue,  setMonthlyRevenue]  = useState(Array(12).fill(0));

  useEffect(() => {
    setToday(new Date().toLocaleDateString("ka-GE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }));
    fetchData();
  }, []);

  async function fetchData() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth"); return; }

    const { data: profile } = await supabase
      .from("profiles").select("role, full_name").eq("id", session.user.id).single();
    if (profile?.role !== "admin") { router.push("/dashboard"); return; }
    if (profile?.full_name) setAdminName(profile.full_name);

    const [
      { count: students },
      { count: tutors },
      { count: bookings },
      { count: pendingCount },
      { count: active },
      { count: reported },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count:"exact", head:true }).eq("role","student"),
      supabase.from("profiles").select("*", { count:"exact", head:true }).eq("role","tutor"),
      supabase.from("bookings").select("*", { count:"exact", head:true }),
      supabase.from("tutors").select("*",   { count:"exact", head:true }).eq("is_verified",false),
      supabase.from("bookings").select("*", { count:"exact", head:true }).in("status",["confirmed","pending"]),
      supabase.from("reviews").select("*",  { count:"exact", head:true }).eq("is_reported",true),
    ]);

    const { data: doneBookings } = await supabase
      .from("bookings").select("total_price, created_at").eq("status","done");

    const totalRevenue = doneBookings?.reduce((s, b) => s + (b.total_price || 0), 0) || 0;

    const monthly = Array(12).fill(0);
    doneBookings?.forEach(b => {
      const m = new Date(b.created_at).getMonth();
      monthly[m] += Math.round((b.total_price || 0) * 0.1);
    });
    setMonthlyRevenue(monthly);

    let openDisputes = 0;
    const { count: dc } = await supabase
      .from("bookings").select("*", { count:"exact", head:true }).eq("status","disputed");
    openDisputes = dc || 0;

    setStats({
      totalStudents: students || 0,
      totalTutors:   tutors   || 0,
      totalBookings: bookings || 0,
      totalRevenue,
      pendingTutors:   pendingCount || 0,
      activeBookings:  active  || 0,
      reportedReviews: reported || 0,
      openDisputes,
    });

    const { data: recentB } = await supabase
      .from("bookings")
      .select("id, status, created_at, total_price, profiles!student_id(full_name), tutors!tutor_id(profiles(full_name), subject)")
      .order("created_at", { ascending: false })
      .limit(6);
    setRecentBookings(recentB || []);

    const { data: unverified } = await supabase
      .from("tutors").select("id, subject, price_per_hour, profiles(full_name)")
      .eq("is_verified", false).limit(5);
    setPendingTutors(unverified || []);

    const weekly = Array(7).fill(0);
    const { data: weekB } = await supabase
      .from("bookings").select("created_at")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    weekB?.forEach(b => {
      const d = new Date(b.created_at).getDay();
      weekly[d === 0 ? 6 : d - 1]++;
    });
    setWeeklyData(weekly);

    setLoading(false);
  }

  async function approveTutor(id) {
    const supabase = createClient();
    await supabase.from("tutors").update({ is_verified: true }).eq("id", id);
    setPendingTutors(p => p.filter(t => t.id !== id));
    setStats(s => ({ ...s, pendingTutors: s.pendingTutors - 1 }));
  }

  async function rejectTutor(id) {
    if (!confirm("მასწავლებლის წაშლა?")) return;
    const supabase = createClient();
    await supabase.from("tutors").delete().eq("id", id);
    setPendingTutors(p => p.filter(t => t.id !== id));
    setStats(s => ({ ...s, pendingTutors: s.pendingTutors - 1 }));
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("ka-GE", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  const maxBar   = Math.max(...weeklyData, 1);
  const maxMonth = Math.max(...monthlyRevenue, 1);

  const statsCards = [
    { label: "სტუდენტები",     value: stats.totalStudents,  icon: "🎓", color: "text-blue-600",    bg: "bg-blue-50",    href: "/dashboard/admin/students" },
    { label: "მასწავლებლები",  value: stats.totalTutors,    icon: "👨‍🏫", color: "text-emerald-600", bg: "bg-emerald-50", href: "/dashboard/admin/tutors" },
    { label: "ჯავშნები სულ",  value: stats.totalBookings,  icon: "📅", color: "text-amber-600",   bg: "bg-amber-50",   href: "/dashboard/admin/bookings" },
    { label: "შემოსავალი",     value: `${stats.totalRevenue.toLocaleString("ka-GE")} ₾`, icon: "💰", color: "text-purple-600", bg: "bg-purple-50", href: "/dashboard/admin/payments" },
    { label: "აქტიური ჯავშ.", value: stats.activeBookings, icon: "✅", color: "text-emerald-600", bg: "bg-emerald-50", href: "/dashboard/admin/bookings" },
    { label: "დაუდასტ. მასწ.", value: stats.pendingTutors,  icon: "⏳", color: "text-red-500",     bg: "bg-red-50",     href: "/dashboard/admin/tutors" },
    { label: "მოხ. შეფასება", value: stats.reportedReviews,icon: "🚩", color: "text-orange-500",  bg: "bg-orange-50",  href: "/dashboard/admin/reviews" },
    { label: "ღია დავები",    value: stats.openDisputes,   icon: "⚖️", color: "text-indigo-600",  bg: "bg-indigo-50",  href: "/dashboard/admin/disputes" },
  ];

  return (
    <AdminLayout adminName={adminName}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">📊 Admin Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {stats.pendingTutors > 0 && (
            <Link href="/dashboard/admin/tutors" className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors">
              ⚠️ {stats.pendingTutors} მასწ. ელის
            </Link>
          )}
          {stats.openDisputes > 0 && (
            <Link href="/dashboard/admin/disputes" className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors">
              ⚖️ {stats.openDisputes} ღია დავა
            </Link>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {statsCards.map((s, i) => (
            <Link key={i} href={s.href} className="card p-5 hover:shadow-md transition-shadow block group">
              <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center text-lg mb-3`}>{s.icon}</div>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-1 group-hover:text-gray-600 transition-colors">{s.label}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4">📈 კვირის ჯავშნები</h2>
          <div className="flex items-end gap-2 h-28 mb-2">
            {weeklyData.map((v, i) => (
              <div key={i} className="flex-1 h-full flex items-end group relative">
                <div className="w-full rounded-t-md transition-all"
                  style={{ height: `${(v / maxBar) * 100}%`, minHeight: v > 0 ? "4px" : "0",
                    backgroundColor: i === (new Date().getDay() + 6) % 7 ? "#059669" : "#D1FAE5" }} />
                {v > 0 && (
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                    {v} ჯავშ.
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {WEEK_DAYS.map((d, i) => <div key={i} className="flex-1 text-center text-xs text-gray-400">{d}</div>)}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-1">💰 კომისიის შემოსავალი</h2>
          <p className="text-xs text-gray-400 mb-4">შეფასებული 10%-ის კომისიის მიხედვით</p>
          <div className="flex items-end gap-1 h-28 mb-2">
            {monthlyRevenue.map((v, i) => (
              <div key={i} className="flex-1 h-full flex items-end group relative">
                <div className="w-full rounded-t-md transition-all hover:opacity-80"
                  style={{ height: `${(v / maxMonth) * 100}%`, minHeight: v > 0 ? "4px" : "0",
                    backgroundColor: i === new Date().getMonth() ? "#7c3aed" : "#ede9fe" }} />
                {v > 0 && (
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                    ~{v} ₾
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {MONTHS.map((m, i) => <div key={i} className="flex-1 text-center text-[10px] text-gray-400">{m}</div>)}
          </div>
        </div>
      </div>

      {/* Pending tutors + recent bookings */}
      <div className="grid md:grid-cols-[1fr_2fr] gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">⏳ დასამტკიცებელი</h2>
            <Link href="/dashboard/admin/tutors" className="text-sm text-emerald-600 hover:underline">ყველა →</Link>
          </div>
          {loading ? <p className="text-sm text-gray-400">იტვირთება...</p> :
            pendingTutors.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm text-gray-400">ყველა დამტკიცებულია</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTutors.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {t.profiles?.full_name?.[0] || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{t.profiles?.full_name}</p>
                        <p className="text-xs text-gray-400">{t.price_per_hour} ₾/სთ</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => approveTutor(t.id)}
                        className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-all">✓</button>
                      <button onClick={() => rejectTutor(t.id)}
                        className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 font-medium transition-all">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">📅 ბოლო ჯავშნები</h2>
            <Link href="/dashboard/admin/bookings" className="text-sm text-emerald-600 hover:underline">ყველა →</Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : recentBookings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">ჯავშნები არ არის</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-3 font-medium">სტუდ.</th>
                    <th className="text-left pb-3 font-medium">მასწ.</th>
                    <th className="text-left pb-3 font-medium">თარიღი</th>
                    <th className="text-left pb-3 font-medium">სტ.</th>
                    <th className="text-right pb-3 font-medium">₾</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentBookings.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium">{b.profiles?.full_name?.split(" ")[0] || "—"}</td>
                      <td className="py-2.5 text-gray-600">{b.tutors?.profiles?.full_name?.split(" ")[0] || "—"}</td>
                      <td className="py-2.5 text-gray-400 text-xs">{formatDate(b.created_at)}</td>
                      <td className="py-2.5">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          b.status === "confirmed" ? "bg-emerald-50 text-emerald-700" :
                          b.status === "pending"   ? "bg-amber-50 text-amber-700" :
                          b.status === "done"      ? "bg-gray-100 text-gray-500" :
                          b.status === "disputed"  ? "bg-orange-50 text-orange-600" :
                          "bg-red-50 text-red-500"
                        }`}>
                          {b.status === "confirmed" ? "✓" :
                           b.status === "pending"   ? "?" :
                           b.status === "done"      ? "✓✓" :
                           b.status === "disputed"  ? "⚖" : "✕"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-black">{b.total_price} ₾</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
