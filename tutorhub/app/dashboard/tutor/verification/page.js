"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import DashboardSidebar from "@/components/DashboardSidebar";
import TutorCertificationModal from "@/components/TutorCertificationModal";

export default function TutorVerificationPage() {
  const router = useRouter();

  const [loading, setLoading]       = useState(true);
  const [tutorName, setTutorName]   = useState("მასწავლებელი");
  const [userId, setUserId]         = useState(null);
  const [tutorData, setTutorData]   = useState(null);
  const [showModal, setShowModal]   = useState(false);

  const [videoFile, setVideoFile]   = useState(null);
  const [videoUp, setVideoUp]       = useState(false);
  const [videoMsg, setVideoMsg]     = useState({ type: "", text: "" });
  const videoRef = useRef();

  async function loadTutor(uid) {
    const supabase = createClient();
    const { data: tutor } = await supabase
      .from("tutors")
      .select("tier, license_status, has_certificate, cert_file_url, intro_video_url, license_notes, rating, review_count, is_verified")
      .eq("id", uid).single();
    setTutorData(tutor);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }

      const uid = session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from("profiles").select("full_name, role").eq("id", uid).single();
      if (profile?.role !== "tutor") { router.push("/dashboard"); return; }
      if (profile?.full_name) setTutorName(profile.full_name.split(" ")[0]);

      await loadTutor(uid);
      setLoading(false);
    }
    init();
  }, []);

  async function uploadVideo() {
    if (!videoFile || !userId) return;
    if (videoFile.size > 200 * 1024 * 1024) {
      setVideoMsg({ type: "error", text: "ვიდეო მაქს. 200MB." }); return;
    }
    setVideoUp(true);
    setVideoMsg({ type: "", text: "" });
    const supabase = createClient();
    const ext  = videoFile.name.split(".").pop().toLowerCase();
    const path = `videos/${userId}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("tutor-videos")
      .upload(path, videoFile, { upsert: true });
    if (upErr) {
      setVideoMsg({ type: "error", text: "ატვირთვა ვერ მოხდა: " + upErr.message });
      setVideoUp(false); return;
    }
    const { data: { publicUrl } } = supabase.storage.from("tutor-videos").getPublicUrl(path);
    const { error: updateErr } = await supabase.from("tutors")
      .update({ intro_video_url: publicUrl }).eq("id", userId);
    if (updateErr) {
      setVideoMsg({ type: "error", text: "განახლება ვერ მოხდა." });
      setVideoUp(false); return;
    }
    setTutorData(d => ({ ...d, intro_video_url: publicUrl }));
    setVideoMsg({ type: "success", text: "✅ ვიდეო ატვირთულია!" });
    setVideoFile(null);
    setVideoUp(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName="" />
      <main className="p-8">
        <div className="animate-pulse space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
        </div>
      </main>
    </div>
  );

  const status = tutorData?.license_status || "none";

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />

      <main className="p-6 md:p-8 max-w-2xl">

        <h1 className="text-2xl font-black text-gray-900 mb-6">🏆 სერტიფიკაცია</h1>

        {/* ── none: never submitted ── */}
        {status === "none" && (
          <div className="card p-6 border-2 border-orange-200 bg-orange-50 mb-6">
            <p className="font-black text-orange-800 text-lg mb-1">⚠️ დოკუმენტი ჯერ არ გაგიგზავნია</p>
            <p className="text-sm text-orange-700 mb-4 leading-relaxed">
              ადმინის დამტკიცებამდე შენი პროფილი <strong>ვერ გამოჩნდება ძებნაში</strong> და ვერ მიიღებ ჯავშნებს.
              ატვირთე სერტიფიკატი ან სტუდ./დიპლომის ცნობა.
            </p>
            <button onClick={() => setShowModal(true)}
              className="btn-primary py-2.5 px-6 font-bold">
              📎 დოკუმენტის ატვირთვა →
            </button>
          </div>
        )}

        {/* ── pending ── */}
        {status === "pending" && (
          <div className="card p-6 border-2 border-blue-200 bg-blue-50 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-4xl">⏳</span>
              <div>
                <p className="font-black text-blue-800 text-lg">განხილვაშია</p>
                <p className="text-sm text-blue-600 mt-1 leading-relaxed">
                  ადმინისტრაცია გადახედავს შენს {tutorData?.has_certificate ? "სერტიფიკატს" : "დოკუმენტს"}.
                  1–3 სამუშაო დღეში გამოგიგზავნიან შეტყობინებას.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── approved ── */}
        {status === "approved" && (
          <div className={`card p-6 border-2 mb-6 ${
            tutorData?.tier === "certified"
              ? "border-amber-300 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}>
            <div className="flex items-start gap-4">
              <span className="text-4xl">{tutorData?.tier === "certified" ? "👑" : "🎓"}</span>
              <div>
                <p className={`font-black text-lg ${tutorData?.tier === "certified" ? "text-amber-800" : "text-emerald-800"}`}>
                  {tutorData?.tier === "certified" ? "Certified Tutor!" : "Subject Expert!"}
                </p>
                <p className={`text-sm mt-1 leading-relaxed ${tutorData?.tier === "certified" ? "text-amber-700" : "text-emerald-700"}`}>
                  🎉 გილოცავ! ადმინმა დაადასტურა შენი პროფილი.
                  შენი გვერდი ახლა ხილვადია ძებნაში და შეგიძლია ჩაატარო გაკვეთილები.
                </p>
                {tutorData?.license_notes && (
                  <p className={`text-xs mt-2 italic ${tutorData?.tier === "certified" ? "text-amber-600" : "text-emerald-600"}`}>
                    ადმინის კომენტარი: {tutorData.license_notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── rejected ── */}
        {status === "rejected" && (
          <div className="card p-6 border-2 border-red-200 bg-red-50 mb-6">
            <p className="font-black text-red-700 text-lg mb-3">❌ განაცხადი არ დამტკიცდა</p>
            {tutorData?.license_notes && (
              <div className="bg-white border border-red-100 rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">ადმინისტრაციის კომენტარი</p>
                <p className="text-sm text-red-700">{tutorData.license_notes}</p>
              </div>
            )}
            <p className="text-sm text-red-600 mb-4">
              შეგიძლიათ განახლებული დოკუმენტით ხელახლა შეიტანოთ განაცხადი.
            </p>
            <button onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-all">
              📎 ხელახლა შეტანა →
            </button>
          </div>
        )}

        {/* ── tiers info (when not yet approved) ── */}
        {status !== "approved" && (
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="card p-5 border-2 border-gray-100">
              <div className="text-3xl mb-2">🎓</div>
              <p className="font-bold text-gray-900 mb-1">Subject Expert</p>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                სტუდ. ცნობა ან დიპლომი → ადმინი ამტკიცებს
              </p>
              <div className="space-y-1">
                <p className="text-xs text-gray-400">✓ ძებნაში გამოჩენა</p>
                <p className="text-xs text-gray-400">✓ ჯავშნების მიღება</p>
                <p className="text-xs text-gray-300">✗ ოქროსფერი ბეჯი</p>
              </div>
            </div>
            <div className="card p-5 border-2 border-amber-300 bg-amber-50/30">
              <div className="text-3xl mb-2">👑</div>
              <p className="font-bold text-amber-800 mb-1">Certified Tutor</p>
              <p className="text-xs text-amber-700 leading-relaxed mb-3">
                პედ. სერტიფიკატი ან NAEC/Cambridge → ადმინი ამტკიცებს
              </p>
              <div className="space-y-1">
                <p className="text-xs text-amber-700">✓ ოქროსფერი ჩარჩო</p>
                <p className="text-xs text-amber-700">✓ 👑 Certified ბეჯი</p>
                <p className="text-xs text-amber-700">✓ ძებნის პრიორიტეტი</p>
                <p className="text-xs text-amber-700">✓ მეტი სანდოობა</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Video intro (recommendation, after approval) ── */}
        {status === "approved" && (
          <div className="card p-6 border-2 border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-black text-gray-900">🎥 ვიდეო-წარდგენა</h2>
              <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                რეკომენდებული
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              1–2 წუთიანი ვიდეო წარდგენა <strong>3×-ით მეტ სტუდენტს</strong> მოგიყვანს.
              წარადგინე თავი, მოყვი შენი გამოცდილება და რატომ ხარ კარგი მასწავლებელი.
            </p>

            {tutorData?.intro_video_url ? (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl">🎥</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-800">ვიდეო ატვირთულია</p>
                    <a href={tutorData.intro_video_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:underline">
                      ვიდეოს ნახვა ↗
                    </a>
                  </div>
                  <button onClick={() => videoRef.current?.click()}
                    className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg flex-shrink-0">
                    შეცვლა
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => videoRef.current?.click()}
                className="border-2 border-dashed border-gray-200 hover:border-emerald-400 rounded-2xl p-6 text-center cursor-pointer transition-all mb-3">
                {videoFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">🎬</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{videoFile.name}</p>
                      <p className="text-xs text-gray-400">{(videoFile.size / 1024 / 1024).toFixed(0)} MB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setVideoFile(null); }}
                      className="ml-4 text-red-400 hover:text-red-600 font-bold text-lg leading-none">✕</button>
                  </div>
                ) : (
                  <>
                    <p className="text-4xl mb-2">🎬</p>
                    <p className="text-sm font-semibold text-gray-700">ვიდეოს ასატვირთად დააჭირე</p>
                    <p className="text-xs text-gray-400 mt-1">MP4, MOV, AVI · მაქს. 200MB · რეკ. 1–2 წუთი</p>
                  </>
                )}
              </div>
            )}

            <input ref={videoRef} type="file" accept="video/*" className="hidden"
              onChange={e => e.target.files?.[0] && setVideoFile(e.target.files[0])} />

            {videoMsg.text && (
              <p className={`text-sm px-4 py-2.5 rounded-xl mb-3 ${
                videoMsg.type === "error"
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}>{videoMsg.text}</p>
            )}

            {videoFile && (
              <button onClick={uploadVideo} disabled={videoUp}
                className="btn-primary w-full py-3 font-bold disabled:opacity-50">
                {videoUp ? "იტვირთება..." : "🎥 ვიდეოს ატვირთვა"}
              </button>
            )}
          </div>
        )}

      </main>

      {/* Certification modal */}
      {showModal && userId && (
        <TutorCertificationModal
          userId={userId}
          onClose={async () => {
            setShowModal(false);
            await loadTutor(userId);
          }}
        />
      )}
    </div>
  );
}
