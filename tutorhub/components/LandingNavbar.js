"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const t = scrolled;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      t ? "bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100" : "bg-gradient-to-b from-black/40 to-transparent"
    }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className={`font-black text-xl flex-shrink-0 transition-colors duration-300 ${
          t ? "text-gray-900" : "text-white"
        }`}>
          Tutor<span className={t ? "text-emerald-600" : "text-emerald-400"}>Hub</span>
        </Link>

        {/* Center nav — desktop only */}
        <div className="hidden md:flex items-center gap-7">
          {[
            { href: "/about",        label: "ჩვენს შესახებ",  isLink: true },
            { href: "/search",       label: "მასწავლებლები",  isLink: true },
            { href: "#how-it-works", label: "როგორ მუშაობს", isLink: false },
            { href: "#for-tutors",   label: "მასწავლებლებს",  isLink: false },
          ].map(({ href, label, isLink }) =>
            isLink ? (
              <Link key={href} href={href}
                className={`text-sm font-medium transition-colors duration-300 ${
                  t ? "text-gray-600 hover:text-gray-900" : "text-white/85 hover:text-white"
                }`}>
                {label}
              </Link>
            ) : (
              <a key={href} href={href}
                className={`text-sm font-medium transition-colors duration-300 ${
                  t ? "text-gray-600 hover:text-gray-900" : "text-white/85 hover:text-white"
                }`}>
                {label}
              </a>
            )
          )}
        </div>

        {/* Right CTA — desktop */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/auth"
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
              t ? "text-gray-700 hover:text-gray-900 hover:bg-gray-100" : "text-white/85 hover:text-white hover:bg-white/10"
            }`}>
            შესვლა
          </Link>
          <Link href="/register?role=tutor"
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
              t ? "bg-gray-900 text-white hover:bg-gray-700" : "bg-white/15 backdrop-blur-sm text-white border border-white/30 hover:bg-white/25"
            }`}>
            გახდი მასწავლებელი
          </Link>
          <Link href="/register"
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 transition-colors">
            რეგისტრაცია →
          </Link>
        </div>

        {/* Hamburger — mobile */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="md:hidden p-2 rounded-xl transition-colors"
          aria-label="menu"
        >
          <span className={`block w-5 h-0.5 mb-1 transition-colors duration-300 ${t ? "bg-gray-700" : "bg-white"}`} />
          <span className={`block w-5 h-0.5 mb-1 transition-colors duration-300 ${t ? "bg-gray-700" : "bg-white"}`} />
          <span className={`block w-3 h-0.5 transition-colors duration-300 ${t ? "bg-gray-700" : "bg-white"}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-3">
          <Link href="/about" className="text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>ჩვენს შესახებ</Link>
          <Link href="/search" className="text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>მასწავლებლები</Link>
          <a href="#how-it-works" className="text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>
            როგორ მუშაობს
          </a>
          <a href="#for-tutors" className="text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>
            მასწავლებლებს
          </a>
          <hr className="border-gray-100" />
          <Link href="/auth" className="btn-secondary text-center text-sm py-3">შესვლა</Link>
          <Link href="/register" className="btn-primary text-center text-sm py-3">რეგისტრაცია →</Link>
        </div>
      )}
    </nav>
  );
}
