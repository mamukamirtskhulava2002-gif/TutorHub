import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });

    const { data: parentProfile } = await supabase
      .from("profiles").select("role, full_name").eq("id", user.id).single();
    if (parentProfile?.role !== "parent")
      return NextResponse.json({ error: "წვდომა აკრძალულია" }, { status: 403 });

    const { email } = await request.json();
    if (!email?.trim())
      return NextResponse.json({ error: "ელ. ფოსტა სავალდებულოა" }, { status: 400 });

    const admin = createAdminClient();

    // Find student by email
    const { data: student } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (!student)
      return NextResponse.json({ error: "ამ ელ. ფოსტით მომხმარებელი ვერ მოიძებნა" }, { status: 404 });
    if (student.role !== "student")
      return NextResponse.json({ error: "მხოლოდ სტუდენტის ანგარიშის დამატება შეიძლება" }, { status: 400 });
    if (student.id === user.id)
      return NextResponse.json({ error: "საკუთარ თავს ვერ დაამატებ" }, { status: 400 });

    // Check not already linked in parent_children
    const { count: linkedCount } = await admin
      .from("parent_children")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", user.id)
      .eq("child_id", student.id);
    if (linkedCount > 0)
      return NextResponse.json({ error: "ეს სტუდენტი უკვე დამატებულია" }, { status: 400 });

    // Upsert invitation — resets to "pending" even if previously rejected
    const { error: invErr } = await admin
      .from("parent_invitations")
      .upsert(
        {
          parent_id:  user.id,
          student_id: student.id,
          status:     "pending",
          created_at: new Date().toISOString(),
        },
        { onConflict: "parent_id,student_id" }
      );
    if (invErr)
      return NextResponse.json({ error: "შეცდომა: " + invErr.message }, { status: 500 });

    // Notify student
    const parentName = parentProfile?.full_name || "მშობელი";
    await admin.from("notifications").insert({
      user_id: student.id,
      type:    "system",
      title:   "👨‍👩‍👧 მშობლის მოთხოვნა",
      body:    `${parentName} ითხოვს თქვენს ანგარიშთან დაკავშირებას. დაადასტურე Dashboard-ზე.`,
      is_read: false,
    });

    return NextResponse.json({
      success:     true,
      type:        "invitation_sent",
      studentName: student.full_name,
    });

  } catch (e) {
    console.error("link-child error:", e);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
