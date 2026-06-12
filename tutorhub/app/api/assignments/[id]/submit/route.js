import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request, { params }) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("role, full_name").eq("id", user.id).single();
    if (profile?.role !== "student")
      return NextResponse.json({ error: "მხოლოდ მოსწავლეს შეუძლია" }, { status: 403 });

    const { id: assignmentId } = await params;
    const body = await request.json();
    const { fileUrl, fileName, comment } = body;

    if (!fileUrl && !comment?.trim())
      return NextResponse.json({ error: "ჩაწერეთ კომენტარი ან ატვირთეთ ფაილი" }, { status: 400 });

    const admin = createAdminClient();

    const { data: assignment } = await admin
      .from("assignments")
      .select("id, tutor_id, student_id, title")
      .eq("id", assignmentId)
      .single();
    if (!assignment || assignment.student_id !== user.id)
      return NextResponse.json({ error: "დავალება ვერ მოიძებნა" }, { status: 404 });

    const { data, error } = await admin
      .from("assignment_submissions")
      .insert({
        assignment_id: assignmentId,
        student_id: user.id,
        file_url: fileUrl || null,
        file_name: fileName || null,
        comment: comment?.trim() || null,
        status: "submitted",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify tutor
    const { error: n1err } = await admin.from("notifications").insert({
      user_id: assignment.tutor_id,
      type: "lesson",
      title: "📤 დავალება ჩაბარდა",
      body: `${profile.full_name}-მა ჩააბარა დავალება: "${assignment.title}"`,
      link: "/dashboard/tutor/tasks",
      is_read: false,
    });
    if (n1err) console.error("Notification error (tutor):", n1err.message);

    // Notify parents of student
    const { data: parents } = await admin
      .from("parent_children").select("parent_id").eq("child_id", user.id);
    for (const p of (parents || [])) {
      const { error: n2err } = await admin.from("notifications").insert({
        user_id: p.parent_id,
        type: "lesson",
        title: "📤 შვილმა ჩააბარა დავალება",
        body: `${profile.full_name}-მა ჩააბარა: "${assignment.title}"`,
        link: "/dashboard/parent/tasks",
        is_read: false,
      });
      if (n2err) console.error("Notification error (parent):", n2err.message);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
