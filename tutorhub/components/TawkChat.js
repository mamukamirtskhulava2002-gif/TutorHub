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
    const t = setTimeout(apply, 2500);
    return () => clearTimeout(t);
  }, [pathname]);

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
        var path = window.location.pathname;
        if (path.startsWith('/auth') || path.startsWith('/register') ||
            path === '/login' || path === '/forgot-password' ||
            path.startsWith('/lesson/')) {
          Tawk_API.hideWidget();
        }

        if (window.innerWidth >= 768) return;

        function findWidget() {
          // Try known IDs first
          var ids = ['tawk-bubble-container', 'tawk-widget-container', 'tawk-tooltip'];
          for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el) return el;
          }
          // Find via iframe and walk up to fixed/absolute parent
          var iframes = document.querySelectorAll('iframe');
          for (var j = 0; j < iframes.length; j++) {
            var src = iframes[j].src || '';
            if (src.indexOf('tawk.to') > -1) {
              var p = iframes[j].parentElement;
              while (p && p !== document.body) {
                var pos = window.getComputedStyle(p).position;
                if (pos === 'fixed' || pos === 'absolute') return p;
                p = p.parentElement;
              }
              return iframes[j].parentElement;
            }
          }
          return null;
        }

        function initDrag() {
          var widgetEl = findWidget();
          if (!widgetEl) { setTimeout(initDrag, 800); return; }

          // Apply saved or default position
          try {
            var saved = localStorage.getItem('tawk_bubble_pos');
            if (saved) {
              var pos = JSON.parse(saved);
              widgetEl.style.left  = pos.l;
              widgetEl.style.right = 'auto';
              widgetEl.style.setProperty('bottom', pos.b, 'important');
            } else {
              widgetEl.style.setProperty('bottom', '80px', 'important');
            }
          } catch(e) {
            widgetEl.style.setProperty('bottom', '80px', 'important');
          }

          // Transparent overlay sits on top of the widget so touch events
          // reach us instead of the iframe inside the widget.
          var overlay = document.createElement('div');
          overlay.style.cssText =
            'position:fixed;z-index:2147483647;background:transparent;' +
            'touch-action:none;-webkit-tap-highlight-color:transparent;';
          document.body.appendChild(overlay);

          function syncOverlay() {
            var r = widgetEl.getBoundingClientRect();
            overlay.style.left   = r.left   + 'px';
            overlay.style.top    = r.top    + 'px';
            overlay.style.width  = r.width  + 'px';
            overlay.style.height = r.height + 'px';
          }
          syncOverlay();

          var sx, sy, origL, origB, dragging;

          overlay.addEventListener('touchstart', function(e) {
            var touch = e.touches[0];
            sx = touch.clientX;
            sy = touch.clientY;
            var r = widgetEl.getBoundingClientRect();
            origL = r.left;
            origB = window.innerHeight - r.bottom;
            dragging = false;
            widgetEl.style.transition = 'none';
          }, { passive: true });

          overlay.addEventListener('touchmove', function(e) {
            var touch = e.touches[0];
            var dx = touch.clientX - sx;
            var dy = touch.clientY - sy;
            if (!dragging && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            dragging = true;
            e.preventDefault();
            var r = widgetEl.getBoundingClientRect();
            var newL = Math.max(0, Math.min(window.innerWidth  - r.width,  origL + dx));
            var newB = Math.max(10, Math.min(window.innerHeight - r.height, origB - dy));
            widgetEl.style.left  = newL + 'px';
            widgetEl.style.right = 'auto';
            widgetEl.style.setProperty('bottom', newB + 'px', 'important');
            syncOverlay();
          }, { passive: false });

          overlay.addEventListener('touchend', function() {
            syncOverlay();
            if (dragging) {
              try {
                localStorage.setItem('tawk_bubble_pos', JSON.stringify({
                  l: widgetEl.style.left,
                  b: widgetEl.style.bottom
                }));
              } catch(e) {}
            } else {
              // Tap — briefly hide overlay so click reaches the widget
              overlay.style.display = 'none';
              setTimeout(function() { overlay.style.display = ''; }, 400);
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
