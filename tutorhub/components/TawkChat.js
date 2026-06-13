"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabase";

const ROLE_LABEL = {
  student: "სტუდენტი",
  tutor:   "მასწავლებელი",
  parent:  "მშობელი",
  admin:   "ადმინი",
};

function shouldHide(path) {
  return (
    path === "/auth" ||
    path.startsWith("/auth/") ||
    path === "/register" ||
    path.startsWith("/register/") ||
    path === "/login" ||
    path === "/forgot-password" ||
    path.startsWith("/lesson/")
  );
}

export default function TawkChat() {
  const pathname = usePathname();

  // Show/hide widget on route change
  useEffect(() => {
    function apply() {
      if (!window.Tawk_API) return;
      if (shouldHide(pathname)) {
        window.Tawk_API.hideWidget?.();
      } else {
        window.Tawk_API.showWidget?.();
      }
    }
    apply();
    // Retry once after widget might have loaded
    const t = setTimeout(apply, 2500);
    return () => clearTimeout(t);
  }, [pathname]);

  // Error suppression + user identification
  useEffect(() => {
    const _origError = console.error;
    console.error = (...args) => {
      if (args.length === 1 && args[0] === true) return;
      const msg = typeof args[0] === "string" ? args[0] : "";
      if (msg.startsWith("[Tawk/") || msg.includes("tawk.to")) return;
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
        applyAttrs();
      } else {
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
      var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();

      Tawk_API.onLoad = function () {
        // Hide on restricted pages on first load
        var path = window.location.pathname;
        if (path.startsWith('/auth') || path.startsWith('/register') ||
            path === '/login' || path === '/forgot-password' ||
            path.startsWith('/lesson/')) {
          Tawk_API.hideWidget();
        }

        // Draggable bubble — mobile only
        if (window.innerWidth >= 768) return;

        function initDrag() {
          var el = document.getElementById('tawk-bubble-container');
          if (!el) { setTimeout(initDrag, 500); return; }

          // Restore saved position or set default above bottom nav
          try {
            var saved = localStorage.getItem('tawk_bubble_pos');
            if (saved) {
              var p = JSON.parse(saved);
              el.style.left   = p.l;
              el.style.right  = 'auto';
              el.style.setProperty('bottom', p.b, 'important');
            } else {
              el.style.setProperty('bottom', '80px', 'important');
            }
          } catch(e) {
            el.style.setProperty('bottom', '80px', 'important');
          }

          var sx, sy, origL, origB, dragging;

          el.addEventListener('touchstart', function(e) {
            var touch = e.touches[0];
            sx = touch.clientX;
            sy = touch.clientY;
            var rect = el.getBoundingClientRect();
            origL = rect.left;
            origB = window.innerHeight - rect.bottom;
            dragging = false;
            el.style.transition = 'none';
          }, { passive: true });

          el.addEventListener('touchmove', function(e) {
            var touch = e.touches[0];
            var dx = touch.clientX - sx;
            var dy = touch.clientY - sy;
            if (!dragging && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            dragging = true;
            e.preventDefault();
            var rect = el.getBoundingClientRect();
            var newL = Math.max(0, Math.min(window.innerWidth  - rect.width,  origL + dx));
            var newB = Math.max(10, Math.min(window.innerHeight - rect.height, origB - dy));
            el.style.left  = newL + 'px';
            el.style.right = 'auto';
            el.style.setProperty('bottom', newB + 'px', 'important');
          }, { passive: false });

          el.addEventListener('touchend', function() {
            if (dragging) {
              try {
                localStorage.setItem('tawk_bubble_pos', JSON.stringify({
                  l: el.style.left,
                  b: el.style.bottom
                }));
              } catch(e) {}
            }
          });
        }

        initDrag();
      };

      (function(){
        var s1 = document.createElement("script"),
            s0 = document.getElementsByTagName("script")[0];
        s1.async = true;
        s1.src = 'https://embed.tawk.to/6a25f32c5bdfa41c2ccf40bc/1jqi3rpoc';
        s1.charset = 'UTF-8';
        s1.setAttribute('crossorigin', '*');
        s0.parentNode.insertBefore(s1, s0);
      })();
    `}</Script>
  );
}
