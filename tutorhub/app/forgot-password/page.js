"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

// ─── პაროლის გადაყენების მოთხოვნა (ელ. ფოსტით) ───
function ForgotPasswordForm() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    
    // გადავცემთ პარამეტრს, რომ callback-ის შემდეგ საიტმა იცოდეს mode=update (ანუ ახალი პაროლის ფორმა აჩვენოს)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/reset-password?mode=update')}`,
    });

    if (resetError) {
      setError("შეცდომა. შეამოწმეთ ელ. ფოსტა და სცადეთ ხელახლა.");
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">
          📧
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">შეამოწმე ელ. ფოსტა</h2>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          <span className="font-medium text-gray-700">{email}</span>-ზე
          გაგზავნილია პაროლის გადაყენების ბმული.
        </p>
        <Link href="/login" className="btn-primary w-full py-3 block text-center">
          შესვლის გვერდზე დაბრუნება
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 mb-1">პაროლი დაგავიწყდა?</h1>
        <p className="text-sm text-gray-400">
          ჩაწერე შენი ელ. ფოსტა — გამოგიგზავნით გადაყენების ბმულს.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              იგზავნება...
            </span>
          ) : "გადაყენების ბმულის გაგზავნა →"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-5">
        გახსენდა?{" "}
        <Link href="/login" className="text-emerald-600 font-medium hover:underline">
          შესვლა
        </Link>
      </p>
    </>
  );
}

// ─── ახალი პაროლის დაყენება (ბმულიდან მოსვლის შემდეგ) ───
function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [ready, setReady]         = useState(false);

  // Supabase ბმულიდან სესიის მიღება
  useEffect(() => {
    const supabase = createClient();
    
    // ვინაიდან Next.js PKCE თავსებადია, იუზერი ხშირად უკვე შესულია (სესია აქვს ქუქიში).
    // ამიტომ პირდაპირ ვამოწმებთ მიმდინარე იუზერს, რომ არ გაიჭედოს.
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session?.user) {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს.");
      return;
    }
    if (password !== confirm) {
      setError("პაროლები არ ემთხვევა.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError("შეცდომა. სცადეთ ხელახლა. შესაძლოა ბმულს ვადა გაუვიდა.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/auth"), 2000);
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">
          ✅
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">პაროლი შეიცვალა!</h2>
        <p className="text-sm text-gray-400">გადადიხარ შესვლის გვერდზე...</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-400">სესია იტვირთება...</p>
        <p className="text-xs text-gray-300 mt-2">
          თუ დიდხანს ელოდები —{" "}
          <Link href="/reset-password" className="text-emerald-600 hover:underline">
            ხელახლა სცადე
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 mb-1">ახალი პაროლი</h1>
        <p className="text-sm text-gray-400">ჩაწერე ახალი პაროლი.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">ახალი პაროლი</label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              className="input pr-10"
              placeholder="მინ. 8 სიმბოლო"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {showPass ? "🙈" : "👁️"}
            </button>
          </div>
          {/* სიმტკიცის ინდიკატორი */}
          {password && (
            <div className="mt-1.5 flex gap-1">
              {[1,2,3].map(i => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                  password.length >= i * 4
                    ? i === 1 ? "bg-red-400" : i === 2 ? "bg-amber-400" : "bg-emerald-500"
                    : "bg-gray-200"
                }`} />
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label">პაროლის დადასტურება</label>
          <input
            type="password"
            className="input"
            placeholder="გაიმეორეთ პაროლი"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
          {confirm && password !== confirm && (
            <p className="text-xs text-red-500 mt-1">პაროლები არ ემთხვევა</p>
          )}
          {confirm && password === confirm && password.length >= 8 && (
            <p className="text-xs text-emerald-600 mt-1">✓ პაროლები ემთხვევა</p>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              იცვლება...
            </span>
          ) : "პაროლის შეცვლა →"}
        </button>
      </form>
    </>
  );
}

// ─── მთავარი კომპონენტი ───
function ResetPasswordContent() {
  const params = useSearchParams();
  const mode   = params.get("mode"); // "update" = ბმულიდან მოვიდა

  return (
    <div className="min-h-screen grid md:grid-cols-2">

      {/* მარცხენა */}
      <div className="hidden md:flex bg-emerald-700 p-10 flex-col justify-between">
        <Link href="/" className="text-2xl font-black text-white">
          Tutor<span className="text-emerald-300">Hub</span>
        </Link>
        <div>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            {mode === "update" ? "ახალი პაროლის დაყენება" : "პაროლის გადაყენება"}
          </h2>
          <p className="text-emerald-200 font-light">
            {mode === "update"
              ? "ჩაწერე ახალი, უსაფრთხო პაროლი."
              : "გამოგიგზავნით ბმულს ელ. ფოსტაზე."}
          </p>
        </div>
        <p className="text-emerald-500 text-xs">© 2025 TutorHub Georgia</p>
      </div>

      {/* მარჯვენა */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <Link href="/" className="text-xl font-black md:hidden mb-8 block">
            Tutor<span className="text-emerald-600">Hub</span>
          </Link>

          {mode === "update" ? <UpdatePasswordForm /> : <ForgotPasswordForm />}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}