import Link from "next/link";
import LandingNavbar from "@/components/LandingNavbar";

export const metadata = {
  title: "გაუქმების პოლიტიკა — TutorHub",
  description: "TutorHub-ის გაუქმების პოლიტიკა — შეიტყვეთ, როდის და როგორ შეგიძლიათ ჯავშნის გაუქმება.",
};

const LAST_UPDATED = "14 ივნისი, 2026";

const rules = [
  {
    actor: "მოსწავლე",
    icon: "🎓",
    color: "bg-blue-50 border-blue-100",
    headerColor: "bg-blue-500",
    rows: [
      { when: "გაკვეთილამდე 24+ სთ ადრე", refund: "სრული (100%)", note: "გაუქმება პლატფორმიდან" },
      { when: "გაკვეთილამდე 24 სთ-ზე ნაკლები", refund: "არ ბრუნდება", note: "გადახდა ირიცხება მასწავლებელს" },
      { when: "No-Show (გამოუცხადებლობა)", refund: "არ ბრუნდება", note: "შეტყობინების გარეშე" },
    ],
  },
  {
    actor: "მასწავლებელი",
    icon: "👨‍🏫",
    color: "bg-violet-50 border-violet-100",
    headerColor: "bg-violet-500",
    rows: [
      { when: "ჯავშნის დადასტურებაზე უარი (24 სთ)", refund: "სრული (100%)", note: "ჯავშანი ავტომატურად გაუქმდება" },
      { when: "გაუქმება გაკვეთილამდე 24+ სთ ადრე", refund: "სრული (100%)", note: "მოსწავლეს ეცნობება" },
      { when: "გაუქმება გაკვეთილამდე 24 სთ-ზე ნაკლები", refund: "სრული (100%)", note: "მასწავლებელი ვერ იღებს ანაზღაურებას" },
      { when: "No-Show (30+ წთ დაგვიანება / გამოუცხადებლობა)", refund: "სრული (100%)", note: "სანქცია მასწავლებლის პროფილზე" },
    ],
  },
];

const sections = [
  {
    id: "how-to-cancel",
    num: "01",
    title: "როგორ გავაუქმო ჯავშანი",
    content: `ჯავშნის გაუქმება შეგიძლიათ პლატფორმაზე:

① შედით „ჩემი ჯავშნები" → „მომლოდინე / დადასტურებული" სექციაში.
② გახსენით სასურველი ჯავშანი.
③ დააჭირეთ „გაუქმება" და დაადასტურეთ.

გაუქმება ხდება დაუყოვნებლივ. Refund-ის ოდენობა დამოკიდებულია გაუქმების დროზე (იხ. ცხრილი ქვემოთ).

თუ პრობლემა შეგექმნათ გაუქმებისას ან გაკვეთილი ისეა გამოქვეყნებული, რომ გაუქმების ღილაკი არ ჩანს — მოგვწერეთ: support@tutorhub.ge`,
  },
  {
    id: "table",
    num: "02",
    title: "გაუქმების ცხრილი",
    isTable: true,
  },
  {
    id: "repeated-cancellations",
    num: "03",
    title: "სისტემატური გაუქმებები",
    content: `TutorHub-ი აკვირდება გაუქმებების სიხშირეს ორივე მხარეზე:

მოსწავლე:
• თვეში 3-ზე მეტი გვიანი გაუქმება (24 სთ-ზე ნაკლები) — გაფრთხილება.
• მომდევნო სისტემატური დარღვევა — ანგარიშის შეჩერება.

მასწავლებელი:
• მასწავლებლის მიერ No-Show — პროფილზე ავტომატური გაფრთხილების ჩანიშვნა.
• 2 No-Show 30 დღეში — ანგარიშის შეჩერება და ადმინისტრაციული გადახედვა.
• 3 No-Show — ანგარიშის სამუდამო დახურვა.

ეს წესები არსებობს მომხმარებლების სანდოობის დასაცავად.`,
  },
  {
    id: "force-majeure",
    num: "04",
    title: "განსაკუთრებული გარემოებები",
    content: `ობიექტური, დამოუკიდებელი გარემოებების შემთხვევაში (Force Majeure) — ავადმყოფობა, ავარია, კომუნიკაციის გათიშვა — TutorHub-ი განიხილავს სიტუაციას ინდივიდუალურად.

გამოიყენეთ support@tutorhub.ge — მიუთითეთ ჯავშნის ნომერი და გარემოება. დამადასტურებელი დოკუმენტი (მაგ. სამედიცინო ცნობა) დაჩქარებს განხილვას.

TutorHub-ი ვალდებულება არ არის Force Majeure გარემოებების სამართლებრივი შეფასების გამო, მაგრამ კეთილსინდისიერ მიდგომას ყოველ შემთხვევაში იჩენს.`,
  },
];

export default function CancellationPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      <section className="pt-32 pb-12 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-amber-100 text-amber-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest">
            გაუქმება
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-4 leading-tight">
            გაუქმების<br />
            <span className="text-amber-500">პოლიტიკა</span>
          </h1>
          <p className="text-gray-500 text-sm font-light">
            ბოლოს განახლდა: <strong className="text-gray-700">{LAST_UPDATED}</strong>
          </p>
          <p className="mt-4 text-gray-500 text-base font-light leading-relaxed max-w-2xl">
            გაიგეთ, როდის შეგიძლიათ ჯავშნის გაუქმება, რა ხდება თანხასთან და
            რა სანქციები მოქმედებს სისტემატური გაუქმებების შემთხვევაში.
          </p>
        </div>
      </section>

      <article className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <div className="flex items-start gap-4 mb-5">
                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500 text-white text-sm font-black flex items-center justify-center">
                  {section.num}
                </span>
                <h2 className="text-xl font-black text-gray-900 leading-snug pt-1">{section.title}</h2>
              </div>

              {section.isTable ? (
                <div className="pl-14 space-y-6">
                  {rules.map((group) => (
                    <div key={group.actor} className={`rounded-2xl border overflow-hidden ${group.color}`}>
                      <div className={`${group.headerColor} px-5 py-3 flex items-center gap-2`}>
                        <span className="text-lg">{group.icon}</span>
                        <span className="text-white font-bold text-sm">{group.actor}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">სიტუაცია</th>
                              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Refund</th>
                              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">შენიშვნა</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row, i) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0">
                                <td className="px-5 py-3 text-gray-700 font-light">{row.when}</td>
                                <td className="px-5 py-3">
                                  <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                                    row.refund.includes("100%") ? "bg-emerald-100 text-emerald-700" :
                                    row.refund.includes("ბრუნდება") ? "bg-red-100 text-red-600" :
                                    "bg-amber-100 text-amber-700"
                                  }`}>
                                    {row.refund}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-gray-400 font-light text-xs hidden sm:table-cell">{row.note}</td>
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

      <section className="py-10 bg-amber-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-amber-800 font-medium mb-1">კითხვა გაუქმებასთან დაკავშირებით?</p>
          <a href="mailto:support@tutorhub.ge" className="text-amber-600 font-bold hover:underline text-sm">
            support@tutorhub.ge
          </a>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link href="/" className="font-black text-lg text-gray-900">Tutor<span className="text-emerald-600">Hub</span></Link>
          <p className="text-xs text-gray-400">© 2026 TutorHub Georgia. ყველა უფლება დაცულია.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <Link href="/terms" className="hover:text-gray-700 transition-colors">წესები და პირობები</Link>
            <Link href="/refund" className="hover:text-gray-700 transition-colors">Refund Policy</Link>
            <Link href="/cancellation" className="hover:text-gray-700 transition-colors font-semibold text-gray-700">გაუქმების პოლიტიკა</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
