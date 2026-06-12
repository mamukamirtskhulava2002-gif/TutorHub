"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const AVATAR_COLORS = [
  "avatar-green","avatar-blue","avatar-amber","avatar-purple","avatar-coral"
];

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFavorites() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      const { data } = await supabase
        .from("favorites")
        .select(`
          id,
          tutors(
            id, price_per_hour, rating, review_count,
            subject, is_online, is_offline, is_verified, city,
            profiles(full_name)
          )
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      setFavorites(data || []);
      setLoading(false);
    }
    fetchFavorites();
  }, []);

  async function removeFavorite(favId) {
    const supabase = createClient();
    await supabase.from("favorites").delete().eq("id", favId);
    setFavorites(prev => prev.filter(f => f.id !== favId));
  }

  return (
    <div>
      <div className="dash-container">

        {/* Sidebar */}
        <div className="sidebar hidden md:flex">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">მენიუ</p>
          </div>
          <Link href="/dashboard/student" className="sidebar-link">📊 დაშბორდი</Link>
          <Link href="/search" className="sidebar-link">🔍 მასწავლებლები</Link>
          <Link href="/dashboard/student/lessons" className="sidebar-link">📅 ჩემი გაკვეთილები</Link>
          <Link href="/messages" className="sidebar-link">💬 შეტყობინებები</Link>
          <Link href="/favorites" className="sidebar-link active">❤️ ფავორიტები</Link>
          <Link href="/dashboard/student/payments" className="sidebar-link">💳 გადახდები</Link>
          <Link href="/dashboard/student/settings" className="sidebar-link">⚙️ პარამეტრები</Link>
        </div>

        {/* Main */}
        <div className="main-content">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black text-gray-900">❤️ ფავორიტები</h1>
            <Link href="/search" className="btn-primary">
              + მასწავლებლის პოვნა
            </Link>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-2xl" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-8 bg-gray-200 rounded-xl" />
                </div>
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">🤍</p>
              <p className="text-gray-600 font-semibold text-lg mb-1">ფავორიტები ცარიელია</p>
              <p className="text-gray-400 text-sm mb-6">
                მასწავლებლის პროფილზე ❤️ დააჭირეთ შესანახად
              </p>
              <Link href="/search" className="btn-primary px-6 py-3">
                მასწავლებლების ძიება →
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((fav, i) => {
                const tutor = fav.tutors;
                if (!tutor) return null;
                const name = tutor.profiles?.full_name || "მასწავლებელი";
                const initials = name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];

                return (
                  <div key={fav.id} className="card p-5 flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`avatar w-12 h-12 text-base ${color} flex-shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {tutor.subject?.slice(0,2).join(", ")}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFavorite(fav.id)}
                          className="text-red-400 hover:text-red-600 text-xl transition-all"
                          title="ფავორიტიდან წაშლა"
                        >
                          ❤️
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {tutor.is_verified && <span className="badge-green text-xs">✓ ვერიფ.</span>}
                        {tutor.is_online && <span className="badge-blue text-xs">🌐 ონლაინ</span>}
                        {tutor.is_offline && <span className="badge-amber text-xs">🏫 პირისპირ</span>}
                        {tutor.city && <span className="badge-gray text-xs">📍 {tutor.city}</span>}
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1">
                          <span className="text-amber-400 text-sm">⭐</span>
                          <span className="text-sm font-semibold">{tutor.rating}</span>
                          <span className="text-xs text-gray-400">({tutor.review_count})</span>
                        </div>
                        <span className="text-sm font-black text-gray-900">
                          {tutor.price_per_hour} ₾/სთ
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/tutor/${tutor.id}`}
                        className="flex-1 text-center text-sm py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600 transition-all font-medium"
                      >
                        პროფილი
                      </Link>
                      <Link
                        href={`/booking/${tutor.id}`}
                        className="flex-1 btn-primary text-center text-sm py-2"
                      >
                        დაჯავშნა
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}