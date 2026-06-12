import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request) {
  try {
    // 1. Verify caller is a logged-in parent
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "parent") {
      return NextResponse.json({ error: "წვდომა აკრძალულია" }, { status: 403 });
    }

    // 2. Parse body
    const { firstName, lastName, email, phone, password, grade } = await request.json();
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "სავალდებულო ველები არ არის შევსებული" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს" }, { status: 400 });
    }

    const admin    = createAdminClient();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const childEmail = email.trim().toLowerCase();

    // 3. Create child auth user with admin client (doesn't touch parent's session)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email:            childEmail,
      password:         password,
      email_confirm:    true,
      user_metadata:    { full_name: fullName, role: "student" },
    });

    if (createErr) {
      const msg = createErr.message?.includes("already been registered")
        ? "ეს ელ. ფოსტა უკვე რეგისტრირებულია."
        : createErr.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const childId = created.user.id;

    // 4. Create child profile
    await admin.from("profiles").upsert({
      id:                   childId,
      role:                 "student",
      full_name:            fullName,
      email:                childEmail,
      phone:                phone?.trim() || null,
      student_level:        grade || null,
      onboarding_completed: true,
    });

    // 5. Link child to parent
    await admin.from("parent_children").insert({
      parent_id: user.id,
      child_id:  childId,
    });

    return NextResponse.json({ success: true, childId, email: childEmail, fullName });

  } catch (e) {
    console.error("create-child error:", e);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
