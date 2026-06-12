"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const TIME_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
const DURATION_OPTIONS = [
  { hours: 1,   label: "1 საათი" },
  { hours: 1.5, label: "1.5 საათი" },
  { hours: 2,   label: "2 საათი" },
];
const PACKAGE_OPTIONS = [
  { id: "single",  label: "ერთჯერადი",    months: 0, discount: 0,    icon: "📅", desc: "ერთი გაკვეთილი, წინასწარ გადახდა" },
  { id: "pkg1",    label: "1 თვე",         months: 1, discount: 0,    icon: "🗓️", desc: "ყოველთვიური ჩამოჭრა, გაუქმება ნებისმიერ დროს" },
  { id: "pkg3",    label: "3 თვე",         months: 3, discount: 0.05, icon: "📦", desc: "5% ფასდაკლება" },
  { id: "pkg6",    label: "6 თვე",         months: 6, discount: 0.10, icon: "🏆", desc: "10% ფასდაკლება" },
];
const LESSONS_OPTIONS = [4, 8, 12];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}
const GEO_DAYS = ["კვ","ორ","სამ","ოთხ","ხუთ","პარ","შაბ"];
const GEO_MONTHS = ["იანვარი","თებერვალი","მარტი","აპრილი","მაისი","ივნისი","ივლისი","აგვისტო","სექტემბერი","ოქტომბერი","ნოემბერი","დეკემბერი"];

export default function BookingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [bookingType, setBookingType] = useState("single");
  const [lessonsPerMonth, setLessonsPerMonth] = useState(8);

  // მშობლის შვილები
  const [children, setChildren] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  const [today, setToday] = useState(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  useEffect(() => {
    setToday(new Date());
  }, []);

  const [booking, setBooking] = useState({
    format: "online",
    date: null,
    timeSlot: null,
    duration: 1,
    note: "",
  });

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      // მომხმარებელი
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setCurrentUser(user);
      setSelectedStudentId(user.id); // default — საკუთარი თავი

      // როლი
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setUserRole(profile?.role);

      // თუ მშობელია — შვილები
      if (profile?.role === "parent") {
        const { data: childrenData } = await supabase
          .from("parent_children")
          .select("id, profiles!child_id(id, full_name)")
          .eq("parent_id", user.id);

        const kids = childrenData || [];
        setChildren(kids);

        // default — პირველი შვილი
        if (kids.length > 0) {
          setSelectedStudentId(kids[0].profiles?.id);
        }
      }

      // მასწავლებელი
      const { data, error } = await supabase
        .from("tutors")
        .select("id, price_per_hour, subject, is_online, is_offline, city, profiles(full_name)")
        .eq("id", id)
        .single();
      if (!error && data) setTutor(data);
      setLoading(false);
    }
    if (id) fetchData();
  }, [id]);

  useEffect(() => {
    async function fetchBookedSlots() {
      if (!booking.date) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("bookings")
        .select("time_slot")
        .eq("tutor_id", id)
        .eq("date", booking.date)
        .in("status", ["pending", "confirmed"]);
      if (data) setBookedSlots(data.map(b => b.time_slot));
    }
    fetchBookedSlots();
  }, [booking.date, id]);

  function setB(k, v) { setBooking(b => ({ ...b, [k]: v })); }

  const pkg = PACKAGE_OPTIONS.find(p => p.id === bookingType) || PACKAGE_OPTIONS[0];
  const isPackage = pkg.months > 0;
  const singlePrice = tutor ? Math.round(tutor.price_per_hour * booking.duration) : 0;
  const pricePerMonth = tutor
    ? Math.round(tutor.price_per_hour * booking.duration * lessonsPerMonth * (1 - pkg.discount))
    : 0;
  const totalPrice = isPackage ? pricePerMonth : singlePrice;

  // არჩეული სტუდენტის სახელი
  const selectedStudentName = userRole === "parent"
    ? children.find(c => c.profiles?.id === selectedStudentId)?.profiles?.full_name || ""
    : currentUser?.user_metadata?.full_name || "";

  async function handleSubmit() {
    if (!selectedStudentId) {
      alert("გთხოვთ აირჩიოთ სტუდენტი");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      // Double-booking check
      const { data: existing } = await supabase
        .from("bookings")
        .select("id")
        .eq("tutor_id", id)
        .eq("date", booking.date)
        .eq("time_slot", booking.timeSlot)
        .in("status", ["pending", "confirmed"])
        .single();

      if (existing) {
        alert("ეს დრო უკვე დაჯავშნილია. გთხოვთ აირჩიოთ სხვა დრო.");
        setSubmitting(false);
        return;
      }

      if (isPackage) {
        // ── Package subscription flow ──────────────────────────────
        const res = await fetch("/api/subscriptions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tutorId: id,
            tutorName: tutor.profiles?.full_name,
            subject: tutor.subject?.[0],
            packageMonths: pkg.months,
            lessonsPerMonth,
            pricePerMonth,
            discount: pkg.discount,
            firstBookingDate: booking.date,
            firstBookingTime: booking.timeSlot,
            firstBookingDuration: booking.duration,
            firstBookingFormat: booking.format,
            note: booking.note || null,
            studentId: selectedStudentId,
          }),
        });
        const { url, error: apiErr } = await res.json();
        if (apiErr) throw new Error(apiErr);
        if (url) window.location.href = url;
      } else {
        // ── One-time payment flow (existing) ─────────────────────
        const { data: newBooking, error } = await supabase
          .from("bookings")
          .insert({
            student_id: selectedStudentId,
            tutor_id: id,
            date: booking.date,
            time_slot: booking.timeSlot,
            duration_hours: booking.duration,
            format: booking.format,
            total_price: totalPrice,
            note: booking.note || null,
            status: "pending",
          })
          .select()
          .single();

        if (error) throw error;

        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: newBooking.id,
            tutorId: id,
            tutorName: tutor.profiles?.full_name,
            subject: tutor.subject?.[0],
            date: booking.date,
            time: booking.timeSlot,
            totalPrice,
          }),
        });
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } catch (err) {
      console.error(err);
      alert("შეცდომა, სცადეთ თავიდან: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">იტვირთება...</p>
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-3">
        <p className="text-gray-500">მასწავლებელი ვერ მოიძებნა</p>
        <Link href="/search" className="btn-primary">ძებნაზე დაბრუნება</Link>
      </div>
    );
  }

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/tutor/${id}`} className="text-gray-400 hover:text-gray-600 text-xl">←</Link>
          <div>
            <h1 className="text-xl font-black text-gray-900">გაკვეთილის დაჯავშნა</h1>
            <p className="text-sm text-gray-400">{tutor.profiles?.full_name}</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[[1,"ფორმატი და ტიპი"],[2,"თარიღი და დრო"],[3,"დადასტურება"]].map(([n, label], i, arr) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all ${
                step > n ? "bg-emerald-600 text-white" :
                step === n ? "bg-emerald-600 text-white ring-4 ring-emerald-100" :
                "bg-gray-100 text-gray-400"
              }`}>
                {step > n ? "✓" : n}
              </div>
              <span className={`text-xs hidden sm:block ${step >= n ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                {label}
              </span>
              {i < arr.length - 1 && (
                <div className={`flex-1 h-px ml-2 ${step > n ? "bg-emerald-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ─── Step 1: ფორმატი + მშობლის dropdown ─── */}
        {step === 1 && (
          <div className="card p-6">
            <h2 className="font-bold text-gray-900 text-lg mb-5">ფორმატის არჩევა</h2>

            {/* მშობლის შვილების dropdown */}
            {userRole === "parent" && children.length > 0 && (
              <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm font-semibold text-blue-800 mb-2">
                  👶 ვის სახელით ჯავშნავ?
                </p>
                <div className="flex flex-col gap-2">
                  {children.map((child, i) => (
                    <label
                      key={child.id}
                      onClick={() => setSelectedStudentId(child.profiles?.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedStudentId === child.profiles?.id
                          ? "border-blue-400 bg-white"
                          : "border-blue-200 hover:border-blue-300 bg-blue-50"
                      }`}
                    >
                      <div className={`avatar w-8 h-8 text-xs ${
                        ["avatar-blue","avatar-green","avatar-amber","avatar-purple"][i % 4]
                      }`}>
                        {child.profiles?.full_name?.[0]}
                      </div>
                      <span className={`text-sm font-medium ${
                        selectedStudentId === child.profiles?.id ? "text-blue-700" : "text-gray-600"
                      }`}>
                        {child.profiles?.full_name}
                      </span>
                      <input
                        type="radio"
                        name="student"
                        checked={selectedStudentId === child.profiles?.id}
                        onChange={() => setSelectedStudentId(child.profiles?.id)}
                        className="ml-auto accent-blue-600"
                        readOnly
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ფორმატი */}
            <div className="space-y-3 mb-6">
              {[
                tutor.is_online && { value:"online", icon:"🌐", title:"ონლაინ გაკვეთილი", desc:"Google Meet / Zoom პლატფორმაზე" },
                tutor.is_offline && { value:"offline", icon:"🏫", title:"პირისპირ", desc:`${tutor.city || "მასწავლებლის ადგილზე"}` },
              ].filter(Boolean).map(opt => (
                <label
                  key={opt.value}
                  onClick={() => setB("format", opt.value)}
                  className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    booking.format === opt.value
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${booking.format === opt.value ? "text-emerald-700" : "text-gray-800"}`}>
                      {opt.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                  <input
                    type="radio"
                    name="format"
                    checked={booking.format === opt.value}
                    onChange={() => setB("format", opt.value)}
                    className="accent-emerald-600 mt-1"
                    readOnly
                  />
                </label>
              ))}
            </div>

            {/* ── Booking type ─────────────────────────────────── */}
            <div className="mt-6">
              <p className="text-sm font-bold text-gray-800 mb-3">📦 ჯავშნის სახეობა</p>
              <div className="grid grid-cols-2 gap-2">
                {PACKAGE_OPTIONS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBookingType(p.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      bookingType === p.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg leading-none">{p.icon}</span>
                      <span className={`text-sm font-bold ${bookingType === p.id ? "text-emerald-700" : "text-gray-800"}`}>
                        {p.label}
                      </span>
                      {p.discount > 0 && (
                        <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          -{Math.round(p.discount * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Lessons per month (package only) ──────────────── */}
            {isPackage && tutor && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm font-bold text-blue-800 mb-3">გაკვეთილები თვეში</p>
                <div className="flex gap-3">
                  {LESSONS_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLessonsPerMonth(n)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-center transition-all ${
                        lessonsPerMonth === n
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-blue-200 text-blue-700 hover:border-blue-400"
                      }`}
                    >
                      <p className="text-lg font-black leading-none">{n}</p>
                      <p className={`text-xs mt-0.5 ${lessonsPerMonth === n ? "text-blue-100" : "text-blue-400"}`}>გაკვ./თვ.</p>
                    </button>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200 flex justify-between items-center">
                  <span className="text-sm text-blue-700">1 თვის ღირებულება</span>
                  <span className="text-xl font-black text-blue-800">{pricePerMonth} ₾</span>
                </div>
                {pkg.discount > 0 && (
                  <p className="text-xs text-blue-600 mt-1 text-right">
                    დაზოგავთ {Math.round(tutor.price_per_hour * booking.duration * lessonsPerMonth * pkg.discount)} ₾/თვე
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={userRole === "parent" && !selectedStudentId}
              className="btn-primary w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed mt-4"
            >
              გაგრძელება →
            </button>
          </div>
        )}

        {/* ─── Step 2: თარიღი და დრო ─── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                    else setCalMonth(m => m - 1);
                  }}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >←</button>
                <p className="font-semibold text-sm">{GEO_MONTHS[calMonth]} {calYear}</p>
                <button
                  onClick={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                    else setCalMonth(m => m + 1);
                  }}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >→</button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {GEO_DAYS.map(d => (
                  <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array(firstDay).fill(null).map((_, i) => <div key={`e-${i}`} />)}
                {Array(daysInMonth).fill(null).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                  const isPast = today ? new Date(dateStr) < new Date(today.toDateString()) : false;
                  const isSelected = booking.date === dateStr;
                  return (
                    <button
                      key={day}
                      disabled={isPast}
                      onClick={() => { setB("date", dateStr); setB("timeSlot", null); }}
                      className={`h-9 w-full rounded-lg text-sm font-medium transition-all ${
                        isPast ? "text-gray-300 cursor-not-allowed" :
                        isSelected ? "bg-emerald-600 text-white" :
                        "hover:bg-emerald-50 hover:text-emerald-700 text-gray-700"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {booking.date && (
              <div className="card p-5">
                <p className="font-semibold text-sm mb-3">
                  {booking.date} — თავისუფალი დრო
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map(slot => {
                    const taken = bookedSlots.includes(slot);
                    const selected = booking.timeSlot === slot;
                    return (
                      <button
                        key={slot}
                        disabled={taken}
                        onClick={() => setB("timeSlot", slot)}
                        className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                          taken ? "border-gray-100 bg-gray-50 text-gray-300 line-through cursor-not-allowed" :
                          selected ? "border-emerald-500 bg-emerald-600 text-white" :
                          "border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {booking.timeSlot && (
              <div className="card p-5">
                <p className="font-semibold text-sm mb-3">ხანგრძლივობა</p>
                <div className="grid grid-cols-3 gap-3">
                  {DURATION_OPTIONS.map(d => (
                    <button
                      key={d.hours}
                      onClick={() => setB("duration", d.hours)}
                      className={`py-3 rounded-xl border text-center transition-all ${
                        booking.duration === d.hours
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className={`text-sm font-semibold ${booking.duration === d.hours ? "text-emerald-700" : "text-gray-700"}`}>
                        {d.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${booking.duration === d.hours ? "text-emerald-600" : "text-gray-400"}`}>
                        {Math.round(tutor.price_per_hour * d.hours)} ₾
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">← უკან</button>
              <button
                onClick={() => setStep(3)}
                disabled={!booking.date || !booking.timeSlot}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                  booking.date && booking.timeSlot ? "btn-primary" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                გაგრძელება →
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: დადასტურება ─── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="font-bold text-gray-900 mb-4">
                {isPackage ? "🔄 გამოწერის შეჯამება" : "📅 ჯავშნის შეჯამება"}
              </h2>
              <div className="space-y-3">
                {[
                  ["მასწავლებელი", tutor.profiles?.full_name],
                  ["საგანი", tutor.subject?.[0]],
                  userRole === "parent" && ["სტუდენტი", selectedStudentName],
                  ["ფორმატი", booking.format === "online" ? "🌐 ონლაინ" : "🏫 პირისპირ"],
                  ["პირველი გაკვეთილი", booking.date],
                  ["დრო", booking.timeSlot],
                  ["ხანგრძლივობა", `${booking.duration} სთ`],
                  isPackage && ["პაკეტი", `${pkg.label} · ${lessonsPerMonth} გაკვ./თვ.`],
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-400">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>

              {isPackage ? (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">დღეს გადახდა (1 თვე)</span>
                    <span className="text-2xl font-black text-emerald-600">{pricePerMonth} ₾</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">ყოველ 30 დღეში ავტომ. ჩამოიჭრება</span>
                    <span className="text-sm font-semibold text-gray-500">{pricePerMonth} ₾</span>
                  </div>
                  {pkg.months > 1 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">პაკეტის ვადა ({pkg.months} თვე)</span>
                      <span className="text-xs text-gray-500">{pkg.months * pricePerMonth} ₾ სულ</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex justify-between items-center pt-4 mt-2">
                  <span className="font-bold text-gray-900">სულ</span>
                  <span className="text-2xl font-black text-emerald-600">{totalPrice} ₾</span>
                </div>
              )}
            </div>

            {isPackage && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1.5">
                <p className="font-semibold">📋 გამოწერის პირობები</p>
                <p className="text-xs text-blue-600">✅ გაუქმება შეგიძლიათ ნებისმიერ დროს — მომდ. ჩამოჭრამდე 3 დღით ადრე</p>
                <p className="text-xs text-blue-600">⏳ გადახდა ჩავარდნის შემთხვევაში: 48 სთ შეტყობინება, შემდეგ გაყინვა</p>
                <p className="text-xs text-blue-600">💰 თანხა ჩამოეჭრება ყოველ 30 დღეში ავტომატურად</p>
              </div>
            )}

            <div className="card p-5">
              <p className="text-sm font-medium text-gray-700 mb-2">შენიშვნა (არასავ.)</p>
              <textarea
                value={booking.note}
                onChange={e => setB("note", e.target.value)}
                placeholder="მაგ: ვემზადები სახელმწიფო გამოცდისთვის..."
                rows={3}
                className="input resize-none"
              />
            </div>

            <p className="text-xs text-gray-400 text-center">
              გადახდა ხდება Stripe-ის გავლით.{isPackage ? " ბარათი ტოკენიზდება ავტო-განახლებისთვის." : " გაუქმება 24 სთ-ით ადრე."}
            </p>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1 py-3">← უკან</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex-1 py-3"
              >
                {submitting ? "მიმდინარეობს..."
                  : isPackage ? "🔄 გამოწერის გააქტ."
                  : "💳 გადახდაზე გადასვლა"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}