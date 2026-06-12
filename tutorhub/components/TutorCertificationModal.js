"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase";

export default function TutorCertificationModal({ userId, onClose }) {
  const [step, setStep]       = useState("choose"); // choose | upload | done
  const [hasCert, setHasCert] = useState(null);
  const [file, setFile]       = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg]         = useState("");
  const fileRef = useRef();

  async function handleSubmit() {
    if (!file) { setMsg("ფაილის ატვირთვა სავალდებულოა."); return; }
    if (file.size > 10 * 1024 * 1024) { setMsg("ფაილი მაქს. 10MB."); return; }

    setUploading(true);
    setMsg("");
    const supabase = createClient();

    const ext  = file.name.split(".").pop().toLowerCase();
    const path = `certs/${userId}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("tutor-docs")
      .upload(path, file, { upsert: true });

    if (upErr) {
      setMsg("ფაილის ატვირთვა ვერ მოხდა. სცადეთ ხელახლა.");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("tutor-docs")
      .getPublicUrl(path);

    const res = await fetch("/api/submit-certification", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ hasCertificate: hasCert, certFileUrl: publicUrl }),
    });

    if (!res.ok) {
      const json = await res.json();
      setMsg(json.error || "შეცდომა. სცადეთ ხელახლა.");
      setUploading(false);
      return;
    }

    setStep("done");
    setUploading(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-5 rounded-t-2xl text-white">
          <h2 className="text-lg font-black">🎓 სწავლების დადასტურება</h2>
          <p className="text-emerald-100 text-sm mt-0.5">
            ადმინი გადახედავს შენს დოკუმენტს და დაამტკიცებს პროფილს
          </p>
        </div>

        <div className="p-5">

          {/* ── choose ── */}
          {step === "choose" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-3">
                გაქვს პედაგოგიური სერტიფიკატი (NAEC, Cambridge, ლიცენზია და სხვ.)?
              </p>

              <button onClick={() => { setHasCert(true); setStep("upload"); }}
                className="w-full p-4 border-2 border-gray-100 hover:border-amber-400 rounded-2xl text-left transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-amber-50 group-hover:bg-amber-100 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all">
                    👑
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">ვარ სერტიფიცირებული მასწავლებელი</p>
                    <p className="text-xs text-gray-400 mt-0.5">ატვირთე → მოდერატორი შეამოწმებს → <strong className="text-amber-600">Certified Tutor</strong></p>
                  </div>
                  <span className="ml-auto text-gray-300 shrink-0">→</span>
                </div>
              </button>

              <button onClick={() => { setHasCert(false); setStep("upload"); }}
                className="w-full p-4 border-2 border-gray-100 hover:border-emerald-400 rounded-2xl text-left transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-50 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all">
                    🎓
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">არ ვარ სერტიფიცირებული მასწავლებელი</p>
                    <p className="text-xs text-gray-400 mt-0.5">ატვირთე დიპლომი / სტუდ. ცნობა → <strong className="text-emerald-600">Subject Expert</strong></p>
                  </div>
                  <span className="ml-auto text-gray-300 shrink-0">→</span>
                </div>
              </button>
            </div>
          )}

          {/* ── upload ── */}
          {step === "upload" && (
            <div className="space-y-4">
              <button type="button" onClick={() => { setStep("choose"); setFile(null); setMsg(""); }}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                ← უკან
              </button>

              {hasCert ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <p className="font-bold mb-1">👑 სერტიფიკატის ატვირთვა</p>
                  <p className="text-amber-700">
                    ატვირთე პედ. ლიცენზია, NAEC, Cambridge ან სხვა სერტ. — ფოტო ან PDF.
                    ადმინის დამტკიცების შემდეგ მიიღებ <strong>Certified Tutor</strong> სტატუსს.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                  <p className="font-bold mb-1.5">🎓 მტკიცებულების ატვირთვა</p>
                  <p className="text-blue-700 mb-2">სერტიფიკატის გარეშეც შეგიძლია ასწავლო — ატვირთე ერთ-ერთი:</p>
                  <ul className="text-xs text-blue-600 space-y-0.5 mb-2 ml-1">
                    <li>• სტუდენტური ცნობა ან ID</li>
                    <li>• ბაკალავრის / მაგისტრის / დოქტ. დიპლომი</li>
                    <li>• სასწავლებლის ოფიციალური ცნობა</li>
                  </ul>
                  <p className="text-xs font-semibold text-blue-700">
                    ⚠️ ადმინის დამტკიცებამდე პროფილი არ გამოჩნდება ძებნაში.
                    დამტკიცების შემდეგ — <strong>Subject Expert</strong> სტატუსი.
                  </p>
                </div>
              )}

              {/* Drop zone */}
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 hover:border-emerald-400 rounded-2xl p-6 text-center cursor-pointer transition-all">
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">{file.type.startsWith("image/") ? "🖼️" : "📄"}</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setFile(null); }}
                      className="ml-4 text-red-400 hover:text-red-600 font-bold text-lg leading-none">✕</button>
                  </div>
                ) : (
                  <>
                    <p className="text-4xl mb-2">📎</p>
                    <p className="text-sm font-semibold text-gray-700">ფაილის ასარჩევად დააჭირე</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · მაქს. 10MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />

              {msg && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">{msg}</p>
              )}

              <button onClick={handleSubmit} disabled={uploading || !file}
                className="btn-primary w-full py-3 font-bold disabled:opacity-50">
                {uploading ? "იტვირთება..." : "ადმინისთვის გაგზავნა →"}
              </button>
            </div>
          )}

          {/* ── done ── */}
          {step === "done" && (
            <div className="text-center py-4 space-y-4">
              <div className="text-5xl">✅</div>
              <div>
                <p className="font-black text-gray-900 text-lg">გაიგზავნა!</p>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed max-w-xs mx-auto">
                  შენი {hasCert ? "სერტიფიკატი" : "დოკუმენტი"} ადმინისტრაციას გადაეგზავნა.
                  1–3 სამუშაო დღეში გამოგიგზავნიან შეტყობინებას შედეგზე.
                </p>
              </div>
              <button onClick={onClose} className="btn-primary px-8 py-2.5 font-bold">
                დახურვა →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
