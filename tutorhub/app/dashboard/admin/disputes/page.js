"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AdminLayout from "@/components/AdminLayout";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ka-GE", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

export default function AdminDisputesPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("ადმინი");
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("open");
  const [search, setSearch]     = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast]       = useState(null);
  const [stats, setStats]       = useState({ open: 0, resolved: 0, refunded: 0 });
  const [adminNotes, setAdminNotes] = useState({});

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => { fetchDisputes(); }, []);

  async function fetchDisputes() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/auth"); return; }
    const { data: profile } = await supabase
      .from("profiles").select("role, full_name").eq("id", session.user.id).single();
    if (profile?.role !== "admin") { router.push("/dashboard"); return; }
    if (profile?.full_name) setAdminName(profile.full_name);

    // Try loading from disputes table first
    const { data: disputeRows, error: dispError } = await supabase
      .from("disputes")
      .select(`
        id, reason, status, admin_note, created_at, resolved_at,
        bookings(id, total_price, status, profiles!student_id(full_name, email), tutors!tutor_id(profiles(full_name), subject))
      `)
      .order("created_at", { ascending: false });

    if (!dispError && disputeRows) {
      setDisputes(disputeRows);
      setStats({
        open:     disputeRows.filter(d => d.status === "open").length,
        resolved: disputeRows.filter(d => d.status === "resolved").length,
        refunded: disputeRows.filter(d => d.status === "refunded").length,
      });
      setLoading(false);
      return;
    }

    // Fallback: treat bookings with status "disputed" as disputes
    const { data: bookings } = await supabase
      .from("bookings")
      .select(`
        id, total_price, status, created_at,
        profiles!student_id(full_name, email),
        tutors!tutor_id(profiles(full_name), subject)
      `)
      .in("status", ["disputed", "resolved_tutor", "resolved_student"])
      .order("created_at", { ascending: false });

    const mapped = (bookings || []).map(b => ({
      id:          b.id,
      reason:      "ჯავშნის სადავო სიტუაცია",
      status:      b.status === "disputed" ? "open" :
                   b.status === "resolved_tutor" ? "resolved" : "refunded",
      admin_note:  null,
      created_at:  b.created_at,
      resolved_at: null,
      bookings:    b,
      _isBooking:  true,
    }));

    setDisputes(mapped);
    setStats({
      open:     mapped.filter(d => d.status === "open").length,
      resolved: mapped.filter(d => d.status === "resolved").length,
      refunded: mapped.filter(d => d.status === "refunded").length,
    });
    setLoading(false);
  }

  async function resolveDispute(dispute, resolution) {
    const key = dispute.id + "_" + resolution;
    setActionLoading(key);
    const supabase = createClient();
    const note = adminNotes[dispute.id] || "";

    try {
      if (dispute._isBooking) {
        // Working with bookings table directly
        const newStatus = resolution === "release" ? "done" : "cancelled";
        await supabase.from("bookings").update({ status: newStatus }).eq("id", dispute.id);
      } else {
        const newStatus = resolution === "release" ? "resolved" : "refunded";
        await supabase.from("disputes")
          .update({ status: newStatus, admin_note: note, resolved_at: new Date().toISOString() })
          .eq("id", dispute.id);

        // Update the associated booking
        const bookingId = dispute.bookings?.id;
        if (bookingId) {
          const bookingStatus = resolution === "release" ? "done" : "cancelled";
          await supabase.from("bookings").update({ status: bookingStatus }).eq("id", bookingId);
        }
      }

      const newStatus = resolution === "release" ? "resolved" : "refunded";
      setDisputes(prev => prev.map(d =>
        d.id === dispute.id ? { ...d, status: newStatus, resolved_at: new Date().toISOString() } : d
      ));
      setStats(s => ({
        open:     Math.max(0, s.open - 1),
        resolved: s.resolved + (resolution === "release" ? 1 : 0),
        refunded: s.refunded + (resolution === "refund" ? 1 : 0),
      }));

      showToast(resolution === "release"
        ? "✅ თანხა მასწავლებელს გადაეცა"
        : "↩ თანხა სტუდენტს დაუბრუნდა");
    } catch (e) {
      showToast("შეცდომა: " + (e?.message || "სცადეთ თავიდან"), "error");
    }
    setActionLoading(null);
  }

  const filtered = disputes
    .filter(d => d.status === tab)
    .filter(d => {
      if (!search) return true;
      const q = search.toLowerCase();
      const booking = d.bookings || d;
      const student = (booking.profiles?.full_name || "").toLowerCase();
      const tutor   = (booking.tutors?.profiles?.full_name || "").toLowerCase();
      return student.includes(q) || tutor.includes(q);
    });

  const TABS = [
    { key: "open",     label: "ღია",         badge: stats.open },
    { key: "resolved", label: "✅ გადაწყვ.",  badge: null },
    { key: "refunded", label: "↩ დაბრუნ.",   badge: null },
  ];

  return (
    <AdminLayout adminName={adminName}>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-5 py-3 rounded-2xl shadow-lg border font-medium ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">⚖️ დავების მართვა</h1>
          <p className="text-sm text-gray-400 mt-0.5">Escrow — სადავო გადახდების განხილვა</p>
        </div>
        {stats.open > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded-xl text-sm font-medium">
            ⚖️ {stats.open} განუხილველი დავა
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "ღია დავები",     value: stats.open,     color: "text-orange-600",  bg: "bg-orange-50" },
          { label: "გადაწყვეტილი",  value: stats.resolved,  color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "დაბრუნებული",   value: stats.refunded,  color: "text-blue-600",    bg: "bg-blue-50" },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-5 text-center`}>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Escrow info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-6">
        <h3 className="font-semibold text-blue-900 text-sm mb-2">⚖️ Escrow დავის განხილვის სახელმძღვანელო</h3>
        <div className="grid md:grid-cols-2 gap-3 text-xs text-blue-800">
          <div className="flex items-start gap-2">
            <span className="text-lg">✅</span>
            <div><p className="font-semibold">გათავისუფლება მასწავლებლისთვის</p><p className="text-blue-600">გაკვეთილი ჩატარდა, მასწავლებელი მართალია</p></div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">↩</span>
            <div><p className="font-semibold">დაბრუნება სტუდენტს</p><p className="text-blue-600">გაკვეთილი ვერ ჩატარდა, სტუდენტს უბრუნდება</p></div>
          </div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
              {t.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white min-w-[200px] focus-within:border-orange-400 transition-colors">
          <span className="pl-4 flex items-center text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="სტუდენტი ან მასწავლებელი..."
            className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent" />
          {search && <button onClick={() => setSearch("")} className="px-3 text-gray-300 hover:text-gray-500">✕</button>}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="card p-6 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/3 mb-3" /><div className="h-16 bg-gray-100 rounded" /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">⚖️</p>
          <p className="text-xl font-bold text-gray-700 mb-2">
            {tab === "open" ? "ღია დავა არ არის" : tab === "resolved" ? "გადაწყვეტილი დავა არ არის" : "დაბრუნებული დავა არ არის"}
          </p>
          <p className="text-sm text-gray-400">
            {tab === "open" ? "ყველა სადავო სიტუაცია გადაწყვეტილია ✅" : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(d => {
            const booking = d.bookings || d;
            const student = booking.profiles?.full_name || "—";
            const tutor   = booking.tutors?.profiles?.full_name || "—";
            const subject = booking.tutors?.subject?.[0] || "—";
            const amount  = booking.total_price || 0;
            const al      = actionLoading;

            return (
              <div key={d.id} className={`bg-white rounded-2xl border p-6 shadow-sm ${
                d.status === "open" ? "border-orange-200 bg-orange-50/10" :
                d.status === "resolved" ? "border-emerald-200 bg-emerald-50/10" :
                "border-blue-200 bg-blue-50/10"
              }`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Student */}
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                        {student[0] || "?"}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">სტუდენტი</p>
                        <p className="text-sm font-semibold text-gray-900">{student}</p>
                      </div>
                    </div>
                    <span className="text-gray-300 text-lg">⚔️</span>
                    {/* Tutor */}
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0">
                        {tutor[0] || "?"}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">მასწავლებელი</p>
                        <p className="text-sm font-semibold text-gray-900">{tutor}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-gray-900">{amount} ₾</p>
                    <p className="text-xs text-gray-400">{subject}</p>
                  </div>
                </div>

                {/* Reason */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-1">📋 დავის მიზეზი</p>
                  <p className="text-sm text-gray-700">{d.reason || "მიზეზი მითითებული არ არის"}</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span>📅 {formatDate(d.created_at)}</span>
                  {d.resolved_at && <span>✅ გადაწყდა: {formatDate(d.resolved_at)}</span>}
                  {d.admin_note && <span className="text-emerald-600 font-medium">📝 {d.admin_note}</span>}
                </div>

                {/* Status badge */}
                {d.status !== "open" && (
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${
                    d.status === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {d.status === "resolved" ? "✅ თანხა მასწ. გადაეცა" : "↩ თანხა სტ. დაუბრუნდა"}
                  </div>
                )}

                {/* Admin actions for open disputes */}
                {d.status === "open" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium mb-1 block">📝 ადმინის შენიშვნა (სურვილისამებრ)</label>
                      <input
                        value={adminNotes[d.id] || ""}
                        onChange={e => setAdminNotes(prev => ({ ...prev, [d.id]: e.target.value }))}
                        placeholder="გადაწყვეტის მოკლე მიზეზი..."
                        className="input text-sm"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => resolveDispute(d, "release")}
                        disabled={!!al}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {al === d.id + "_release" ? (
                          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> მუშავდება...</>
                        ) : (
                          <><span>✅</span> თანხის გათავისუფლება (მასწ.)</>
                        )}
                      </button>
                      <button
                        onClick={() => resolveDispute(d, "refund")}
                        disabled={!!al}
                        className="flex-1 py-3 rounded-xl border-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {al === d.id + "_refund" ? (
                          <><span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" /> მუშავდება...</>
                        ) : (
                          <><span>↩</span> დაბრუნება სტუდენტს</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-4 text-right">{filtered.length} ჩანაწერი</p>
    </AdminLayout>
  );
}
