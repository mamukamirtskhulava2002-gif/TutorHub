import Link from "next/link";
import LandingNavbar from "@/components/LandingNavbar";

export const metadata = {
  title: "ჩვენს შესახებ — TutorHub",
  description: "TutorHub — საქართველოს პირველი ვერიფიცირებული კერძო მასწავლებლების პლატფორმა.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest">
            ჩვენს შესახებ
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-6 leading-tight">
            განათლება საზღვრების გარეშე —<br />
            <span className="text-emerald-600">თქვენი შვილის წარმატების გზა</span>
          </h1>
          <p className="text-gray-500 text-lg font-light leading-relaxed max-w-2xl mx-auto">
            ჩვენ ვაერთიანებთ გამოცდილ მასწავლებლებს და ცოდნის მოწყურებულ მოსწავლეებს
            <strong className="text-gray-700 font-semibold"> უსაფრთხო, გამჭვირვალე და მოქნილ</strong> ონლაინ გარემოში.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-50 rounded-3xl p-10 sm:p-14">
            <h2 className="text-2xl font-black text-gray-900 mb-5">ჩვენი მისია</h2>
            <p className="text-gray-600 text-lg font-light leading-relaxed">
              TutorHub შევქმენით იმისთვის, რომ სწავლის პროცესი გავხადოთ{" "}
              <strong className="text-gray-900 font-semibold">მარტივი, სამართლიანი და შედეგზე ორიენტირებული</strong>.
              ჩვენ გვჯერა, რომ სწორი მასწავლებელი ცვლის მოსწავლის ცხოვრებას.
            </p>
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="py-16 bg-gray-50/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-gray-900 mb-8 text-center">რატომ TutorHub?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "🔒",
                color: "bg-emerald-50 text-emerald-600",
                title: "გამჭვირვალე ანგარიშსწორება",
                desc: "თქვენი თანხა დაცულია მანამ, სანამ გაკვეთილის შედეგით კმაყოფილი არ დარჩებით. გადახდა მხოლოდ წარმატების შემდეგ.",
              },
              {
                icon: "✅",
                color: "bg-blue-50 text-blue-600",
                title: "მასწავლებლების ვერიფიკაცია",
                desc: "ყველა მასწავლებელი გადის შემოწმებას — განათლება, გამოცდილება, ლიცენზია. თქვენმა შვილმა მხოლოდ საუკეთესო ცოდნა მიიღოს.",
              },
              {
                icon: "👨‍👩‍👧",
                color: "bg-violet-50 text-violet-600",
                title: "მშობლის კონტროლი",
                desc: "იყავი პროცესის ნაწილი — აკონტროლე შენი შვილის პროგრესი და დავალებები რეალურ დროში საკუთარი პანელიდან.",
              },
            ].map((item, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-7 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 ${item.color}`}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed font-light">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-gray-900 mb-10 text-center">სწავლის ციკლი</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "01", icon: "🔍", title: "აირჩიე", desc: "ლიცენზირებული პედაგოგი ან საგნის ექსპერტი." },
              { step: "02", icon: "📅", title: "დაჯავშნე", desc: "ინდივიდუალური ან ჯგუფური გაკვეთილი." },
              { step: "03", icon: "🎓", title: "ისწავლე", desc: "Jitsi-ს უსაფრთხო გარემოში ონლაინ." },
              { step: "04", icon: "⭐", title: "შეაფასე", desc: "შედეგი დამოკიდებულია შენს კმაყოფილებაზე." },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-7 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-lg">
                    {s.icon}
                  </div>
                  <span className="text-4xl font-black text-gray-900 tabular-nums">{s.step}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed font-light">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-900 rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 -z-0 opacity-20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl font-black text-white mb-4">მზად ხართ დაიწყოთ?</h2>
              <p className="text-gray-400 text-base mb-10 font-light max-w-md mx-auto">
                გახსენი ანგარიში, იპოვე შენი მასწავლებელი და დაიწყე სწავლა — სულ 5 წუთში.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/register?role=tutor"
                  className="bg-white text-gray-900 font-bold px-8 py-4 rounded-xl hover:bg-gray-100 transition-colors text-base">
                  მასწავლებლად დარეგისტრირება →
                </Link>
                <Link href="/register"
                  className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-xl transition-colors text-base">
                  მოსწავლის ანგარიშის შექმნა →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer mini */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link href="/" className="font-black text-lg text-gray-900">
            Tutor<span className="text-emerald-600">Hub</span>
          </Link>
          <p className="text-xs text-gray-400">© 2026 TutorHub Georgia. ყველა უფლება დაცულია.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <Link href="/terms" className="hover:text-gray-700 transition-colors">სარგებლობის წესები</Link>
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">კონფიდ. პოლიტიკა</Link>
            <Link href="/contact" className="hover:text-gray-700 transition-colors">კონტაქტი</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
