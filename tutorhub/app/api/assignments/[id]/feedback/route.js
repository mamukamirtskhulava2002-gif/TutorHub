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
    if (profile?.role !== "tutor")
      return NextResponse.json({ error: "მხოლოდ მასწავლებელს შეუძლია" }, { status: 403 });

    const { id: assignmentId } = await params;
    const body = await request.json();
    const { submissionId, feedback } = body;
    if (!submissionId || !feedback?.trim())
      return NextResponse.json({ error: "სავალდებულო ველები" }, { status: 400 });

    const admin = createAdminClient();

    const { data: submission } = await admin
      .from("assignment_submissions")
      .select("id, student_id, assignment_id")
      .eq("id", submissionId)
      .single();

    const { data: assignment } = await admin
      .from("assignments")
      .select("id, tutor_id, title")
      .eq("id", assignmentId)
      .single();

    if (!submission || !assignment || assignment.tutor_id !== user.id || submission.assignment_id !== assignmentId)
      return NextResponse.json({ error: "წვდომა უარყოფილია" }, { status: 403 });

    const { data, error } = await admin
      .from("assignment_submissions")
      .update({
        feedback: feedback.trim(),
        status: "reviewed",
        feedback_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify student
    const { error: nerr } = await admin.from("notifications").insert({
      user_id: submission.student_id,
      type: "lesson",
      title: "✅ დავალება შეფასდა",
      body: `${profile.full_name}-მა შეამოწმა შენი დავალება: "${assignment.title}"`,
      link: "/dashboard/student/tasks",
      is_read: false,
    });
    if (nerr) console.error("Notification error (student feedback):", nerr.message);

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
