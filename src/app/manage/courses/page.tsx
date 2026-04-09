import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";
import CourseManager    from "@/components/courses/CourseManager";

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    redirect("/portal");
  }

  return <CourseManager />;
}
