import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";
import MyScheduleClient from "@/components/my-schedule/MyScheduleClient";

const MIN_LOAD = new Promise(r => setTimeout(r, 500));

export default async function UserSchedulePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const [, supabase, { profileId }] = await Promise.all([MIN_LOAD, createClient(), params]);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 내 rank
  const { data: myProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!myProfile) redirect("/login");

  const { data: myRoleData } = await supabase
    .from("roles").select("rank").eq("name", myProfile.role).single();
  const myRank: number = (myRoleData as any)?.rank ?? 0;

  // 대상 유저 정보
  const { data: target } = await supabase
    .from("profiles")
    .select("id, name, role, approval_status")
    .eq("id", profileId)
    .single();

  if (!target || target.approval_status !== "approved") redirect("/admin/full-schedule");

  // 본인 열람 불가 (자신은 /schedule/me로)
  if (target.id === user.id) redirect("/schedule/me");

  // rank 체크 — 대상이 하위 지위여야만 열람 가능
  const { data: targetRoleData } = await supabase
    .from("roles").select("rank").eq("name", target.role).single();
  const targetRank: number = (targetRoleData as any)?.rank ?? 99;
  if (targetRank <= myRank) redirect("/admin/full-schedule");

  const today = new Date().toISOString().split("T")[0];

  // 대상 유저의 instructor 레코드 (선생님인 경우)
  const { data: instructorRow } = await supabase
    .from("instructors").select("id").eq("profile_id", profileId).maybeSingle();
  const instructorId = instructorRow?.id ?? null;

  // 대상 유저의 teacher 레코드 (구형)
  const { data: teacherRow } = await supabase
    .from("teachers").select("id").eq("profile_id", profileId).maybeSingle();
  const teacherId = teacherRow?.id ?? null;

  // 강의 일정 (teacher/instructor 방식 모두)
  const [teacherSchedules, instructorSchedules] = await Promise.all([
    teacherId
      ? supabase.from("classroom_schedules")
          .select(`id, day, start_time, end_time, effective_from, effective_until,
                   courses ( id, name, subject, accent_color, enrolled_names ),
                   classrooms ( id, name )`)
          .eq("teacher_id", teacherId)
          .or(`effective_until.is.null,effective_until.gte.${today}`)
      : Promise.resolve({ data: [] }),
    instructorId
      ? supabase.from("classroom_schedules")
          .select(`id, day, start_time, end_time, effective_from, effective_until,
                   courses!inner ( id, name, subject, accent_color, enrolled_names, instructor_id ),
                   classrooms ( id, name )`)
          .eq("courses.instructor_id", instructorId)
          .or(`effective_until.is.null,effective_until.gte.${today}`)
      : Promise.resolve({ data: [] }),
  ]);

  // 상담 일정 (instructor 이름 기반)
  const { data: instructorInfo } = instructorId
    ? await supabase.from("instructors").select("name").eq("id", instructorId).single()
    : { data: null };
  const { data: consultingSchedules } = instructorInfo?.name
    ? await supabase.from("classroom_schedules")
        .select(`id, day, start_time, end_time, effective_from, effective_until,
                 consulting_student, consulting_teacher, consulting_teacher_color,
                 classrooms ( id, name )`)
        .ilike("consulting_teacher", instructorInfo.name)
        .not("consulting_student", "is", null)
        .or(`effective_until.is.null,effective_until.gte.${today}`)
    : { data: [] };

  // 중복 제거 합산
  const seenIds = new Set<string>();
  const classSchedules: any[] = [];
  for (const s of [
    ...(teacherSchedules.data ?? []),
    ...(instructorSchedules.data ?? []),
    ...(consultingSchedules ?? []),
  ]) {
    if (!seenIds.has(s.id)) { seenIds.add(s.id); classSchedules.push(s); }
  }

  // 수강 중인 수업 (학생인 경우)
  const { data: studentRow } = await supabase
    .from("students").select("id").eq("profile_id", profileId).maybeSingle();
  const { data: enrollments } = studentRow
    ? await supabase.from("enrollments")
        .select(`id, course_id, is_active,
                 courses ( id, name, subject, accent_color,
                   classroom_schedules ( id, day, start_time, end_time, effective_from, effective_until ),
                   instructors ( id, name, color ) )`)
        .eq("student_id", studentRow.id)
        .eq("is_active", true)
    : { data: [] };

  // 개인 일정
  const { data: personalSchedules } = await supabase
    .from("personal_schedules").select("*")
    .eq("profile_id", profileId).eq("is_active", true);

  return (
    <MyScheduleClient
      userRole={target.role}
      userName={target.name}
      userId={target.id}
      classSchedules={classSchedules as any[]}
      enrollments={(enrollments ?? []) as any[]}
      personalSchedules={(personalSchedules ?? []) as any[]}
      readOnly
    />
  );
}
