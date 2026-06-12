"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const ROLE_DASHBOARD = {
  tutor:   "/dashboard/tutor",
  student: "/dashboard/student",
  parent:  "/dashboard/parent",
  admin:   "/dashboard/admin",
};

const ROLE_NAV = {
  student: [
    { href: "/search",                      label: "🔍 მასწავლებლები" },
    { href: "/dashboard/student/lessons",   label: "📅 გაკვეთილები" },
    { href: "/messages",                    label: "💬 შეტყობინებები" },
    { href: "/favorites",                   label: "❤️ ფავორიტები" },
  ],
  tutor: [
    { href: "/dashboard/tutor",             label: "📊 დაშბორდი" },
    { href: "/dashboard/tutor/bookings",    label: "📅 ჯავშნები" },
    { href: "/dashboard/tutor/messages",    label: "💬 შეტყობინებები" },
    { href: "/dashboard/tutor/schedule",    label: "🕐 განრიგი" },
  ],
  parent: [
    { href: "/dashboard/parent",            label: "📊 დაშბორდი" },
    { href: "/dashboard/parent/children",   label: "👶 შვილები" },
    { href: "/dashboard/parent/lessons",    label: "📅 გაკვეთილები" },
    { href: "/dashboard/parent/payments",   label: "💳 გადახდები" },
  ],
  admin: [
    { href: "/dashboard/admin",             label: "📊 მთავარი" },
    { href: "/dashboard/admin/tutors",      label: "👨‍🏫 მასწავლებლები" },
    { href: "/dashboard/admin/students",    label: "🎓 სტუდენტები" },
    { href: "/dashboard/admin/bookings",    label: "📅 ჯავშნები" },
  ],
};

const GUEST_NAV = [
  { href: "/search",          label: "მასწავლებლები" },
  { href: "/register?role=tutor", label: "გახდი მასწავლებელი" },
];

const ROLE_LABELS = {
  tutor:   "👨‍🏫 მასწავლებელი",
  student: "🎓 სტუდენტი",
  parent:  "👨‍👩‍👧 მშობელი",
  admin:   "🔐 Admin",
};

export default function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser(sessionUser) {
      if (!sessionUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      setUser(sessionUser);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sessionUser.id)
        .single();

      setRole(profile?.role || null);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // route ცვლილებისას mobile menu დახურვა
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const dashboardHref = ROLE_DASHBOARD[role] || "/dashboard";
  const navLinks = user ? (ROLE_NAV[role] || []) : GUEST_NAV;

  return (
    <>
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="page-container flex items-center justify-between h-16">

          {/* ლოგო */}
          <Link
            href={user ? dashboardHref : "/"}
            className="text-xl font-black tracking-tight flex-shrink-0"
          >
            Tutor<span className="text-emerald-600">Hub</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-xl text-sm transition-all ${
                  path === href || path.startsWith(href + "/")
                    ? "text-emerald-600 bg-emerald-50 font-medium"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* მარჯვენა */}
          <div className="flex items-center gap-2">
            {loading ? (
              <div className="w-20 h-8 bg-gray-100 rounded-xl animate-pulse" />
            ) : user ? (
              <>
                {/* Role badge */}
                <span className="hidden sm:inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 text-gray-500">
                  {ROLE_LABELS[role] || "👤"}
                </span>

                {/* Desktop: dashboard + logout */}
                <Link href={dashboardHref} className="btn-secondary hidden sm:flex text-sm py-2 px-4">
                  დაშბორდი
                </Link>
                <button onClick={handleLogout} className="btn-primary text-sm py-2 px-4 hidden sm:flex">
                  გასვლა
                </button>

                {/* Mobile: hamburger */}
                <button
                  onClick={() => setMobileOpen(o => !o)}
                  className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500"
                >
                  {mobileOpen ? "✕" : "☰"}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-secondary hidden sm:flex text-sm py-2 px-4">
                  შესვლა
                </Link>
                <Link href="/register" className="btn-primary text-sm py-2 px-4">
                  რეგისტრაცია
                </Link>

                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileOpen(o => !o)}
                  className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500"
                >
                  {mobileOpen ? "✕" : "☰"}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* drawer */}
          <div className="absolute top-0 right-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">

            {/* header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <span className="font-black text-lg">
                Tutor<span className="text-emerald-600">Hub</span>
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                ✕
              </button>
            </div>

            {/* user info */}
            {user && (
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-400 mb-1">შესული ხარ როგორც</p>
                <p className="text-sm font-semibold text-gray-900">
                  {ROLE_LABELS[role] || "👤 მომხმარებელი"}
                </p>
              </div>
            )}

            {/* nav links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                    path === href || path.startsWith(href + "/")
                      ? "bg-emerald-50 text-emerald-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* footer */}
            <div className="p-4 border-t border-gray-100 space-y-2">
              {user ? (
                <>
                  <Link
                    href={dashboardHref}
                    className="btn-secondary w-full py-2.5 text-center text-sm block"
                  >
                    დაშბორდი
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-all"
                  >
                    🚪 გასვლა
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-secondary w-full py-2.5 text-center text-sm block">
                    შესვლა
                  </Link>
                  <Link href="/register" className="btn-primary w-full py-2.5 text-center text-sm block">
                    რეგისტრაცია →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}