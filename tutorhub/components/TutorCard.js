import Link from "next/link";
import { getInitials, formatDate, formatPrice, getStatusStyle, timeAgo } from "@/lib/utils";

const COLORS = ["avatar-green","avatar-blue","avatar-amber","avatar-purple","avatar-coral"];

export default function TutorCard({ tutor, index = 0, showBookBtn = false }) {
  const color = COLORS[index % COLORS.length];
  const name  = tutor.profiles?.full_name ?? "—";
  const subj  = Array.isArray(tutor.subject) ? tutor.subject : [];

  return (
    <div className="tutor-card">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`avatar w-10 h-10 text-sm flex-shrink-0 ${color}`}>
          {getInitials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{name}</p>
          <p className="text-xs text-gray-400">
            {subj[0] ?? "—"}
            {tutor.experience_years ? ` · ${tutor.experience_years} წ.` : ""}
            {tutor.city ? ` · ${tutor.city}` : ""}
          </p>
        </div>
        {tutor.is_verified && (
          <span className="text-emerald-500 text-sm flex-shrink-0" title="ვერიფიცირებული">✓</span>
        )}
      </div>

      {/* Badges */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        {subj.slice(0, 2).map(s => (
          <span key={s} className="badge-green">{s}</span>
        ))}
        {tutor.is_online   && <span className="badge-blue">ონლაინ</span>}
        {tutor.is_offline && <span className="badge-amber">პირისპირ</span>}
      </div>

      {/* Bio preview */}
      {tutor.bio && (
        <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">
          {tutor.bio}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          ⭐ {tutor.rating ?? "—"} ({tutor.review_count ?? 0})
        </span>
        <span className="text-sm font-semibold">
          {tutor.price_per_hour} ₾
          <span className="text-xs text-gray-400 font-normal"> /სთ</span>
        </span>
      </div>

      {/* Buttons */}
      {showBookBtn && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <Link
            href={`/dashboard/tutor/${tutor.id}`} // 👈 ჩავასწორე სწორ დინამიურ მისამართზე
            className="flex-1 text-center text-xs py-2 border border-gray-200 rounded-lg text-gray-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
          >
            პროფილი
          </Link>
          <Link
            href={`/booking/${tutor.id}`}
            className="flex-1 text-center text-xs py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            დაჯავშნა
          </Link>
        </div>
      )}
    </div>
  );
}