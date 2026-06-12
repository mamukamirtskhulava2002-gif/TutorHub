import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { hasCertificate, certFileUrl } = await request.json();
    if (!certFileUrl) return NextResponse.json({ error: "ფაილის URL სავალდებულოა" }, { status: 400 });

    const { error } = await supabase.from("tutors").update({
      has_certificate:       hasCertificate,
      cert_file_url:         certFileUrl,
      license_status:        "pending",
      license_submitted_at:  new Date().toISOString(),
    }).eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify all admins
    const admin = createAdminClient();
    const [{ data: admins }, { data: tutorProfile }] = await Promise.all([
      admin.from("profiles").select("id").eq("role", "admin"),
      admin.from("profiles").select("full_name").eq("id", user.id).single(),
    ]);

    if (admins?.length) {
      const name    = tutorProfile?.full_name || "მასწავლებელი";
      const docType = hasCertificate ? "სერტიფიკატი" : "სტუდ. ID / დიპლომი";
      await admin.from("notifications").insert(
        admins.map(a => ({
          user_id: a.id,
          type:    "system",
          title:   "📋 ახალი სერტიფიკაციის განაცხადი",
          body:    `${name}-მ წარადგინა ${docType} ვერიფიკაციისთვის.`,
          is_read: false,
        }))
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("submit-certification error:", e);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
