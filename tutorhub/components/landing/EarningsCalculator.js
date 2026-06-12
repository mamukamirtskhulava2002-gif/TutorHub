"use client";
import { useState } from "react";
import Link from "next/link";

export default function EarningsCalculator() {
  const [hours, setHours] = useState(12);
  const [rate,  setRate]  = useState(45);

  const monthly = hours * rate * 4;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
      <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest mb-4">
        💰 შემოსავლის კალკულატორი
      </p>

      {/* Hours slider */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/80 text-sm">კვირაში საათები</span>
          <span className="text-white font-bold text-lg">{hours} სთ</span>
        </div>
        <input
          type="range" min={2} max={40} step={1} value={hours}
          onChange={e => setHours(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-emerald-400
                     bg-white/20"
        />
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>2 სთ</span><span>40 სთ</span>
        </div>
      </div>

      {/* Rate slider */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/80 text-sm">ტარიფი / საათი</span>
          <span className="text-white font-bold text-lg">{rate}₾</span>
        </div>
        <input
          type="range" min={15} max={150} step={5} value={rate}
          onChange={e => setRate(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-emerald-400
                     bg-white/20"
        />
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>15₾</span><span>150₾</span>
        </div>
      </div>

      {/* Result */}
      <div className="bg-white/10 rounded-xl p-4 mb-5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-white/70 text-sm">კვირაში</span>
          <span className="text-white font-semibold">{(hours * rate).toLocaleString()}₾</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/70 text-sm font-medium">თვეში სულ</span>
          <span className="text-3xl font-black text-white">~{monthly.toLocaleString()}₾</span>
        </div>
      </div>

      <Link
        href="/register?role=tutor"
        className="block w-full bg-white text-emerald-700 font-bold py-3 rounded-xl text-center text-sm hover:bg-emerald-50 transition-colors active:scale-95"
      >
        დაიწყე სწავლება →
      </Link>
    </div>
  );
}
