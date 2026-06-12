"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const ROLE_REDIRECT = {
  tutor:   "/dashboard/tutor",
  student: "/dashboard/student",
  parent:  "/dashboard/parent",
  admin:   "/dashboard/admin",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPass, setShowPass] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    // 1. ავტორიზაცია
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      // შეცდომები ქართულად
      if (authError.message.includes("Invalid login credentials")) {
        setError("ელ. ფოსტა ან პაროლი არასწორია.");
      } else if (authError.message.includes("Email not confirmed")) {
        setError("გთხოვთ დაადასტუროთ ელ. ფოსტა. შეამოწმეთ inbox.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    // 2. role-ის ამოღება
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const role = profile?.role;
    const redirectTo = ROLE_REDIRECT[role] || "/dashboard/student";

    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // auth/callback-ზე გადამისამართება — იქ role-ის ლოგიკა
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
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
            შეუერთდი საქართველოს სასწავლო პლატფორმას
          </h2>
          <p className="text-emerald-200 font-light mb-8">
            500+ მასწავლებელი, 4200+ სტუდენტი.
          </p>
          <div className="space-y-3">
            {[
              "ვერიფიცირებული მასწავლებლები",
              "უსაფრთხო გადახდა",
              "ონლაინ და ოფლაინ გაკვეთილები",
              "გაუქმება 24 სთ-ით ადრე",
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-sm text-emerald-100">
                <div className="w-5 h-5 rounded-full bg-emerald-500/40 flex items-center justify-center text-xs">✓</div>
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-emerald-500 text-xs">© 2025 TutorHub Georgia</p>
      </div>

      {/* მარჯვენა */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <Link href="/" className="text-xl font-black md:hidden mb-8 block">
            Tutor<span className="text-emerald-600">Hub</span>
          </Link>

          <h1 className="text-2xl font-black text-gray-900 mb-1">მოგესალმებით!</h1>
          <p className="text-sm text-gray-400 mb-8">შედი შენს ანგარიშზე</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">ელ. ფოსტა</label>
              <input
                type="email"
                className="input"
                placeholder="ana@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">პაროლი</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* "პაროლი დამავიწყდა" ლინკი */}
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-emerald-600 hover:underline">
                პაროლი დამავიწყდა
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  მიმდინარეობს...
                </span>
              ) : "შესვლა →"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">ან</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button
            onClick={handleGoogle}
            className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
          >
            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
              G
            </span>
            Google-ით შესვლა
          </button>

          <p className="text-center text-sm text-gray-400 mt-6">
            ანგარიში არ გაქვს?{" "}
            <Link href="/register" className="text-emerald-600 font-medium hover:underline">
              დარეგისტრირდი
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}