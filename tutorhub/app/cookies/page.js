import Link from "next/link";
import LandingNavbar from "@/components/LandingNavbar";

export const metadata = {
  title: "Cookie პოლიტიკა — TutorHub",
  description: "TutorHub-ის Cookie პოლიტიკა — შეიტყვეთ, რა Cookie-ებს ვიყენებთ და რატომ.",
};

const LAST_UPDATED = "14 ივნისი, 2026";

const cookieTypes = [
  {
    type: "სავალდებულო (Strictly Necessary)",
    icon: "🔒",
    color: "bg-gray-50 border-gray-200",
    badge: "bg-gray-200 text-gray-700",
    canDisable: false,
    description: "ეს Cookie-ები გადამყვანია — საიტი მათ გარეშე ვერ იმუშავებს. ისინი ინახავენ შესვლის სესიას და უსაფრთხოების ტოკენებს.",
    examples: [
      { name: "sb-access-token", purpose: "Supabase ავთენტიფიკაციის ტოკენი — შესვლის შენარჩუნება", duration: "სესია" },
      { name: "sb-refresh-token", purpose: "სესიის გახანგრძლივება ავტომატური გამოსვლის გარეშე", duration: "7 დღე" },
      { name: "oauth_role", purpose: "Google-ით შესვლისას როლის (მასწავლებელი/მოსწავლე) შენახვა", duration: "5 წუთი" },
    ],
  },
  {
    type: "ფუნქციური (Functional)",
    icon: "⚙️",
    color: "bg-blue-50 border-blue-100",
    badge: "bg-blue-100 text-blue-700",
    canDisable: false,
    description: "ეს Cookie-ები ინახავენ თქვენს პრეფერენციებს — მაგ. ენა, UI პარამეტრები — რათა ყოველ ვიზიტზე ხელახლა დაყენება არ დაგჭირდეთ.",
    examples: [
      { name: "__stripe_mid", purpose: "Stripe-ის თაღლითობის პრევენცია — გადახდის სესია", duration: "1 წელი" },
      { name: "__stripe_sid", purpose: "Stripe-ის ტრანზაქციის სესიის შენახვა", duration: "30 წუთი" },
    ],
  },
  {
    type: "ანალიტიკური (Analytics)",
    icon: "📊",
    color: "bg-violet-50 border-violet-100",
    badge: "bg-violet-100 text-violet-700",
    canDisable: true,
    description: "გვეხმარება გავიგოთ, როგორ იყენებენ მომხმარებლები პლატფორმას — რომელი გვერდები პოპულარულია, სად ჩერდებიან. ყველა მონაცემი ანონიმურია.",
    examples: [
      { name: "TawkConnectionTime", purpose: "Tawk.to ჩატ-ვიჯეტის კავშირის დრო", duration: "სესია" },
      { name: "TawkUUID", purpose: "Tawk.to-ს ანონიმური ვიზიტორის იდენტიფიკაცია", duration: "6 თვე" },
    ],
  },
  {
    type: "მესამე მხარის (Third-party)",
    icon: "🌐",
    color: "bg-amber-50 border-amber-100",
    badge: "bg-amber-100 text-amber-700",
    canDisable: true,
    description: "ეს Cookie-ები ეკუთვნის TutorHub-ის პარტნიორ სერვისებს. თითოეული მათგანი ექვემდებარება მის საკუთარ კონფიდენციალურობის პოლიტიკას.",
    examples: [
      { name: "Stripe Cookie-ები", purpose: "გადახდის უსაფრთხო დამუშავება", duration: "stripe.com/privacy" },
      { name: "Jitsi Cookie-ები", purpose: "ვიდეო-გაკვეთილის სესია", duration: "jitsi.org" },
      { name: "Tawk.to Cookie-ები", purpose: "ჩატ-მხარდაჭერის ფუნქცია", duration: "tawk.to/privacy" },
    ],
  },
];

const sections = [
  {
    id: "what-are-cookies",
    num: "01",
    title: "რა არის Cookie?",
    content: `Cookie — მცირე ზომის ტექსტური ფაილია, რომელიც ვებ-სერვერი ათავსებს თქვენს ბრაუზერში. ის ინახება თქვენს მოწყობილობაზე (კომპიუტერი, ტელეფონი, ტაბლეტი) და გამოიყენება გარკვეული ინფორმაციის დასამახსოვრებლად.

Cookie-ები სხვა ფაილებს ვერ წაიკითხავს, ვირუსს ვერ გადასცემს და ვერ მოახდენს თქვენი მოწყობილობის შეღწევას. ისინი გამოიყენება მხოლოდ ვებ-სერვისთან კომუნიკაციისთვის.

TutorHub-ი Cookie-ებს იყენებს მხოლოდ სერვისის გამართული ფუნქციონირებისა და მომხმარებლის გამოცდილების გასაუმჯობესებლად — არა სარეკლამო მიზნებისთვის.`,
  },
  {
    id: "types",
    num: "02",
    title: "Cookie-ების კატეგორიები",
    isCookieTable: true,
  },
  {
    id: "manage",
    num: "03",
    title: "Cookie-ების მართვა",
    content: `თქვენ გაქვთ სრული კონტროლი Cookie-ებზე ბრაუზერის პარამეტრებიდან:

Chrome: Settings → Privacy and Security → Cookies and other site data
Firefox: Settings → Privacy & Security → Cookies and Site Data
Safari: Preferences → Privacy → Manage Website Data
Edge: Settings → Cookies and site permissions → Cookies and site data

მნიშვნელოვანი: სავალდებულო Cookie-ების გამორთვის შემთხვევაში TutorHub-ში შესვლა და გაკვეთილების ჯავშანი შეუძლებელი გახდება — ეს ფაილები სისტემის ფუნქციონირებისთვის აუცილებელია.

ანალიტიკური და მესამე მხარის Cookie-ების გამორთვა პლატფორმის გამოყენებაზე გავლენას არ ახდენს — ზოგიერთი ფუნქცია (Tawk.to ჩატი, Stripe-ის ანიმაციები) შეიძლება შეზღუდულად გამოჩნდეს.`,
  },
  {
    id: "local-storage",
    num: "04",
    title: "Local Storage",
    content: `Cookie-ების გარდა, TutorHub-ი იყენებს ბრაუზერის Local Storage-ს შემდეგი მიზნებისთვის:

• Supabase Auth-ის ტოკენების შენახვა (შესვლის შენარჩუნება სესიებს შორის)
• ინტერფეისის პრეფერენციები (მაგ. ბოლოს ნანახი გვერდი)

Local Storage-ის მონაცემები ინახება მხოლოდ თქვენს მოწყობილობაზე და TutorHub-ის სერვერს არ გადაეცემა ავტომატურად. ბრაუზერის Cache-ის გასუფთავება ამ მონაცემებსაც წაშლის.`,
  },
  {
    id: "updates",
    num: "05",
    title: "Cookie პოლიტიკის განახლება",
    content: `ამ პოლიტიკის განახლებისას:
• გვერდზე განახლდება „ბოლოს განახლდა" თარიღი.
• არსებითი ცვლილების შემთხვევაში მომხმარებლებს ეცნობებათ ელ. ფოსტით.

Cookie-ებთან დაკავშირებული კითხვებისთვის: privacy@tutorhub.ge`,
  },
];

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      <section className="pt-32 pb-12 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-violet-100 text-violet-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest">
            Cookie
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-4 leading-tight">
            Cookie<br />
            <span className="text-violet-600">პოლიტიკა</span>
          </h1>
          <p className="text-gray-500 text-sm font-light">
            ბოლოს განახლდა: <strong className="text-gray-700">{LAST_UPDATED}</strong>
          </p>
          <p className="mt-4 text-gray-500 text-base font-light leading-relaxed max-w-2xl">
            TutorHub-ი იყენებს Cookie-ებს სერვისის გამართული ფუნქციონირებისა და
            თქვენი გამოცდილების გასაუმჯობესებლად. ქვემოთ დეტალურად ვხსნით, რომელ Cookie-ებს
            ვიყენებთ და რატომ.
          </p>
        </div>
      </section>

      <article className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <div className="flex items-start gap-4 mb-5">
                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-600 text-white text-sm font-black flex items-center justify-center">
                  {section.num}
                </span>
                <h2 className="text-xl font-black text-gray-900 leading-snug pt-1">{section.title}</h2>
              </div>

              {section.isCookieTable ? (
                <div className="pl-14 space-y-5">
                  {cookieTypes.map((ct) => (
                    <div key={ct.type} className={`rounded-2xl border overflow-hidden ${ct.color}`}>
                      <div className="px-5 py-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{ct.icon}</span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-900 text-sm">{ct.type}</span>
                              {ct.canDisable ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">გამორთვა შეიძლება</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">სავალდებულო</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 font-light mt-1 leading-relaxed">{ct.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-white/60">
                              <th className="text-left px-5 py-2.5 text-gray-400 font-semibold uppercase tracking-wide">Cookie</th>
                              <th className="text-left px-5 py-2.5 text-gray-400 font-semibold uppercase tracking-wide">მიზანი</th>
                              <th className="text-left px-5 py-2.5 text-gray-400 font-semibold uppercase tracking-wide whitespace-nowrap">ვადა</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ct.examples.map((ex, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="px-5 py-3 font-mono text-gray-700 whitespace-nowrap">{ex.name}</td>
                                <td className="px-5 py-3 text-gray-500 font-light">{ex.purpose}</td>
                                <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{ex.duration}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pl-14 text-sm text-gray-600 leading-relaxed font-light whitespace-pre-line">
                  {section.content}
                </div>
              )}
              <div className="mt-10 border-b border-gray-100" />
            </section>
          ))}
        </div>
      </article>

      <section className="py-10 bg-violet-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-violet-800 font-medium mb-1">კითხვა Cookie-ებთან დაკავშირებით?</p>
          <a href="mailto:privacy@tutorhub.ge" className="text-violet-600 font-bold hover:underline text-sm">
            privacy@tutorhub.ge
          </a>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link href="/" className="font-black text-lg text-gray-900">Tutor<span className="text-emerald-600">Hub</span></Link>
          <p className="text-xs text-gray-400">© 2026 TutorHub Georgia. ყველა უფლება დაცულია.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">კონფიდ. პოლიტიკა</Link>
            <Link href="/terms" className="hover:text-gray-700 transition-colors">წესები და პირობები</Link>
            <Link href="/cookies" className="hover:text-gray-700 transition-colors font-semibold text-gray-700">Cookie პოლიტიკა</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
