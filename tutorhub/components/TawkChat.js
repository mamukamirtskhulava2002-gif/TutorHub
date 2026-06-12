"use client";
import { useEffect } from "react";
import Script from "next/script";
import { createClient } from "@/lib/supabase";

const ROLE_LABEL = {
  student: "სტუდენტი",
  tutor:   "მასწავლებელი",
  parent:  "მშობელი",
  admin:   "ადმინი",
};

export default function TawkChat() {
  useEffect(() => {
    // Tawk.to internally calls console.error(true) — suppress it
    const _origError = console.error;
    console.error = (...args) => {
      if (args.length === 1 && args[0] === true) return;
      _origError.apply(console, args);
    };

    async function identifyUser() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, email, phone")
        .eq("id", session.user.id)
        .single();

      const attrs = {
        name:   profile?.full_name || session.user.email?.split("@")[0] || "სტუმარი",
        email:  profile?.email     || session.user.email || "",
        phone:  profile?.phone     || "",
        role:   ROLE_LABEL[profile?.role] || profile?.role || "",
        userId: session.user.id,
      };

      function applyAttrs() {
        if (window.Tawk_API?.setAttributes) {
          window.Tawk_API.setAttributes(attrs, err => {
            if (err) console.warn("Tawk setAttributes:", err);
          });
        }
      }

      if (window.Tawk_API?.setAttributes) {
        // Tawk.to უკვე ჩატვირთულია
        applyAttrs();
      } else {
        // Tawk.to-ს ჩატვირთვის მოლოდინი
        window.Tawk_API = window.Tawk_API || {};
        const prev = window.Tawk_API.onLoad;
        window.Tawk_API.onLoad = function () {
          if (typeof prev === "function") prev();
          applyAttrs();
        };
      }
    }

    identifyUser();

    return () => { console.error = _origError; };
  }, []);

  return (
    <Script id="tawk-to" strategy="afterInteractive">{`
      var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
      (function(){
        var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
        s1.async=true;
        s1.src='https://embed.tawk.to/6a25f32c5bdfa41c2ccf40bc/1jqi3rpoc';
        s1.charset='UTF-8';
        s1.setAttribute('crossorigin','*');
        s0.parentNode.insertBefore(s1,s0);
      })();
    `}</Script>
  );
}
