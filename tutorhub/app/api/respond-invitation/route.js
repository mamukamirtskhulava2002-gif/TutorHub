import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { invitationId, accept } = await request.json();
    if (!invitationId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const admin = createAdminClient();

    // Verify invitation belongs to this student
    const { data: inv } = await admin
      .from("parent_invitations")
      .select("id, parent_id, student_id, status")
      .eq("id", invitationId)
      .eq("student_id", user.id)
      .single();

    if (!inv) return NextResponse.json({ error: "მოწვევა ვერ მოიძებნა" }, { status: 404 });
    if (inv.status !== "pending") return NextResponse.json({ error: "უკვე დამუშავებულია" }, { status: 400 });

    const newStatus = accept ? "accepted" : "rejected";
    await admin.from("parent_invitations").update({ status: newStatus }).eq("id", invitationId);

    if (accept) {
      await admin.from("parent_children").upsert(
        { parent_id: inv.parent_id, child_id: user.id },
        { onConflict: "parent_id,child_id" }
      );

      // Notify parent
      const { data: childProfile } = await admin
        .from("profiles").select("full_name").eq("id", user.id).single();
      const childName = childProfile?.full_name || "სტუდენტი";
      await admin.from("notifications").insert({
        user_id: inv.parent_id,
        type:    "system",
        title:   "✅ კავშირი დადასტურდა",
        body:    `${childName} დაადასტურა კავშირი. ახლა ხედავ მათ პროფილს "შვილები" გვერდზე.`,
        is_read: false,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("respond-invitation error:", e);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
