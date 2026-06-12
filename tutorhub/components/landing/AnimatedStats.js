"use client";
import { useState, useEffect, useRef } from "react";

function useCountUp(target, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref     = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = Date.now();
          const tick = () => {
            const t = Math.min((Date.now() - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setCount(Math.floor(eased * target));
            if (t < 1) requestAnimationFrame(tick);
            else setCount(target);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

function StatItem({ value, label, suffix = "", dark = false }) {
  const isInt = typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
  const { count, ref } = useCountUp(isInt ? value : 0);

  return (
    <div ref={ref} className="text-center">
      <div className={`text-3xl sm:text-4xl font-black tabular-nums ${dark ? "text-white" : "text-gray-900"}`}>
        {isInt ? count.toLocaleString("ka-GE") : value}{suffix}
      </div>
      <div className={`text-xs sm:text-sm mt-1 font-medium ${dark ? "text-white/60" : "text-gray-500"}`}>{label}</div>
    </div>
  );
}

export default function AnimatedStats({ tutorsCount = 0, studentsCount = 0, avgRating = null, totalReviews = 0, dark = false }) {
  const stats = [
    { value: tutorsCount,   suffix: "+", label: "ვერიფ. მასწავლებელი" },
    { value: studentsCount, suffix: "+", label: "დარეგ. სტუდენტი" },
    ...(avgRating && totalReviews > 0
      ? [{ value: avgRating, suffix: "/5", label: `საშ. შეფასება (${totalReviews})` }]
      : []),
  ];

  return (
    <div className={`grid gap-6 sm:gap-10 ${stats.length === 3 ? "grid-cols-3" : "grid-cols-2"} max-w-lg ${dark ? "" : "mx-auto"}`}>
      {stats.map((s, i) => (
        <StatItem key={i} value={s.value} suffix={s.suffix} label={s.label} dark={dark} />
      ))}
    </div>
  );
}
