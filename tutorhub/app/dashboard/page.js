import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/auth");
    return;
  }

  switch (profile.role) {
    case "admin":
      redirect("/dashboard/admin");
    case "tutor":
      redirect("/dashboard/tutor");
    case "parent":
      redirect("/dashboard/parent");
    case "student":
      redirect("/dashboard/student");
    default:
      redirect("/auth");
  }
}