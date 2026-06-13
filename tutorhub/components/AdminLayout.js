"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const NAV = [
  { icon: "📊", label: "მთავარი",       href: "/dashboard/admin" },
  { icon: "👨‍🏫", label: "მასწავლებლები", href: "/dashboard/admin/tutors" },
  { icon: "🎓", label: "სტუდენტები",    href: "/dashboard/admin/students" },
  { icon: "📅", label: "ჯავშნები",      href: "/dashboard/admin/bookings" },
  { icon: "💰", label: "გადახდები",     href: "/dashboard/admin/payments" },
  { icon: "⭐", label: "შეფასებები",    href: "/dashboard/admin/reviews" },
  { icon: "⚖️", label: "დავები",        href: "/dashboard/admin/disputes" },
  { icon: "🎥", label: "ჩანაწ. (24სთ)", href: "/dashboard/admin/recordings" },
  { icon: "⚙️", label: "პარამეტრები",  href: "/dashboard/admin/settings" },
];

export default function AdminLayout({ children, adminName = "ადმინი" }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  function isActive(href) {
    if (href === "/dashboard/admin") return pathname === href;
    return pathname.startsWith(href);
  }

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full py-6">
        <Link href="/" className="text-lg font-black px-6 mb-6 block">
          Tutor<span className="text-emerald-600">Hub</span>
        </Link>

        <div className="flex items-center gap-3 px-4 py-3 mx-3 mb-4 bg-red-50 rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold shrink-0">
            {adminName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{adminName}</p>
            <p className="text-xs text-red-500 font-medium">🔐 Admin</p>
          </div>
        </div>

        <nav className="space-y-0.5 flex-1 px-1">
          {NAV.map(({ icon, label, href }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={isActive(href) ? "sidebar-item-active" : "sidebar-item"}>
              <span>{icon}</span> {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-100 pt-3 mt-3 px-1">
          <button onClick={signOut}
            className="sidebar-item text-red-400 w-full text-left">
            🚪 გასვლა
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-60 bg-white border-r border-gray-100 shrink-0 sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-white z-50 overflow-y-auto">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="text-xl p-1">☰</button>
          <span className="font-black text-sm">Admin Panel</span>
          <div className="w-8" />
        </div>
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
