"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

const ROLES = [
  { key: "student", icon: "🎓", name: "სტუდენტი",    desc: "ვეძებ მასწავლებელს" },
  { key: "tutor",   icon: "👨‍🏫", name: "მასწავლებელი", desc: "ვასწავლი" },
  { key: "parent",  icon: "👨‍👩‍👧", name: "მშობელი",      desc: "შვილისთვის ვეძებ მასწავლებელს" },
];

const ROLE_REDIRECT = {
  tutor:   "/dashboard/tutor",
  student: "/dashboard/student",
  parent:  "/dashboard/parent",
  admin:   "/dashboard/admin",
};

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();

  const initialRole = ["tutor","parent","student"].includes(params.get("role"))
    ? params.get("role")
    : "student";

  const [role, setRole]         = useState(initialRole);
  const [form, setForm]         = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPass, setShowPass] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [ageCheck, setAgeCheck]   = useState(false);
  const [termsCheck, setTermsCheck] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleGoogle() {
    // cookie-ში ვინახავთ — query param OAuth redirect-ში იკარგება
    document.cookie = `oauth_role=${role}; path=/; max-age=300; SameSite=Lax`;
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  async function handleRegister(e) {
    e.preventDefault();

    if (form.password.length < 8) {
      setError("პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს");
      return;
    }

    // ტელეფონის ფორმატის შემოწმება (თუ შეყვანილია)
    if (form.phone.trim() && !/^\+?[\d\s\-()]{7,15}$/.test(form.phone.trim())) {
      setError("ტელეფონის ნომერი არასწორი ფორმატისაა");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?role=${role}`,
        data: { role, full_name: fullName, phone: form.phone.trim() },
      },
    });

    if (signUpError) {
      if (
        signUpError.message.includes("already registered") ||
        signUpError.message.includes("User already registered")
      ) {
        setError("ეს ელ. ფოსტა უკვე რეგისტრირებულია. გადადი შესვლის გვერდზე.");
      } else if (signUpError.message.includes("invalid")) {
        setError("ელ. ფოსტის ფორმატი არასწორია.");
      } else {
        setError("შეცდომა: " + signUpError.message);
      }
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("შეცდომა. სცადეთ ხელახლა.");
      setLoading(false);
      return;
    }

    // profile შექმნა
    await supabase.from("profiles").upsert({
      id:                   data.user.id,
      role,
      full_name:            fullName,
      email:                form.email.trim().toLowerCase(),
      phone:                form.phone.trim() || null,
      onboarding_completed: false,
    });

    if (role === "tutor") {
      await supabase.from("tutors").upsert({
        id:                   data.user.id,
        subject:              [],
        price_per_hour:       0,
        onboarding_completed: false,
        is_verified:          false,
      });
    }

    if (data.session) {
      // ელ.ფოსტის დადასტურება გამორთულია — პირდაპირ ონბორდინგი
      router.replace(
        role === "tutor"   ? "/onboarding/tutor"   :
        role === "parent"  ? "/onboarding/parent"  :
        "/onboarding/student"
      );
    } else {
      setConfirmed(true);
      setLoading(false);
    }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">
            📧
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-3">
            ელ. ფოსტა გადაამოწმე
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            <span className="font-medium text-gray-700">{form.email}</span>-ზე
            გაგზავნილია დადასტურების ბმული.
          </p>
          <Link href="/login" className="btn-primary w-full py-3 block text-center">
            შესვლის გვერდზე გადასვლა
          </Link>
          <button
            onClick={() => setConfirmed(false)}
            className="text-xs text-emerald-600 hover:underline mt-4 block mx-auto"
          >
            ხელახლა სცადე
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">

      {/* მარცხენა */}
      <div className="hidden md:flex bg-emerald-700 p-10 flex-col justify-between">
        <Link href="/" className="text-2xl font-black text-white">
          Tutor<span className="text-emerald-300">Hub</span>
        </Link>
        <div>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            დაიწყე სწავლა ან სწავლება დღესვე
          </h2>
          <p className="text-emerald-200 font-light mb-8">
            რეგისტრაცია უფასოა და 2 წუთი სჭირდება.
          </p>
          <div className="space-y-3">
            {[
              "ვერიფიცირებული მასწავლებლები",
              "Escrow — ფული გარანტირებულია",
              "ონლაინ და ოფლაინ გაკვეთილები",
              "მოქნილი განრიგი და კალენდარი",
              "გაუქმება 24 სთ-ით ადრე",
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-sm text-emerald-100">
                <div className="w-5 h-5 rounded-full bg-emerald-500/40 flex items-center justify-center text-xs flex-shrink-0">✓</div>
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-emerald-500 text-xs">© 2025 TutorHub Georgia</p>
      </div>

      {/* მარჯვენა */}
      <div className="flex items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-sm py-8">
          <Link href="/" className="text-xl font-black md:hidden mb-8 block">
            Tutor<span className="text-emerald-600">Hub</span>
          </Link>

          <h1 className="text-2xl font-black text-gray-900 mb-1">ანგარიშის შექმნა</h1>
          <p className="text-sm text-gray-400 mb-6">შეუერთდი TutorHub-ს</p>

          {/* Role selector */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ROLES.map(({ key, icon, name, desc }) => (
              <button key={key} type="button" onClick={() => setRole(key)}
                className={`border rounded-xl p-3 text-left transition-all ${
                  role === key ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                }`}>
                <div className="text-xl mb-1">{icon}</div>
                <div className={`text-xs font-semibold ${role === key ? "text-emerald-700" : "text-gray-700"}`}>
                  {name}
                </div>
                <div className="text-xs text-gray-400 leading-tight mt-0.5">{desc}</div>
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
              ❌ {error}
              {error.includes("უკვე რეგისტრირებულია") && (
                <Link href="/login" className="block mt-2 text-emerald-600 font-medium hover:underline text-xs">
                  → შესვლის გვერდზე გადასვლა
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">სახელი</label>
                <input className="input" placeholder="ანა"
                  value={form.firstName} onChange={e => set("firstName", e.target.value)} required />
              </div>
              <div>
                <label className="label">გვარი</label>
                <input className="input" placeholder="გელაშვილი"
                  value={form.lastName} onChange={e => set("lastName", e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="label">ელ. ფოსტა</label>
              <input type="email" className="input" placeholder="ana@example.com"
                value={form.email} onChange={e => set("email", e.target.value)} required />
            </div>

            <div>
              <label className="label">
                ტელეფონი <span className="text-gray-300">(არასავალდებულო)</span>
              </label>
              <input type="tel" className="input" placeholder="+995 5XX XXX XXX"
                value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>

            <div>
              <label className="label">პაროლი</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="input pr-10"
                  placeholder="მინ. 8 სიმბოლო"
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
              {form.password && (
                <div className="mt-1.5 flex gap-1">
                  {[1,2,3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      form.password.length >= i * 4
                        ? i === 1 ? "bg-red-400" : i === 2 ? "bg-amber-400" : "bg-emerald-500"
                        : "bg-gray-200"
                    }`} />
                  ))}
                </div>
              )}
            </div>

            {/* Consent checkboxes */}
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={ageCheck}
                    onChange={e => setAgeCheck(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    ageCheck ? "bg-emerald-500 border-emerald-500" : "border-gray-300 group-hover:border-emerald-400"
                  }`}>
                    {ageCheck && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                <span className="text-xs text-gray-600 leading-relaxed">
                  ვადასტურებ, რომ <strong className="text-gray-800">18 წლის ან უფროსი</strong> ვარ, ან მაქვს მშობლის / კანონიერი წარმომადგენლის თანხმობა
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={termsCheck}
                    onChange={e => setTermsCheck(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    termsCheck ? "bg-emerald-500 border-emerald-500" : "border-gray-300 group-hover:border-emerald-400"
                  }`}>
                    {termsCheck && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                <span className="text-xs text-gray-600 leading-relaxed">
                  გავეცანი და ვეთანხმები{" "}
                  <Link href="/terms" target="_blank" className="text-emerald-600 hover:underline font-medium">წესებს და პირობებს</Link>
                  {", "}
                  <Link href="/privacy" target="_blank" className="text-emerald-600 hover:underline font-medium">კონფიდ. პოლიტიკას</Link>
                  {", "}
                  <Link href="/refund" target="_blank" className="text-emerald-600 hover:underline font-medium">Refund Policy-ს</Link>
                  {", "}
                  <Link href="/cancellation" target="_blank" className="text-emerald-600 hover:underline font-medium">გაუქმების პოლიტიკასა</Link>
                  {" და "}
                  <Link href="/cookies" target="_blank" className="text-emerald-600 hover:underline font-medium">Cookie პოლიტიკას</Link>
                </span>
              </label>
            </div>

            <button type="submit" disabled={loading || !ageCheck || !termsCheck}
              className="btn-primary w-full py-3 text-base disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  მიმდინარეობს...
                </span>
              ) : "რეგისტრაცია →"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">ან</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className={`relative${(!ageCheck || !termsCheck) ? " group/google" : ""}`}>
            {(!ageCheck || !termsCheck) && (
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-20 opacity-0 group-hover/google:opacity-100 transition-opacity duration-150">
                <div className="bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-xl whitespace-nowrap shadow-lg">
                  ჯერ მონიშნე ზემოთ ორივე თანხმობა ✓
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 mx-auto" />
              </div>
            )}
            <button
              onClick={() => {
                if (!ageCheck || !termsCheck) {
                  setError("გთხოვთ, ჯერ მონიშნოთ ორივე თანხმობა");
                  return;
                }
                handleGoogle();
              }}
              className={`btn-secondary w-full py-3 flex items-center justify-center gap-2 ${
                (!ageCheck || !termsCheck) ? "opacity-40 cursor-not-allowed" : ""
              }`}>
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">G</span>
              Google-ით რეგისტრაცია
            </button>
          </div>
          <p className="text-center text-sm text-gray-400 mt-4">
            უკვე გაქვს ანგარიში?{" "}
            <Link href="/login" className="text-emerald-600 font-medium hover:underline">შედი</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}