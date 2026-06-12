import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function PATCH(request, { params }) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "tutor")
      return NextResponse.json({ error: "მხოლოდ მასწავლებელს შეუძლია" }, { status: 403 });

    const { id: assignmentId } = await params;
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("assignments").select("tutor_id").eq("id", assignmentId).single();
    if (!existing || existing.tutor_id !== user.id)
      return NextResponse.json({ error: "დავალება ვერ მოიძებნა" }, { status: 404 });

    const body = await request.json();
    const { title, description, deadline, fileUrl, fileName } = body;
    if (!title?.trim())
      return NextResponse.json({ error: "სათაური სავალდებულოა" }, { status: 400 });

    const updates = {
      title: title.trim(),
      description: description?.trim() || null,
      deadline: deadline || null,
    };
    if (fileUrl !== undefined) {
      updates.file_url = fileUrl || null;
      updates.file_name = fileName || null;
    }

    const { data, error } = await admin
      .from("assignments")
      .update(updates)
      .eq("id", assignmentId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "არ ხარ შესული" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "tutor")
      return NextResponse.json({ error: "მხოლოდ მასწავლებელს შეუძლია" }, { status: 403 });

    const { id: assignmentId } = await params;
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("assignments").select("tutor_id").eq("id", assignmentId).single();
    if (!existing || existing.tutor_id !== user.id)
      return NextResponse.json({ error: "დავალება ვერ მოიძებნა" }, { status: 404 });

    const { error } = await admin
      .from("assignments").delete().eq("id", assignmentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
