"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import LandingNavbar from "@/components/LandingNavbar";
import { createClient } from "@/lib/supabase";

const TOPICS = [
  "გაკვეთილის ჯავშანი",
  "გადახდა / Refund",
  "ტექნიკური პრობლემა",
  "მასწავლებლის ვერიფიკაცია",
  "ანგარიშის საკითხი",
  "სხვა",
];

export default function ContactPage() {
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [topic, setTopic]   = useState("");
  const [msg, setMsg]       = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  /* Pre-fill from Supabase profile if logged in */
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", session.user.id)
        .single();
      if (p?.full_name) setName(p.full_name);
      if (p?.email)     setEmail(p.email);
    })();
  }, []);

  function startChat(e) {
    e.preventDefault();
    if (!name.trim())                             { setError("სახელი სავალდებულოა"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("ელ. ფოსტა არასწორია"); return; }
    if (!topic)                                   { setError("გთხოვთ აირჩიოთ საკითხი"); return; }
    setError("");
    setLoading(true);

    /* Set visitor identity in Tawk.to */
    window.__tawkVisitorSet   = true;
    window.__tawkNeedPreChat  = false;

    const attrs = { name: name.trim(), email: email.trim(), topic };
    if (msg.trim()) attrs.message = msg.trim();

    function openChat() {
      if (window.Tawk_API?.setAttributes) {
        window.Tawk_API.setAttributes(attrs, () => {});
      }
      window.Tawk_API?.maximize?.();
      setLoading(false);
    }

    if (window.Tawk_API?.setAttributes) {
      openChat();
    } else {
      /* Widget not yet loaded — wait */
      const prev = (window.Tawk_API = window.Tawk_API || {}).onLoad;
      window.Tawk_API.onLoad = function () {
        if (typeof prev === "function") prev();
        openChat();
      };
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* Hero */}
      <section className="pt-32 pb-12 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest">
            მხარდაჭერა
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-4 leading-tight">
            გვიკავშირდით —<br />
            <span className="text-emerald-600">ვართ მზად დასახმარებლად</span>
          </h1>
          <p className="text-gray-500 text-base font-light max-w-xl mx-auto">
            შეავსეთ ფორმა და ჩვენი გუნდი Live Chat-ში გიპასუხებთ რამდენიმე წუთში.
          </p>
        </div>
      </section>

      {/* Main */}
      <section className="pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Left — Chat form */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-gray-700">Live Chat — ახლა ხელმისაწვდომია</span>
              </div>

              <form onSubmit={startChat} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">სახელი გვარი *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="ანა გელაშვილი"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 placeholder-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">ელ. ფოსტა *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="ana@example.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 placeholder-gray-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">საკითხი *</label>
                  <select
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 text-gray-700 bg-white appearance-none"
                  >
                    <option value="">— აირჩიეთ საკითხი —</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    შეტყობინება <span className="font-normal normal-case text-gray-300">(არასავალდებულო)</span>
                  </label>
                  <textarea
                    value={msg}
                    onChange={e => setMsg(e.target.value)}
                    rows={3}
                    placeholder="მოკლედ აღწერეთ პრობლემა — ოპერატორი ჩატში ყველა დეტალს შეგეკითხებათ"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 placeholder-gray-300 resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
                    ❌ {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ჩატი იხსნება...
                    </>
                  ) : (
                    "💬 ჩატის დაწყება →"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right — Info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Email */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl mb-3 shadow-sm">✉️</div>
              <h3 className="font-bold text-gray-900 mb-1 text-sm">ელ. ფოსტა</h3>
              <p className="text-xs text-gray-500 font-light mb-2 leading-relaxed">
                სწრაფი პასუხი სამუშაო დღეებში 24 სთ-ის ვადაში
              </p>
              <a href="mailto:support@tutorhub.ge"
                className="text-emerald-600 font-semibold text-sm hover:underline">
                support@tutorhub.ge
              </a>
            </div>

            {/* Working hours */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl mb-3 shadow-sm">🕐</div>
              <h3 className="font-bold text-gray-900 mb-3 text-sm">სამუშაო საათები</h3>
              <div className="space-y-1.5 text-xs text-gray-600 font-light">
                <div className="flex justify-between">
                  <span>ორშ — პარ</span>
                  <span className="font-medium text-gray-800">10:00 – 20:00</span>
                </div>
                <div className="flex justify-between">
                  <span>შაბათი</span>
                  <span className="font-medium text-gray-800">11:00 – 17:00</span>
                </div>
                <div className="flex justify-between">
                  <span>კვირა</span>
                  <span className="text-gray-400">დასვენება</span>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl mb-3 shadow-sm">📚</div>
              <h3 className="font-bold text-gray-900 mb-3 text-sm">სასარგებლო ბმულები</h3>
              <div className="space-y-2 text-xs">
                {[
                  { href: "/refund", label: "გადახდა და Refund Policy" },
                  { href: "/cancellation", label: "გაუქმების პოლიტიკა" },
                  { href: "/terms", label: "წესები და პირობები" },
                  { href: "/privacy", label: "კონფიდ. პოლიტიკა" },
                ].map(l => (
                  <Link key={l.href} href={l.href}
                    className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 hover:underline font-light">
                    <span className="text-gray-300">›</span> {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link href="/" className="font-black text-lg text-gray-900">
            Tutor<span className="text-emerald-600">Hub</span>
          </Link>
          <p className="text-xs text-gray-400">© 2026 TutorHub Georgia. ყველა უფლება დაცულია.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <Link href="/terms"   className="hover:text-gray-700 transition-colors">წესები</Link>
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">კონფიდ. პოლიტიკა</Link>
            <Link href="/contact" className="hover:text-gray-700 transition-colors font-semibold text-gray-700">კონტაქტი</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
