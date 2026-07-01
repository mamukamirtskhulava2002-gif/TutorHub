import Link from "next/link";
import LandingNavbar from "@/components/LandingNavbar";

export const metadata = {
  title: "გადახდა და თანხის დაბრუნება — TutorHub",
  description: "TutorHub-ის გადახდის წესები, Escrow სისტემა და თანხის დაბრუნების პირობები.",
};

const LAST_UPDATED = "14 ივნისი, 2026";

const sections = [
  {
    id: "how-payment-works",
    num: "01",
    title: "გადახდის სისტემა",
    content: `TutorHub იყენებს Escrow (ანაბრის) სისტემას — ეს ნიშნავს, რომ გაკვეთილის გადახდა წინასწარ ხდება, მაგრამ მასწავლებელი თანხას მხოლოდ გაკვეთილის წარმატებით დასრულების შემდეგ იღებს. თქვენი ფული დაცულია მთელი პროცესის განმავლობაში.

გადახდის ეტაპები:
① მოსწავლე ჯავშნავს გაკვეთილს და იხდის სრულ თანხას გადახდის ფანჯრიდან.
② თანხა ირიცხება TutorHub-ის Escrow ანგარიშზე — მასწავლებელი ამ ეტაპზე თანხას ვერ ხედავს.
③ მასწავლებელი ადასტურებს ჯავშანს (24 სთ-ის ვადაში).
④ გაკვეთილი ტარდება.
⑤ მოსწავლე ადასტურებს გაკვეთილის გავლას — ან 48 სთ გადის ავტომატურად.
⑥ TutorHub ათავისუფლებს თანხას მასწავლებლისთვის (მინუს საკომისიო).

გადახდა მუშავდება Stripe-ის მეშვეობით — PCI DSS სერტიფიცირებული, საერთაშორისო უსაფრთხოების სტანდარტი. TutorHub-ი არ ინახავს ბარათის სრულ ნომერს.`,
  },
  {
    id: "payment-methods",
    num: "02",
    title: "გადახდის მეთოდები",
    content: `TutorHub იღებს შემდეგ გადახდის საშუალებებს Stripe-ის მეშვეობით:

• ვიზა (Visa) — სადებეტო და საკრედიტო ბარათი
• MasterCard — სადებეტო და საკრედიტო ბარათი
• Google Pay
• Apple Pay

ყველა ტრანზაქცია ხდება ლარში (GEL). ბარათის კონვერტაცია სხვა ვალუტიდან ხდება თქვენი ბანკის კურსით — TutorHub-ი ამ კონვერტაციაზე პასუხს არ აგებს.

გადახდა ხდება გაკვეთილის ჯავშნის გაფორმების მომენტში. გადახდის სტატუსი დაუყოვნებლივ ვლინდება — წარუმატებელი გადახდის შემთხვევაში ჯავშანი ავტომატურად გაუქმდება.`,
  },
  {
    id: "refund-policy",
    num: "03",
    title: "თანხის დაბრუნება",
    content: `თანხის დაბრუნება (Refund) ხდება შემდეგი წესების მიხედვით:

✅ სრული დაბრუნება (100%):
• მოსწავლე გააუქმებს ჯავშანს გაკვეთილამდე 24 სთ-ზე მეტი ხნით ადრე.
• მასწავლებელი არ დაადასტურებს ჯავშანს 24 სთ-ის ვადაში.
• მასწავლებელი გამოცხადდება 30 წუთზე მეტი დაგვიანებით ან საერთოდ არ გამოცხადდება.
• ტექნიკური ხარვეზის (Stripe-ის მხრიდან) შემთხვევაში.

⚠️ ნაწილობრივი დაბრუნება:
• სადავო სიტუაციებში TutorHub-ი განიხილავს ინდივიდუალურად — გადახდილი თანხის 50%-მდე შეიძლება დაბრუნდეს გარემოებების მიხედვით.

❌ თანხა არ ბრუნდება:
• მოსწავლემ გააუქმა ჯავშანი გაკვეთილამდე 24 სთ-ზე ნაკლები ხნით ადრე.
• მოსწავლე არ გამოცხადდა გაკვეთილზე (No-Show) შეტყობინების გარეშე.
• გაკვეთილი ჩატარდა, მაგრამ მოსწავლე ვერ მიაღწია მოსალოდნელ შედეგს (სწავლის შედეგი TutorHub-ის კონტროლს სცდება).

Refund-ის დამუშავება ხდება 5–10 სამუშაო დღის ვადაში Stripe-ის მეშვეობით. ბარათზე ასახვის ვადა შეიძლება განსხვავდებოდეს ბანკის მიხედვით.`,
  },
  {
    id: "dispute",
    num: "04",
    title: "პრეტენზიის შეტანა",
    content: `თუ ჩათვლით, რომ Refund-ის უფლება გაქვთ, შემდეგი პროცედურა მიჰყევით:

① გაკვეთილის დასრულებიდან 48 სთ-ის ვადაში შედით პლატფორმაზე და გახსენით სადავო ჯავშანი.
② დააჭირეთ „პრეტენზიის შეტანა" და მიუთითეთ მიზეზი.
③ TutorHub-ი განიხილავს განაცხადს 10 სამუშაო დღის ვადაში.
④ 48 სთ-ის ვადის გასვლის შემდეგ პრეტენზია განხილვის ობიექტი ვეღარ გახდება.

ალტერნატიულად შეგიძლიათ მოგვწეროთ: support@tutorhub.ge — მიუთითეთ ჯავშნის ნომერი და მიზეზი.`,
  },
  {
    id: "tutor-payout",
    num: "05",
    title: "მასწავლებლის ანაზღაურება",
    content: `მასწავლებელი იღებს გადახდას გაკვეთილის დასრულების შემდეგ, შემდეგი წესით:

• გადახდა ხდება Stripe Connect-ის მეშვეობით — მასწავლებელი ვალდებულია შეავსოს Stripe Connect ანგარიში ვერიფიკაციის გვერდიდან.
• TutorHub-ის საკომისიო გამოიქვითება ავტომატურად — საკომისიოს ოდენობა ნაჩვენებია მასწავლებლის პანელში.
• ანაზღაურება ხდება 2–5 სამუშაო დღის ვადაში გაკვეთილის დასრულების შემდეგ.
• მასწავლებელი პასუხისმგებელია საგადასახადო ვალდებულებებზე — TutorHub-ი გადახდის ქვითრებს ინახავს 7 წლის ვადით (საქართველოს საგადასახადო კოდექსის 73-ე მუხლი).`,
  },
];

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      <section className="pt-32 pb-12 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest">
            გადახდა
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-4 leading-tight">
            გადახდა და<br />
            <span className="text-emerald-600">თანხის დაბრუნება</span>
          </h1>
          <p className="text-gray-500 text-sm font-light">
            ბოლოს განახლდა: <strong className="text-gray-700">{LAST_UPDATED}</strong>
          </p>
          <p className="mt-4 text-gray-500 text-base font-light leading-relaxed max-w-2xl">
            TutorHub-ის Escrow სისტემა იცავს თქვენს ფულს — გაიგეთ, როგორ მუშაობს გადახდა და
            რა პირობებში ხდება თანხის დაბრუნება.
          </p>
        </div>
      </section>

      <section className="py-8 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                {s.num}. {s.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <article className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <div className="flex items-start gap-4 mb-5">
                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-600 text-white text-sm font-black flex items-center justify-center">
                  {section.num}
                </span>
                <h2 className="text-xl font-black text-gray-900 leading-snug pt-1">{section.title}</h2>
              </div>
              <div className="pl-14 text-sm text-gray-600 leading-relaxed font-light whitespace-pre-line">
                {section.content}
              </div>
              <div className="mt-10 border-b border-gray-100" />
            </section>
          ))}
        </div>
      </article>

      <section className="py-10 bg-emerald-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-emerald-800 font-medium mb-1">გაქვთ კითხვა გადახდასთან დაკავშირებით?</p>
          <a href="mailto:support@tutorhub.ge" className="text-emerald-600 font-bold hover:underline text-sm">
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
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">კონფიდ. პოლიტიკა</Link>
            <Link href="/refund" className="hover:text-gray-700 transition-colors font-semibold text-gray-700">გადახდა & Refund</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
