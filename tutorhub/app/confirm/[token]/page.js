"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ConfirmLessonPage() {
  const { token } = useParams();
  const [state, setState] = useState("loading"); // loading | ready | confirming | success | expired | error
  const [booking, setBooking] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/confirm/${token}`)
      .then((res) => {
        if (res.status === 404 || res.status === 410) {
          setState("expired");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.error) {
          setState("expired");
          return;
        }
        if (data.status === "done") {
          setState("success");
          setBooking(data);
          return;
        }
        setBooking(data);
        setState("ready");
      })
      .catch(() => {
        setState("error");
        setErrorMsg("სერვერთან კავშირი ვერ დამყარდა");
      });
  }, [token]);

  async function handleConfirm() {
    setState("confirming");
    try {
      const res = await fetch(`/api/confirm/${token}`, { method: "POST" });
      const data = await res.json();
      if (res.status === 410 || data.error === "ტოკენი ვადაგასულია") {
        setState("expired");
        return;
      }
      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error ?? "შეცდომა დადასტურებისას");
        return;
      }
      setState("success");
    } catch {
      setState("error");
      setErrorMsg("სერვერთან კავშირი ვერ დამყარდა");
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("ka-GE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 border-b border-emerald-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <span className="font-bold text-gray-800 text-lg">TutorHub</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* Loading */}
          {state === "loading" && (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">იტვირთება...</p>
            </div>
          )}

          {/* Ready to confirm */}
          {state === "ready" && booking && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Top accent */}
              <div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="p-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📚</span>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 mb-1">
                    გაკვეთილის დადასტურება
                  </h1>
                  <p className="text-gray-500 text-sm">
                    მასწავლებელმა გაკვეთილი დასრულებულად მონიშნა
                  </p>
                </div>

                {/* Booking details */}
                <div className="bg-emerald-50 rounded-xl p-5 space-y-3 mb-8">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">მასწავლებელი</span>
                    <span className="font-semibold text-gray-800">{booking.tutor_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">საგანი</span>
                    <span className="font-semibold text-gray-800">{booking.subject}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">თარიღი</span>
                    <span className="font-semibold text-gray-800">
                      {formatDate(booking.date)}
                    </span>
                  </div>
                  {booking.time_slot && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">დრო</span>
                      <span className="font-semibold text-gray-800">{booking.time_slot}</span>
                    </div>
                  )}
                  <div className="border-t border-emerald-200 pt-3 flex justify-between items-center">
                    <span className="text-sm text-gray-500">ღირებულება</span>
                    <span className="font-bold text-emerald-700 text-lg">
                      {booking.total_price} ₾
                    </span>
                  </div>
                </div>

                {/* Confirm button */}
                <button
                  onClick={handleConfirm}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl text-lg shadow-md hover:from-emerald-600 hover:to-teal-700 active:scale-95 transition-all duration-150"
                >
                  ✅ გაკვეთილი დავადასტურე
                </button>

                <p className="text-center text-xs text-gray-400 mt-4">
                  დადასტურების შემდეგ გადახდა გადაეცემა მასწავლებელს
                </p>
              </div>
            </div>
          )}

          {/* Confirming (loading state) */}
          {state === "confirming" && (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">მუშავდება...</p>
            </div>
          )}

          {/* Success */}
          {state === "success" && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="text-5xl">✅</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                  გაკვეთილი დადასტურდა!
                </h1>
                <p className="text-gray-600 mb-2">
                  გმადლობთ დადასტურებისთვის.
                </p>
                <p className="text-gray-500 text-sm">
                  გადახდა დამუშავდება და მასწავლებელს ჩაეთვლება.
                </p>

                <div className="mt-8 p-4 bg-emerald-50 rounded-xl">
                  <p className="text-emerald-700 text-sm font-medium">
                    გმადლობთ TutorHub-ის გამოყენებისთვის 🎓
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Expired token */}
          {state === "expired" && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-orange-400 to-red-400" />
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="text-5xl">⏰</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-3">
                  ბმული ვადაგასულია
                </h1>
                <p className="text-gray-600 mb-4">
                  ეს დადასტურების ბმული ვადაგასულია (24 სთ).
                </p>
                <p className="text-gray-500 text-sm">
                  გაკვეთილი ავტომატურად დადასტურდება სისტემის მიერ.
                  შეგიძლიათ ასევე დაადასტუროთ{" "}
                  <a
                    href="/dashboard/student/lessons"
                    className="text-emerald-600 underline font-medium"
                  >
                    Dashboard-დან
                  </a>
                  .
                </p>
              </div>
            </div>
          )}

          {/* Generic error */}
          {state === "error" && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-red-400 to-red-500" />
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="text-5xl">❌</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-3">
                  შეცდომა
                </h1>
                <p className="text-gray-600 text-sm">
                  {errorMsg || "მოულოდნელი შეცდომა. სცადეთ თავიდან."}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-6 px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                >
                  თავიდან ცდა
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400">
        © {new Date().getFullYear()} TutorHub — უსაფრთხო გადახდა
      </footer>
    </div>
  );
}
