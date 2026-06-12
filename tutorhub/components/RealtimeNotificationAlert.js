"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function RealtimeNotificationAlert() {
  const router = useRouter();
  const [alert, setAlert] = useState(null); // { title, body, type }
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    let channel;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      channel = supabase
        .channel("notification-alert-" + user.id)
        .on(
          "postgres_changes",
          {
            event:  "INSERT",
            schema: "public",
            table:  "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new;
            // show modal for all system notifications (cert approve/reject)
            if (n?.type === "system") {
              setAlert({ title: n.title, body: n.body });
            }
          }
        )
        .subscribe();
    }

    init();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  if (!alert) return null;

  const isRejected = alert.title?.includes("არ დამტკიცდა") || alert.title?.includes("უარყოფ");
  const isApproved = alert.title?.includes("დადასტურდა") || alert.title?.includes("დამტკიცდა");

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in">

        {/* Header */}
        <div className={`p-5 ${
          isRejected
            ? "bg-gradient-to-r from-red-500 to-red-600"
            : isApproved
              ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
              : "bg-gradient-to-r from-blue-500 to-blue-600"
        } text-white`}>
          <p className="text-xl font-black">{alert.title}</p>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {alert.body}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex flex-col gap-2">
          {isRejected && (
            <button
              onClick={() => {
                setAlert(null);
                router.push("/dashboard/tutor/verification");
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all">
              📋 ხელახლა განაცხადის შეტანა →
            </button>
          )}
          {isApproved && (
            <button
              onClick={() => {
                setAlert(null);
                router.push("/dashboard/tutor");
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all">
              🎉 დაშბორდზე გადასვლა →
            </button>
          )}
          <button
            onClick={() => setAlert(null)}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-all">
            გასაგებია, დახურვა
          </button>
        </div>

      </div>
    </div>
  );
}
