import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { tutorId, action, notes } = await request.json();
  if (!tutorId || !["approve", "reject"].includes(action))
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const admin = createAdminClient();
  const now   = new Date().toISOString();

  if (action === "approve") {
    const { data: tutorInfo } = await admin
      .from("tutors").select("has_certificate").eq("id", tutorId).single();

    const newTier = tutorInfo?.has_certificate === true ? "certified" : "expert";

    await admin.from("tutors").update({
      tier:                 newTier,
      license_status:       "approved",
      is_verified:          true,
      license_reviewed_at:  now,
      license_notes:        notes || null,
    }).eq("id", tutorId);

    const title = newTier === "certified"
      ? "🎉 სერტიფიკაცია დადასტურდა!"
      : "🎉 პროფილი დადასტურდა!";
    const body = newTier === "certified"
      ? `გილოცავ! ადმინმა დაადასტურა შენი სერტიფიკატი. შენ ახლა ხარ 👑 Certified Tutor — ოქროსფერი ბეჯი გამოჩნდება შენს პროფილზე. შეგიძლია ჩაატარო გაკვეთილები!${notes ? ` ადმინის კომენტარი: "${notes}"` : ""}`
      : `გილოცავ! ადმინმა დაადასტურა შენი პროფილი. შენ ახლა ხარ 🎓 Subject Expert — შეგიძლია ჩაატარო გაკვეთილები და მიიღო ჯავშნები!${notes ? ` ადმინის კომენტარი: "${notes}"` : ""}`;

    await admin.from("notifications").insert({
      user_id: tutorId,
      type:    "system",
      title,
      body,
      is_read: false,
    });
  } else {
    await admin.from("tutors").update({
      license_status:       "rejected",
      license_reviewed_at:  now,
      license_notes:        notes || null,
    }).eq("id", tutorId);

    await admin.from("notifications").insert({
      user_id: tutorId,
      type:    "system",
      title:   "📋 განაცხადი არ დამტკიცდა",
      body:    notes
        ? `სამწუხაროდ, განაცხადი ვერ დამტკიცდა. ადმინის კომენტარი: "${notes}". სურვილის შემთხვევაში შეგიძლია ხელახლა შეიტანო განაცხადი ვერიფიკაციის გვერდიდან.`
        : "სამწუხაროდ, განაცხადი ვერ დამტკიცდა. სურვილის შემთხვევაში შეგიძლია ხელახლა შეიტანო განაცხადი ვერიფიკაციის გვერდიდან.",
      is_read: false,
    });
  }

  return NextResponse.json({ success: true });
}
