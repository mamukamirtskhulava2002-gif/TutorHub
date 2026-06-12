"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const LEVEL_LABELS = {
  school:     "🎒 სკოლის მოსწავლე",
  applicant:  "📝 აბიტურიენტი",
  university: "🎓 სტუდენტი",
  adult:      "💼 ზრდასრული",
};
const FORMAT_LABELS = {
  online:  "💻 ონლაინ",
  offline: "🏫 ოფლაინ",
  both:    "🔄 ორივე",
};
const DAY_LABELS = { mon:"ორშ", tue:"სამ", wed:"ოთხ", thu:"ხუთ", fri:"პარ", sat:"შაბ", sun:"კვი" };
const TIME_LABELS = { morning:"☀️ დილა", afternoon:"🌤️ შუადღე", evening:"🌙 საღამო" };

export default function StudentProfileForTutor() {
  const { id }   = useParams();
  const router   = useRouter();
  const [student,   setStudent]   = useState(null);
  const [history,   setHistory]   = useState([]);
  const [tutorName, setTutorName] = useState("");
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      const { data: me } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
      if (me?.role !== "tutor") { router.push("/dashboard/student"); return; }
      setTutorName(me?.full_name?.split(" ")[0] || "");

      const { data: s } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, student_level, student_grade, preferred_subjects, preferred_format, preferred_days, preferred_times, parent_name, parent_phone, region_id, municipality_id, village")
        .eq("id", id)
        .single();

      if (!s) { setNotFound(true); setLoading(false); return; }
      setStudent(s);

      // booking history between this tutor and student
      const { data: bk } = await supabase
        .from("bookings")
        .select("id, date, time_slot, status, total_price, tutors(subject)")
        .eq("tutor_id", user.id)
        .eq("student_id", id)
        .order("date", { ascending: false })
        .limit(20);
      setHistory(bk || []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />
      <main className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </main>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />
      <main className="p-8 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-gray-500">სტუდენტი ვერ მოიძებნა</p>
        <Link href="/dashboard/tutor/bookings" className="text-emerald-600 text-sm mt-4 inline-block hover:underline">← ჯავშნებზე დაბრუნება</Link>
      </main>
    </div>
  );

  const name     = student.full_name || "სტუდენტი";
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const subjects = student.preferred_subjects || [];
  const days     = student.preferred_days || [];
  const times    = student.preferred_times || [];

  const statusColor = {
    confirmed:          "text-emerald-600 bg-emerald-50",
    done:               "text-gray-500 bg-gray-50",
    cancelled:          "text-red-500 bg-red-50",
    pending:            "text-blue-600 bg-blue-50",
    completed_by_tutor: "text-amber-600 bg-amber-50",
  };

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />

      <main className="p-6 md:p-8">
        <div className="max-w-2xl">

          <Link href="/dashboard/tutor/bookings"
            className="text-sm text-gray-400 hover:text-emerald-600 flex items-center gap-1 mb-6">
            ← ჯავშნებზე დაბრუნება
          </Link>

          {/* Hero */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-5">
            <div className="flex items-center gap-4">
              {student.avatar_url ? (
                <img src={student.avatar_url} alt={name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-100 shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-black shrink-0">
                  {initials}
                </div>
              )}
              <div>
                <h1 className="text-xl font-black text-gray-900">{name}</h1>
                {student.student_level && (
                  <p className="text-sm text-gray-500 mt-0.5">{LEVEL_LABELS[student.student_level] || student.student_level}
                    {student.student_grade ? ` · ${student.student_grade} კლასი` : ""}
                  </p>
                )}
                {student.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{student.bio}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">

            {/* Preferred subjects */}
            {subjects.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-3 text-sm">📚 სასურველი საგნები</h2>
                <div className="flex flex-wrap gap-2">
                  {subjects.map(s => (
                    <span key={s} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Format + location */}
            {(student.preferred_format || student.region_id) && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-3 text-sm">📡 სწავლების პრეფერენცია</h2>
                <div className="space-y-1.5">
                  {student.preferred_format && (
                    <p className="text-sm text-gray-700">{FORMAT_LABELS[student.preferred_format] || student.preferred_format}</p>
                  )}
                  {student.region_id && (
                    <p className="text-sm text-gray-500">
                      📍 {student.region_id}
                      {student.municipality_id ? ` · ${student.municipality_id}` : ""}
                      {student.village ? ` · ${student.village}` : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Availability */}
            {(days.length > 0 || times.length > 0) && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-3 text-sm">🗓️ ხელმისაწვდომობა</h2>
                {days.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {days.map(d => (
                      <span key={d} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                        {DAY_LABELS[d] || d}
                      </span>
                    ))}
                  </div>
                )}
                {times.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {times.map(t => (
                      <span key={t} className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">
                        {TIME_LABELS[t] || t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Parent info */}
            {(student.parent_name || student.parent_phone) && (
              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                <h2 className="font-bold text-blue-800 mb-2 text-sm">👪 მშობლის კონტაქტი</h2>
                {student.parent_name  && <p className="text-sm text-blue-700">{student.parent_name}</p>}
                {student.parent_phone && (
                  <a href={`tel:${student.parent_phone}`}
                    className="text-sm text-blue-600 hover:underline font-medium">
                    {student.parent_phone}
                  </a>
                )}
              </div>
            )}

            {/* Booking history with this student */}
            {history.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-3 text-sm">📅 გაკვეთილების ისტორია</h2>
                <div className="space-y-2">
                  {history.map(b => (
                    <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm text-gray-700">
                          {b.date} · {(b.time_slot || "").slice(0, 5)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {Array.isArray(b.tutors?.subject) ? b.tutors.subject[0] : b.tutors?.subject}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[b.status] || "text-gray-500 bg-gray-50"}`}>
                          {b.status}
                        </span>
                        {b.total_price && <span className="text-xs text-gray-500">{b.total_price} ₾</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
