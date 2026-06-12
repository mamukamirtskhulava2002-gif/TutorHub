"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { createClient } from "@/lib/supabase";

export default function LessonRoom() {
  const { id: bookingId } = useParams();
  const router = useRouter();
  const [userName, setUserName] = useState("მომხმარებელი");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;

      // წამოვიღოთ მომხმარებლის სახელი ბაზიდან, რომ ვიდეო კლასში თავისი სახელით შევიდეს
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile?.full_name) {
        setUserName(profile.full_name);
      }
      setLoading(false);
    }
    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
        <p className="animate-pulse">ვიდეო ოთახი იტვირთება...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* 👆 კომენტარი გადმოვიდა აქ, ტეგის შიგნით (fixed inset-0 ჭრის კავშირს Dashboard-თან და იშლება მთელ ეკრანზე) */}
      
      {/* ზედა მენიუ - ფიქსირებული სიმაღლით */}
      <div className="bg-gray-950 p-4 flex justify-between items-center text-white border-b border-gray-800 h-[68px] shrink-0 w-full">
        <h1 className="font-bold text-sm sm:text-base">
          🔴 ონლაინ გაკვეთილი (ოთახი: {bookingId?.slice(0, 8)})
        </h1>
        <button 
          onClick={() => router.back()} 
          className="bg-rose-600 hover:bg-rose-700 text-xs px-4 py-2 rounded-lg font-bold transition-colors"
        >
          ოთახიდან გასვლა
        </button>
      </div>

      {/* ვიდეო ზარის კონტეინერი - იკავებს დარჩენილ აბსოლუტურად ყველა წერტილს */}
      <div className="w-full flex-1 min-h-0 relative bg-gray-900">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={`TutorHub-Room-${bookingId}`} // უნიკალური ოთახი კონკრეტული ჯავშნისთვის
          containerStyles={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
          configOverwrite={{
            startWithAudioMuted: true,
            disableModeratorIndicator: true,
            startScreenSharing: false,
            enableEmailInStats: false,
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          }}
          userInfo={{
            displayName: userName
          }}
          onApiReady={(externalApi) => {
            console.log("Jitsi Meet API მზადაა");
          }}
          getIFrameRef={(iframeRef) => { 
            if (iframeRef) {
              iframeRef.style.width = '100%'; 
              iframeRef.style.height = '100%'; 
            }
          }}
        />
      </div>
    </div>
  );
}