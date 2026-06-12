import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    const role = profile?.role;
    const admin = createAdminClient();

    if (role === "tutor") {
      const { data, error } = await admin
        .from("assignments")
        .select(`
          id, tutor_id, student_id, title, description,
          file_url, file_name, deadline, created_at,
          profiles!student_id(id, full_name, avatar_url),
          assignment_submissions(id, status, submitted_at, feedback, feedback_at, file_url, file_name, comment)
        `)
        .eq("tutor_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data || []);
    }

    if (role === "student") {
      const { data, error } = await admin
        .from("assignments")
        .select(`
          id, tutor_id, student_id, title, description,
          file_url, file_name, deadline, created_at,
          profiles!tutor_id(id, full_name, avatar_url),
          assignment_submissions(id, status, submitted_at, feedback, feedback_at, file_url, file_name, comment)
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data || []);
    }

    if (role === "parent") {
      const { data: children } = await admin
        .from("parent_children")
        .select("child_id")
        .eq("parent_id", user.id);
      const childIds = (children || []).map(c => c.child_id);
      if (!childIds.length) return NextResponse.json([]);

      const { data, error } = await admin
        .from("assignments")
        .select(`
          id, tutor_id, student_id, title, description,
          file_url, file_name, deadline, created_at,
          tutor:profiles!tutor_id(id, full_name, avatar_url),
          student:profiles!student_id(id, full_name, avatar_url),
          assignment_submissions(id, status, submitted_at, feedback, feedback_at, file_url, file_name, comment)
        `)
        .in("student_id", childIds)
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data || []);
    }

    return NextResponse.json({ error: "წვდომა უარყოფილია" }, { status: 403 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("role, full_name").eq("id", user.id).single();
    if (profile?.role !== "tutor")
      return NextResponse.json({ error: "მხოლოდ მასწავლებელს შეუძლია" }, { status: 403 });

    const body = await request.json();
    const { studentId, title, description, deadline, fileUrl, fileName } = body;
    if (!studentId || !title?.trim())
      return NextResponse.json({ error: "სტუდენტი და სათაური სავალდებულოა" }, { status: 400 });

    const admin = createAdminClient();

    const { data: student } = await admin
      .from("profiles").select("full_name").eq("id", studentId).single();

    const { data, error } = await admin
      .from("assignments")
      .insert({
        tutor_id: user.id,
        student_id: studentId,
        title: title.trim(),
        description: description?.trim() || null,
        deadline: deadline || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: n1err } = await admin.from("notifications").insert({
      user_id: studentId,
      type: "lesson",
      title: "📝 ახალი დავალება",
      body: `${profile.full_name}-მა გამოგიგზავნა ახალი დავალება: "${title.trim()}"`,
      link: "/dashboard/student/tasks",
      is_read: false,
    });
    if (n1err) console.error("Notification error (student):", n1err.message);

    const { data: parents } = await admin
      .from("parent_children").select("parent_id").eq("child_id", studentId);
    for (const p of (parents || [])) {
      const { error: n2err } = await admin.from("notifications").insert({
        user_id: p.parent_id,
        type: "lesson",
        title: "📝 შვილს დაუვალდა",
        body: `${profile.full_name}-მა ${student?.full_name || "მოსწავლეს"} გაუგზავნა ახალი დავალება: "${title.trim()}"`,
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
