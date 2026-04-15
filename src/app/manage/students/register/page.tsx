import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";
import StudentManager   from "@/components/students/StudentManager";

const MIN_LOAD = new Promise(r => setTimeout(r, 400));

export default async function StudentsRegisterPage() {
  const [, supabase] = await Promise.all([MIN_LOAD, createClient()]);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!["admin", "manager"].includes(myProfile?.role ?? "")) redirect("/portal");

  // admin/manager가 아닌 역할의 유저 전체 조회 (students.grade 포함)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, login_id, email, role, birthdate, school, phone, gender, approval_status, created_at, students ( id, grade )")
    .not("role", "in", '("admin","manager")')
    .order("created_at", { ascending: false });

  // 역할 목록 (signup 가능 역할)
  const { data: roles } = await supabase
    .from("roles").select("name, label, color").eq("show_in_signup", true).order("created_at");

  return (
    <StudentManager
      initialProfiles={(profiles ?? []) as any[]}
      roles={(roles ?? []) as any[]}
      myRole={myProfile?.role ?? "manager"}
    />
  );
}
