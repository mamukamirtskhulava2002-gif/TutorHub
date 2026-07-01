"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Suspense } from "react";

const NAV_ITEMS = [
  { icon: "📊", label: "მთავარი",     href: "/dashboard/parent" },
  { icon: "👶", label: "ჩემი შვილები",  href: "/dashboard/parent/children" },
  { icon: "📅", label: "გაკვეთილები",   href: "/dashboard/parent/lessons" },
  { icon: "💬", label: "შეტყობინებები", href: "/dashboard/parent/messages" },
  { icon: "💳", label: "გადახდები",     href: "/dashboard/parent/payments" },
  { icon: "⚙️", label: "პარამეტრები",  href: "/dashboard/parent/settings" },
];

function LessonsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const childFilter = searchParams.get("child");

  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState("მშობელი");
  const [lessons, setLessons] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(childFilter || "");
  const [tab, setTab] = useState("upcoming");

  const tabs = [
    { key: "upcoming",  label: "მომავალი" },
    { key: "past",      label: "გასული" },
    { key: "cancelled", label: "გაუქმებული" },
  ];

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      // პროფილი
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "parent") { router.push("/dashboard"); return; }
      if (profile?.full_name) setParentName(profile.full_name.split(" ")[0]);

      // შვილები
      const { data: childrenData } = await supabase
        .from("parent_children")
        .select("id, profiles!child_id(id, full_name)")
        .eq("parent_id", user.id);

      const kids = childrenData || [];
      setChildren(kids);

      const childIds = selectedChild
        ? [selectedChild]
        : kids.map(c => c.profiles?.id).filter(Boolean);

      if (childIds.length === 0) {
        setLessons([]);
        setLoading(false);
        return;
      }

      const statusMap = {
        upcoming:  ["confirmed", "pending"],
        past:      ["done"],
        cancelled: ["cancelled"],
      };

      const { data } = await supabase
        .from("bookings")
        .select(`
          id, date, time_slot, duration_hours, format, status, total_price,
          profiles!student_id(full_name),
          tutors(id, subject, profiles(full_name))
        `)
        .in("student_id", childIds)
        .in("status", statusMap[tab])
        .order("date", { ascending: tab === "upcoming" });

      setLessons(data || []);
      setLoading(false);
    }
    fetchData();
  }, [tab, selectedChild, router]);

  function formatDate(date, time) {
    if (!date) return "";
    return new Date(`${date}T${time}`).toLocaleString("ka-GE", {
      weekday: "short", day: "numeric", month: "long",
      hour: "2-digit", minute: "2-digit",
    });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">

      {/* Sidebar */}
      <aside className="hidden md:flex bg-white border-r border-gray-100 flex-col py-6">
        <Link href="/" className="text-lg font-black px-6 mb-6 block">
          Tutor<span className="text-emerald-600">Hub</span>
        </Link>
        <div className="flex items-center gap-3 px-4 py-3 mx-3 mb-4 bg-gray-50 rounded-2xl">
          <div className="avatar w-10 h-10 avatar-blue text-sm">
            {parentName.slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold">{parentName}</p>
            <p className="text-xs text-blue-500 font-medium">👨‍👩‍👧 მშობელი</p>
          </div>
        </div>
        <nav className="space-y-0.5 flex-1">
          {NAV_ITEMS.map(({ icon, label, href }) => (
            <Link key={href} href={href}
              className={pathname === href ? "sidebar-item-active" : "sidebar-item"}>
              <span>{icon}</span> {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-100 pt-3 mt-3">
          <button onClick={handleSignOut} className="sidebar-item text-red-400 w-full text-left">
            🚪 გასვლა
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="p-6 md:p-8">
        <h1 className="text-2xl font-black text-gray-900 mb-6">📅 გაკვეთილები</h1>

        {/* შვილების ფილტრი */}
        {children.length > 1 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            <button
              onClick={() => setSelectedChild("")}
              className={`text-sm px-4 py-2 rounded-xl border transition-all ${
                selectedChild === ""
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-gray-200 text-gray-500 hover:border-emerald-300"
              }`}
            >
              ყველა შვილი
            </button>
            {children.map((child, i) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child.profiles?.id || "")}
                className={`text-sm px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
                  selectedChild === child.profiles?.id
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-gray-200 text-gray-500 hover:border-emerald-300"
                }`}
              >
                <span className={`avatar w-5 h-5 text-xs ${
                  ["avatar-blue","avatar-green","avatar-amber","avatar-purple"][i % 4]
                }`}>
                  {child.profiles?.full_name?.[0]}
                </span>
                {child.profiles?.full_name}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-100">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
                tab === t.key
                  ? "bg-white border border-b-white border-gray-100 text-emerald-600 -mb-px"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500 font-medium">გაკვეთილები არ არის</p>
            {tab === "upcoming" && (
              <Link href="/search" className="text-emerald-600 text-sm mt-2 block">
                მასწავლებლის პოვნა →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map(lesson => (
              <div key={lesson.id} className="card p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">

                  {/* სტუდენტი */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                      👶 {lesson.profiles?.full_name}
                    </span>
                  </div>

                  <p className="font-semibold text-gray-900">
                    {lesson.tutors?.subject?.[0]} —{" "}
                    <Link href={`/tutors/${lesson.tutors?.id}`} className="hover:underline hover:text-emerald-700">
                      {lesson.tutors?.profiles?.full_name}
                    </Link>
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {lesson.format === "online" ? "🌐 ონლაინ" : "🏫 პირისპირ"} · {lesson.duration_hours} სთ
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    📅 {formatDate(lesson.date, lesson.time_slot)}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-black text-gray-900">{lesson.total_price} ₾</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    lesson.status === "confirmed" ? "bg-emerald-50 text-emerald-700" :
                    lesson.status === "pending"   ? "bg-amber-50 text-amber-700" :
                    lesson.status === "done"      ? "bg-gray-100 text-gray-500" :
                    "bg-red-50 text-red-500"
                  }`}>
                    {lesson.status === "confirmed" ? "დადასტურებული" :
                     lesson.status === "pending"   ? "მოლოდინში" :
                     lesson.status === "done"      ? "დასრულებული" : "გაუქმებული"}
                  </span>

                  {lesson.status === "confirmed" && (
                    <Link
                      href={`/tutor/${lesson.tutors?.id}`}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      პროფილი
                    </Link>
                  )}

                  {/* 🛠️ აქ ჩაემატა რედაქტირების ღილაკი მოლოდინში მყოფი ჯავშნებისთვის */}
                  {lesson.status === "pending" && (
                    <Link
                      href={`/booking/${lesson.tutors?.id}?edit=${lesson.id}`}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      ✏️ შეცვლა
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ParentLessonsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">იტვირთება...</p>
      </div>
    }>
      <LessonsContent />
    </Suspense>
  );
}