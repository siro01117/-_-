import { createClient } from "@/lib/supabase/server";
import { redirect }      from "next/navigation";
import MyScheduleClient  from "@/components/my-schedule/MyScheduleClient";

const MIN_LOAD = new Promise((r) => setTimeout(r, 500));

export default async function TeacherSchedulePage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const [, supabase, { teacherId }] = await Promise.all([MIN_LOAD, createClient(), params]);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 내 역할 + 지위 조회
  const { data: myProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!myProfile) redirect("/portal");

  const { data: myRoleData } = await supabase
    .from("roles").select("rank").eq("name", myProfile.role).single();
  const myRank: number = (myRoleData as any)?.rank ?? 0;

  const today = new Date().toISOString().split("T")[0];

  // 선생님 정보
  const { data: teacher } = await supabase
    .from("teachers")
    .select(`id, profiles ( id, name, role )`)
    .eq("id", teacherId)
    .single();

  if (!teacher) redirect("/admin/full-schedule");

  const profileId: string = (teacher as any).profiles?.id ?? "";

  // 대상 역할 지위 확인 — 내 지위보다 낮아야 열람 가능
  const targetRole = (teacher as any).profiles?.role ?? "";
  const { data: targetRoleData } = await supabase
    .from("roles").select("rank").eq("name", targetRole).single();
  const targetRank: number = (targetRoleData as any)?.rank ?? 99;
  if (targetRank <= myRank) redirect("/admin/full-schedule");

  // instructor 레코드 조회 (profile_id 연동)
  const { data: instructorRow } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  const instructorId = instructorRow?.id ?? null;

  // 강의 일정 — teacher_id 방식 + instructor 방식 모두 수집
  const [teacherSchedules, instructorSchedules] = await Promise.all([
    supabase
      .from("classroom_schedules")
      .select(`id, day, start_time, end_time, effective_from, effective_until,
               courses ( id, name, subject, accent_color ),
               classrooms ( id, name )`)
      .eq("teacher_id", teacherId)
      .or(`effective_until.is.null,effective_until.gte.${today}`),
    instructorId
      ? supabase
          .from("classroom_schedules")
          .select(`id, day, start_time, end_time, effective_from, effective_until,
                   courses!inner ( id, name, subject, accent_color, instructor_id ),
                   classrooms ( id, name )`)
          .eq("courses.instructor_id", instructorId)
          .or(`effective_until.is.null,effective_until.gte.${today}`)
      : Promise.resolve({ data: [] }),
  ]);

  const seenIds = new Set<string>();
  const classSchedules: any[] = [];
  for (const s of [...(teacherSchedules.data ?? []), ...(instructorSchedules.data ?? [])]) {
    if (!seenIds.has(s.id)) { seenIds.add(s.id); classSchedules.push(s); }
  }

  // 개인 일정
  const { data: personalSchedules } = await supabase
    .from("personal_schedules")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_active", true);

  const teacherName = (teacher as any).profiles?.name ?? "선생님";


  return (
    <MyScheduleClient
      userRole="teacher"
      userName={teacherName}
      userId={(teacher as any).profiles?.id ?? ""}
      classSchedules={classSchedules as any[]}
      personalSchedules={(personalSchedules ?? []) as any[]}
      readOnly
    />
  );
}
