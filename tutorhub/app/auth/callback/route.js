import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const cookieStore = await cookies();

  // role: query param (ხელით რეგ.) → cookie (Google OAuth) → default
  const VALID_ROLES = ["tutor", "parent", "student"];
  const roleFromQuery  = searchParams.get("role");
  const roleFromCookie = cookieStore.get("oauth_role")?.value;
  const role = VALID_ROLES.includes(roleFromQuery)
    ? roleFromQuery
    : VALID_ROLES.includes(roleFromCookie)
      ? roleFromCookie
      : "student";

  // cookie გასუფთავება
  try { cookieStore.set({ name: "oauth_role", value: "", maxAge: 0, path: "/" }); } catch {}

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=missing_code`);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name)             { return cookieStore.get(name)?.value; },
        set(name, value, opts){ try { cookieStore.set({ name, value, ...opts }); } catch {} },
        remove(name, opts)    { try { cookieStore.set({ name, value: "", ...opts }); } catch {} },
      },
    }
  );

  // Exchange the PKCE code for a session — this is what was missing
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(`${origin}/auth?error=exchange_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/auth`);
  }

  // Check if profile already exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // New user (first Google sign-in) — create profile
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] || "";

    await supabase.from("profiles").insert({
      id:                   user.id,
      role,
      full_name:            fullName,
      email:                user.email,
      onboarding_completed: false,
    });

    if (role === "tutor") {
      await supabase.from("tutors").insert({
        id:                   user.id,
        subject:              [],
        price_per_hour:       0,
        onboarding_completed: false,
        is_verified:          false,
      });
    }

    const dest = role === "tutor"
      ? "/onboarding/tutor"
      : role === "parent"
        ? "/onboarding/parent"
        : "/onboarding/student";
    return NextResponse.redirect(`${origin}${dest}`);
  }

  // Existing user — redirect to correct dashboard / onboarding
  const DEST = {
    tutor:   profile.onboarding_completed ? "/dashboard/tutor"   : "/onboarding/tutor",
    student: profile.onboarding_completed ? "/dashboard/student" : "/onboarding/student",
    parent:  profile.onboarding_completed ? "/dashboard/parent"  : "/onboarding/parent",
    admin:   "/dashboard/admin",
  };

  return NextResponse.redirect(`${origin}${DEST[profile.role] ?? "/dashboard"}`);
}
