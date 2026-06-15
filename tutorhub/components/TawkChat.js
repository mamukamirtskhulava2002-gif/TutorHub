"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabase";

const ROLE_LABEL = {
  student: "სტუდენტი",
  tutor:   "მასწავლებელი",
  parent:  "მშობელი",
  admin:   "ადმინი",
};

// Pages where unauthenticated visitors must identify before chatting
const PRECHAT_PATHS = [
  "/", "/search", "/register", "/login",
  "/about", "/terms", "/privacy", "/refund",
  "/cancellation", "/cookies", "/contact",
];

function shouldHide(path) {
  return (
    path === "/auth" ||
    path.startsWith("/auth/") ||
    path === "/forgot-password" ||
    path === "/register/confirm" ||
    path.startsWith("/lesson/")
  );
}

function needsPreChat(path) {
  return PRECHAT_PATHS.some(p => path === p || path.startsWith(p + "?"));
}

export default function TawkChat() {
  const pathname = usePathname();
  const [showForm, setShowForm]       = useState(false);
  const [pcName, setPcName]           = useState("");
  const [pcEmail, setPcEmail]         = useState("");
  const [pcError, setPcError]         = useState("");
  const [isAuth, setIsAuth]           = useState(false);
  const [showAutoReply, setShowAutoReply] = useState(false);

  const requirePreChat = needsPreChat(pathname) && !isAuth;

  /* ── keep window flag in sync for the inline script ── */
  useEffect(() => {
    window.__tawkNeedPreChat = requirePreChat;
  }, [requirePreChat]);

  /* ── show / hide widget on route change ── */
  useEffect(() => {
    function apply() {
      if (!window.Tawk_API) return;
      shouldHide(pathname)
        ? window.Tawk_API.hideWidget?.()
        : window.Tawk_API.showWidget?.();
    }
    apply();
    const t = setTimeout(apply, 2500);
    return () => clearTimeout(t);
  }, [pathname]);

  /* ── listen for pre-chat trigger from inline script ── */
  useEffect(() => {
    const handler = () => setShowForm(true);
    window.addEventListener("tawk-show-prechat", handler);
    return () => window.removeEventListener("tawk-show-prechat", handler);
  }, []);

  /* ── auto-reply 10s after unauthenticated visitor sends first message ── */
  useEffect(() => {
    let timer = null;
    const handler = () => {
      if (isAuth) return;
      if (timer) return; // already counting
      timer = setTimeout(() => setShowAutoReply(true), 10000);
    };
    window.addEventListener("tawk-visitor-message", handler);
    return () => {
      window.removeEventListener("tawk-visitor-message", handler);
      if (timer) clearTimeout(timer);
    };
  }, [isAuth]);

  /* ── identify authenticated user ── */
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

      setIsAuth(true);
      window.__tawkNeedPreChat = false;

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
        if (!window.Tawk_API?.setAttributes) return;
        window.Tawk_API.setAttributes(attrs, err => {
          if (err) console.warn("Tawk setAttributes:", err);
        });
        window.__tawkVisitorSet = true;
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

  /* ── pre-chat form submit ── */
  function handleSubmit(e) {
    e.preventDefault();
    if (!pcName.trim()) { setPcError("სახელი სავალდებულოა"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pcEmail)) {
      setPcError("გთხოვთ მიუთითოთ სწორი ელ. ფოსტა");
      return;
    }
    setPcError("");
    window.__tawkVisitorSet = true;
    window.__tawkNeedPreChat = false;
    if (window.Tawk_API?.setAttributes) {
      window.Tawk_API.setAttributes(
        { name: pcName.trim(), email: pcEmail.trim() },
        () => {}
      );
    }
    setShowForm(false);
    window.Tawk_API?.maximize?.();
  }

  return (
    <>
      {/* ── Pre-chat panel (floating, above bubble) ── */}
      {showForm && (
        <div
          className="fixed bottom-24 right-4 z-[2147483646] w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ animation: "slideUp .2s ease" }}
        >
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
              <span className="text-white font-bold text-sm">ჩატის დაწყება</span>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="text-white/70 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center"
            >×</button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              სწრაფი პასუხისთვის გთხოვთ შეავსოთ:
            </p>
            <input
              type="text"
              placeholder="სახელი გვარი *"
              value={pcName}
              onChange={e => setPcName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 placeholder-gray-400"
            />
            <input
              type="email"
              placeholder="ელ. ფოსტა *"
              value={pcEmail}
              onChange={e => setPcEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 placeholder-gray-400"
            />
            {pcError && <p className="text-xs text-red-500">{pcError}</p>}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              ჩატის დაწყება →
            </button>
            <p className="text-xs text-gray-400 text-center">
              ან მოგვიწერეთ{" "}
              <a href="mailto:support@tutorhub.ge" className="text-emerald-600 hover:underline">
                support@tutorhub.ge
              </a>
            </p>
          </form>
        </div>
      )}

      {/* ── Auto-reply bubble (unauthenticated visitor, 10s after first message) ── */}
      {showAutoReply && (
        <div
          className="fixed bottom-24 right-4 z-[2147483646] w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ animation: "slideUp .2s ease" }}
        >
          <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
              <span className="text-white font-bold text-sm">TutorHub მხარდაჭერა</span>
            </div>
            <button
              onClick={() => setShowAutoReply(false)}
              className="text-white/70 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center"
            >×</button>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              მადლობას გიხდით ლოდინისთვის. ჩვენი ყველა აგენტი ამჟამად დაკავებულია — გთხოვთ დაელოდოთ ოპერატორს ან დატოვოთ შეტყობინება და დააფიქსიროთ თქვენთვის სასურველი ელ. ფოსტა. ჩვენ რაც შეიძლება მალე დაგიკავშირდებით.
            </p>
          </div>
        </div>
      )}

      <Script id="tawk-to" strategy="afterInteractive">{`
        var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();

        /* Fire custom event when visitor sends a message — React listens to this */
        Tawk_API.onChatMessageVisitor = function() {
          window.dispatchEvent(new CustomEvent('tawk-visitor-message'));
        };

        Tawk_API.onLoad = function () {
          /* hide on focused-flow pages */
          var path = window.location.pathname;
          if (path.startsWith('/auth') || path === '/forgot-password' ||
              path === '/register/confirm' || path.startsWith('/lesson/')) {
            Tawk_API.hideWidget();
          }

          /* Desktop: intercept chat open on public pages */
          Tawk_API.onChatMaximized = function() {
            if (window.__tawkNeedPreChat && !window.__tawkVisitorSet) {
              Tawk_API.minimize();
              window.dispatchEvent(new CustomEvent('tawk-show-prechat'));
            }
          };

          /* Mobile drag + tap interception */
          if (window.innerWidth >= 768) return;

          function findWidget() {
            var ids = ['tawk-bubble-container','tawk-widget-container','tawk-tooltip'];
            for (var i = 0; i < ids.length; i++) {
              var el = document.getElementById(ids[i]);
              if (el) return el;
            }
            var iframes = document.querySelectorAll('iframe');
            for (var j = 0; j < iframes.length; j++) {
              if ((iframes[j].src||'').indexOf('tawk.to') > -1) {
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
              var t = e.touches[0];
              sx = t.clientX; sy = t.clientY;
              var r = widgetEl.getBoundingClientRect();
              origL = r.left;
              origB = window.innerHeight - r.bottom;
              dragging = false;
              widgetEl.style.transition = 'none';
            }, { passive: true });

            overlay.addEventListener('touchmove', function(e) {
              var t = e.touches[0];
              var dx = t.clientX - sx, dy = t.clientY - sy;
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
                /* Mobile tap: show pre-chat or let click through */
                if (window.__tawkNeedPreChat && !window.__tawkVisitorSet) {
                  window.dispatchEvent(new CustomEvent('tawk-show-prechat'));
                } else {
                  overlay.style.display = 'none';
                  setTimeout(function() { overlay.style.display = ''; }, 400);
                }
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
          s1.setAttribute('crossorigin','*');
          s0.parentNode.insertBefore(s1,s0);
        })();
      `}</Script>
    </>
  );
}
