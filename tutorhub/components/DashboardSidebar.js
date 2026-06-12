"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";

const NAV_BY_ROLE = {
  student: [
    { icon: "📊", label: "მთავარი",        href: "/dashboard/student" },
    { icon: "🔍", label: "ძებნა",           href: "/search" },
    { icon: "📅", label: "გაკვეთილები",    href: "/dashboard/student/lessons" },
    { icon: "📝", label: "დავალებები",     href: "/dashboard/student/tasks" },
    { icon: "🔄", label: "გამოწერები",     href: "/dashboard/student/subscriptions" },
    { icon: "💬", label: "შეტყობინებები",  href: "/messages" },
    { icon: "❤️", label: "შენახული",       href: "/favorites" },
    { icon: "💳", label: "გადახდები",      href: "/dashboard/student/payments" },
    { icon: "👤", label: "პროფილი",        href: "/dashboard/student/profile" },
    { icon: "⚙️", label: "პარამეტრები",   href: "/dashboard/student/settings" },
  ],
  tutor: [
    { icon: "📊", label: "მთავარი",        href: "/dashboard/tutor" },
    { icon: "📅", label: "ჯავშნები",       href: "/dashboard/tutor/bookings" },
    { icon: "📝", label: "დავალებები",     href: "/dashboard/tutor/tasks" },
    { icon: "💬", label: "შეტყობინებები",  href: "/dashboard/tutor/messages" },
    { icon: "🕐", label: "განრიგი",        href: "/dashboard/tutor/schedule" },
    { icon: "⭐", label: "შეფასებები",     href: "/dashboard/tutor/reviews" },
    { icon: "💰", label: "შემოსავლები",   href: "/dashboard/tutor/income" },
    { icon: "👤", label: "პროფილი",        href: "/dashboard/tutor/profile" },
    { icon: "🏆", label: "სერტიფიკაცია",  href: "/dashboard/tutor/verification" },
    { icon: "⚙️", label: "პარამეტრები",   href: "/dashboard/tutor/settings" },
  ],
  parent: [
    { icon: "📊", label: "მთავარი",        href: "/dashboard/parent" },
    { icon: "👨‍👩‍👧", label: "შვილები",      href: "/dashboard/parent/children" },
    { icon: "📅", label: "გაკვეთილები",    href: "/dashboard/parent/lessons" },
    { icon: "📝", label: "დავალებები",     href: "/dashboard/parent/tasks" },
    { icon: "💬", label: "შეტყობინებები",  href: "/messages" },
    { icon: "💳", label: "გადახდები",      href: "/dashboard/parent/payments" },
    { icon: "⚙️", label: "პარამეტრები",   href: "/dashboard/parent/settings" },
  ],
  admin: [
    { icon: "📊", label: "მთავარი",        href: "/dashboard/admin" },
    { icon: "👨‍🏫", label: "მასწავლებლები", href: "/dashboard/admin/tutors" },
    { icon: "🎓", label: "სტუდენტები",     href: "/dashboard/admin/students" },
    { icon: "📅", label: "ჯავშნები",       href: "/dashboard/admin/bookings" },
    { icon: "💳", label: "გადახდები",      href: "/dashboard/admin/payments" },
    { icon: "⭐", label: "შეფასებები",     href: "/dashboard/admin/reviews" },
    { icon: "⚙️", label: "პარამეტრები",   href: "/dashboard/admin/settings" },
  ],
};

const ROLE_STYLES = {
  student: { avatar: "avatar-blue",   badge: "text-blue-600",    bg: "bg-blue-50",    label: "🎓 სტუდენტი" },
  tutor:   { avatar: "avatar-green",  badge: "text-emerald-600", bg: "bg-emerald-50", label: "👨‍🏫 მასწავლებელი" },
  parent:  { avatar: "avatar-amber",  badge: "text-amber-600",   bg: "bg-amber-50",   label: "👨‍👩‍👧 მშობელი" },
  admin:   { avatar: "bg-red-100 text-red-700", badge: "text-red-500", bg: "bg-red-50", label: "🔐 Admin" },
};

// ზარის dropdown-ში ერთი შეტყობინება
function NotifItem({ notif, onRead, onNavigate }) {
  const [expanded, setExpanded] = useState(false);

  const icons = {
    booking:  "📅",
    payment:  "💳",
    review:   "⭐",
    lesson:   "📚",
    message:  "💬",
    dispute:  "🚩",
    system:   "🔔",
  };
  const icon = icons[notif.type] || "🔔";

  function getLink() {
    if (notif.link) return notif.link;
    if (notif.type === "booking" || notif.type === "lesson")
      return "/dashboard/student/lessons";
    if (notif.type === "payment")
      return notif.link || "/dashboard/student/subscriptions";
    if (notif.type === "message")
      return "/messages";
    return null;
  }

  const link = getLink();
  const isLong = notif.body && notif.body.length > 60;

  function handleClick() {
    onRead(notif.id);
    if (isLong && !expanded) {
      setExpanded(true);
    } else if (link) {
      onNavigate(link);
    }
  }

  return (
    <div
      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer ${
        !notif.is_read ? "bg-blue-50/60" : ""
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${!notif.is_read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
            {notif.title}
          </p>
          {notif.body && (
            <p className={`text-xs text-gray-500 mt-0.5 leading-snug ${expanded ? "" : "line-clamp-2"}`}>
              {notif.body}
            </p>
          )}
          {/* გადადი ბმულზე — expanded შემდეგ */}
          {expanded && link && (
            <button
              onClick={e => { e.stopPropagation(); onNavigate(link); }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium mt-1"
            >
              გახსნა →
            </button>
          )}
          <p className="text-[10px] text-gray-300 mt-1">
            {new Date(notif.created_at).toLocaleString("ka-GE", {
              day: "numeric", month: "short",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-1">
          {!notif.is_read && (
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          )}
          {!expanded && link && <span className="text-gray-300 text-xs">→</span>}
        </div>
      </div>
    </div>
  );
}

export default function DashboardSidebar({ role, userName }) {
  const pathname = usePathname();
  const router   = useRouter();
  const items    = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.student;
  const style    = ROLE_STYLES[role] ?? ROLE_STYLES.student;

  const [badges, setBadges] = useState({
    messages: 0, lessons: 0, payments: 0,
    bookings: 0, reviews: 0, income: 0, tasks: 0,
  });
  const [avatarUrl, setAvatarUrl] = useState("");

  // ზარი
  const [notifs, setNotifs]         = useState([]);
  const [bellOpen, setBellOpen]     = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef                     = useRef(null);

  // ────────────────────────────────────────────
  // შეტყობინებების ჩატვირთვა
  // ────────────────────────────────────────────
  async function fetchNotifs(uid) {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, is_read, created_at, link")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(30);

    const list = data || [];
    setNotifs(list);
    setUnreadCount(list.filter(n => !n.is_read).length);
  }

  // წაკითხულად მონიშვნა
  async function markRead(notifId) {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notifId);
    setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  // ყველა წაკითხულად
  async function markAllRead(uid) {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", uid)
      .eq("is_read", false);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  // ────────────────────────────────────────────
  // Notification polling (every 10s, no realtime dependency)
  // ────────────────────────────────────────────
  useEffect(() => {
    let uid = null;
    let interval = null;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      uid = user.id;
      await fetchNotifs(uid);
      interval = setInterval(() => fetchNotifs(uid), 10000);
    })();
    return () => { if (interval) clearInterval(interval); };
  }, []);

  // ────────────────────────────────────────────
  // Sidebar badges
  // ────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    async function fetchBadges() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // avatar
      supabase.from("profiles").select("avatar_url").eq("id", user.id).single()
        .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });

      const { count: unreadMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("seen", false);

      if (role === "student" || role === "parent") {
        // pending + completed_by_tutor — ორივე საჭიროებს სტუდენტის ყურადღებას
        const { count: needsAttention } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("student_id", user.id)
          .in("status", ["pending", "completed_by_tutor"]);

        const { count: pendingPayments } = await supabase
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("student_id", user.id)
          .eq("status", "pending");

        setBadges(b => ({
          ...b,
          messages: unreadMessages  || 0,
          lessons:  needsAttention  || 0,
          payments: pendingPayments || 0,
        }));
      }

      if (role === "tutor") {
        const { count: pendingBookings } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("tutor_id", user.id)
          .eq("status", "pending");

        const { count: newReviews } = await supabase
  .from("reviews")
  .select("*", { count: "exact", head: true })
  .eq("tutor_id", user.id)
  .eq("seen_by_tutor", false);

        const { count: pendingIncome } = await supabase
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("tutor_id", user.id)
          .eq("status", "pending");

        setBadges(b => ({
          ...b,
          messages: unreadMessages  || 0,
          bookings: pendingBookings || 0,
          reviews:  newReviews      || 0,
          income:   pendingIncome   || 0,
        }));
      }

      if (role === "admin") {
        const { count: unverifiedTutors } = await supabase
          .from("tutors")
          .select("*", { count: "exact", head: true })
          .eq("is_verified", false);

        const { count: pendingBookings } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        setBadges(b => ({
          ...b,
          messages: unverifiedTutors || 0,
          bookings: pendingBookings  || 0,
        }));
      }
    }

    fetchBadges();

    const channel = supabase
      .channel(`sidebar_badges_${role}`)
      .on("postgres_changes", { event: "*",      schema: "public", table: "messages" },       fetchBadges)
      .on("postgres_changes", { event: "*",      schema: "public", table: "bookings" },       fetchBadges)
      .on("postgres_changes", { event: "*",      schema: "public", table: "payments" },       fetchBadges)
      .on("postgres_changes", { event: "*",      schema: "public", table: "reviews" },        fetchBadges)
      .on("postgres_changes", { event: "*",      schema: "public", table: "tutors" },         fetchBadges)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" },  async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) fetchNotifs(user.id); // ზარი realtime-ით განახლდება
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [role, pathname]);

  // dropdown-ის გარეთ click → დახურვა
  useEffect(() => {
    function handleClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // tasks badge — notifs-დან ავტომატურად
  useEffect(() => {
    const count = notifs.filter(n => !n.is_read && n.link?.includes("/tasks")).length;
    setBadges(b => ({ ...b, tasks: count }));
  }, [notifs]);

  function getBadge(href) {
    if (href === "/messages" || href === "/dashboard/tutor/messages") return badges.messages;
    if (href.includes("/tasks"))    return badges.tasks;
    if (href.includes("/lessons"))  return badges.lessons;
    if (href.includes("/payments")) return badges.payments;
    if (href.includes("/bookings")) return badges.bookings;
    if (href.includes("/reviews"))  return badges.reviews;
    if (href.includes("/income"))   return badges.income;
    if (href.includes("/tutors"))   return badges.messages;
    return 0;
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function isActive(href) {
    const roots = [
      "/dashboard/student", "/dashboard/tutor",
      "/dashboard/parent",  "/dashboard/admin",
    ];
    if (roots.includes(href)) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden md:flex bg-white border-r border-gray-100 flex-col py-6">
      {/* Logo + ზარი */}
      <div className="flex items-center justify-between px-6 mb-6">
        <Link href={`/dashboard/${role}`} className="text-lg font-black">
          Tutor<span className="text-emerald-600">Hub</span>
        </Link>

        {/* 🔔 ზარი */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(o => !o)}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <span className="text-lg">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {bellOpen && (
            <div className="absolute left-0 top-11 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">
                  შეტყობინებები
                  {unreadCount > 0 && (
                    <span className="ml-2 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">
                      {unreadCount} ახალი
                    </span>
                  )}
                </p>
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      const supabase = createClient();
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) markAllRead(user.id);
                    }}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >
                    ყველა წაკითხულად
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-2xl mb-2">🔕</p>
                    <p className="text-sm text-gray-400">შეტყობინება არ არის</p>
                  </div>
                ) : (
                  notifs.map(n => (
                    <NotifItem
                      key={n.id}
                      notif={n}
                      onRead={markRead}
                      onNavigate={(link) => { setBellOpen(false); router.push(link); }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User info */}
      <div className={`flex items-center gap-3 px-4 py-3 mx-3 mb-4 ${style.bg} rounded-2xl`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar"
            className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-white shadow-sm" />
        ) : (
          <div className={`avatar w-10 h-10 text-sm shrink-0 ${style.avatar}`}>
            {(userName ?? "??").slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{userName ?? "—"}</p>
          <p className={`text-xs font-medium ${style.badge}`}>{style.label}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-0.5 flex-1">
        {items.map(({ icon, label, href }) => {
          const badge = getBadge(href);
          const isTasksLink = href.includes("/tasks");
          return (
            <Link
              key={href}
              href={href}
              className={isActive(href) ? "sidebar-item-active" : "sidebar-item"}
            >
              <span>{icon}</span>
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                isTasksLink ? (
                  <span className="ml-auto w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                ) : (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-gray-100 pt-3 mt-3">
        <button
          onClick={handleSignOut}
          className="sidebar-item text-red-400 hover:text-red-600 w-full text-left"
        >
          🚪 გასვლა
        </button>
      </div>
    </aside>
  );
}