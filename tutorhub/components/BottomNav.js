"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

// role-ის მიხედვით ნავიგაციის ელემენტები
const NAV_BY_ROLE = {
  student: [
    { href: "/dashboard/student",          icon: "🏠", label: "მთავარი" },
    { href: "/search",                      icon: "🔍", label: "ძებნა" },
    { href: "/messages",                    icon: "💬", label: "ჩატი" },
    { href: "/dashboard/student/lessons",   icon: "📅", label: "გაკვეთ." },
    { href: "/dashboard/student/settings",  icon: "👤", label: "პროფილი" },
  ],
  tutor: [
    { href: "/dashboard/tutor",             icon: "🏠", label: "მთავარი" },
    { href: "/messages",                    icon: "💬", label: "ჩატი" },
    { href: "/dashboard/tutor/bookings",    icon: "📅", label: "ჯავშნები" },
    { href: "/dashboard/tutor/income",      icon: "💰", label: "შემოს." },
    { href: "/dashboard/tutor/profile",     icon: "👤", label: "პროფილი" },
  ],
  parent: [
    { href: "/dashboard/parent",            icon: "🏠", label: "მთავარი" },
    { href: "/dashboard/parent/children",   icon: "👨‍👩‍👧", label: "შვილები" },
    { href: "/messages",                    icon: "💬", label: "ჩატი" },
    { href: "/dashboard/parent/lessons",    icon: "📅", label: "გაკვეთ." },
    { href: "/dashboard/parent/settings",   icon: "👤", label: "პროფილი" },
  ],
  admin: [
    { href: "/dashboard/admin",             icon: "🏠", label: "მთავარი" },
    { href: "/dashboard/admin/tutors",      icon: "👨‍🏫", label: "მასწ." },
    { href: "/dashboard/admin/students",    icon: "🎓", label: "სტუდ." },
    { href: "/dashboard/admin/bookings",    icon: "📅", label: "ჯავშ." },
    { href: "/dashboard/admin/settings",    icon: "⚙️", label: "პარამ." },
  ],
};

// გვერდები სადაც bottom nav არ ჩანს
const HIDDEN_PATHS = ["/login", "/register", "/auth", "/onboarding"];

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingBookings, setPendingBookings] = useState(0);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role) setRole(profile.role);

        // წაუკითხავი შეტყობინებები
        const { count: msgCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .eq("is_read", false);
        if (msgCount) setUnreadMessages(msgCount);

        // მოლოდინში ჯავშნები (tutor-ისთვის)
        if (profile?.role === "tutor") {
          const { count: bookCount } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("tutor_id", user.id)
            .eq("status", "pending");
          if (bookCount) setPendingBookings(bookCount);
        }
      } catch (e) {
        // user not logged in
      }
    }
    init();
  }, [pathname]);

  // დამალვა გარკვეულ გვერდებზე
  if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return null;
  if (!role) return null;

  const items = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.student;

  function getBadge(item) {
    if (item.href === "/messages" && unreadMessages > 0) return unreadMessages;
    if (item.label === "ჯავშნები" && pendingBookings > 0) return pendingBookings;
    return null;
  }

  function isActive(href) {
    if (href === "/dashboard/student" || href === "/dashboard/tutor" ||
        href === "/dashboard/parent" || href === "/dashboard/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* ბოტომ ნავბარის სიმაღლის spacer */}
      <div className="h-20 md:hidden" aria-hidden="true" />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-100"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="ქვედა ნავიგაცია"
      >
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((item) => {
            const active = isActive(item.href);
            const badge = getBadge(item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                  active ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {/* Active indicator */}
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-500 rounded-full"
                    aria-hidden="true"
                  />
                )}

                {/* Icon + badge */}
                <div className="relative">
                  <span
                    className={`text-xl leading-none transition-transform ${
                      active ? "scale-110" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  {badge !== null && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
                      aria-label={`${badge} წაუკითხავი`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span className={`text-[10px] font-medium leading-none ${
                  active ? "text-emerald-600" : "text-gray-400"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}