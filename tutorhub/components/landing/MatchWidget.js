"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const SUBJECTS = [
  "მათემატიკა","ფიზიკა","ქიმია","ბიოლოგია","ქართული",
  "ინგლისური","ისტორია","პროგრამირება","გეოგრაფია","ეკონომიკა",
  "გერმანული","რუსული","მუსიკა","ხელოვნება",
];

export default function MatchWidget() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [format, setFormat]   = useState("");

  function go() {
    const p = new URLSearchParams();
    if (subject) p.set("subject", subject);
    if (format)  p.set("format", format);
    router.push(`/search${p.toString() ? "?" + p.toString() : ""}`);
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.08)] border border-gray-100 p-2 flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto">
      {/* Subject */}
      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5">
        <span className="text-lg flex-shrink-0">📚</span>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full bg-transparent text-sm text-gray-700 outline-none cursor-pointer font-medium"
        >
          <option value="">რა საგანი გჭირდება?</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Format */}
      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5">
        <span className="text-lg flex-shrink-0">🌐</span>
        <select
          value={format}
          onChange={e => setFormat(e.target.value)}
          className="w-full bg-transparent text-sm text-gray-700 outline-none cursor-pointer font-medium"
        >
          <option value="">სწავლების ფორმატი</option>
          <option value="online">ონლაინ</option>
          <option value="offline">პირისპირ</option>
          <option value="both">ორივე</option>
        </select>
      </div>

      {/* CTA */}
      <button
        onClick={go}
        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all flex-shrink-0 flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        მოძებნე
      </button>
    </div>
  );
}
