import { createClient } from "@/lib/supabase/server";
import { redirect }      from "next/navigation";
import MyScheduleClient  from "@/components/my-schedule/MyScheduleClient";

const MIN_LOAD = new Promise((r) => setTimeout(r, 500));

export default async function MySchedulePage() {
  const [, supabase] = await Promise.all([MIN_LOAD, createClient()]);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const today = new Date().toISOString().split("T")[0];
  const role  = profile.role as string;

  // ── 선생님/매니저/관리자: classroom_schedules (내 강의) + personal_schedules
  if (role === "admin" || role === "manager" || role === "teacher") {
    // teacher 레코드 조회 (기존 teacher_id 방식)
    const { data: teacherRow } = await supabase
      .from("teachers")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    const teacherId = teacherRow?.id ?? null;

    // instructor 레코드 조회 (신규 instructor 방식 — profile_id 연동)
    const { data: instructorRow } = await supabase
      .from("instructors")
      .select("id, name")
      .eq("profile_id", user.id)
      .maybeSingle();

    const instructorId   = instructorRow?.id   ?? null;
    const instructorName = instructorRow?.name  ?? null;

    // 강의 일정 + 상담 일정 — 세 가지 경로 병렬 fetch
    const [teacherSchedules, instructorSchedules, consultingSchedules] = await Promise.all([
      // 기존: classroom_schedules.teacher_id 기준
      teacherId
        ? supabase
            .from("classroom_schedules")
            .select(`id, day, start_time, end_time, effective_from, effective_until,
                     courses ( id, name, subject, accent_color, enrolled_names ),
                     classrooms ( id, name )`)
            .eq("teacher_id", teacherId)
            .or(`effective_until.is.null,effective_until.gte.${today}`)
        : Promise.resolve({ data: [] }),

      // 신규: courses.instructor_id 기준 (유저 연동 선생님)
      instructorId
        ? supabase
            .from("classroom_schedules")
            .select(`id, day, start_time, end_time, effective_from, effective_until,
                     courses!inner ( id, name, subject, accent_color, enrolled_names, instructor_id ),
                     classrooms ( id, name )`)
            .eq("courses.instructor_id", instructorId)
            .or(`effective_until.is.null,effective_until.gte.${today}`)
        : Promise.resolve({ data: [] }),

      // 상담 일정: consulting_teacher 이름으로 직접 매칭
      // → 기존 데이터 포함 모두 커버 (sync 불필요)
      instructorName
        ? supabase
            .from("classroom_schedules")
            .select(`id, day, start_time, end_time, effective_from, effective_until,
                     consulting_student, consulting_teacher, consulting_teacher_color,
                     classrooms ( id, name )`)
            .ilike("consulting_teacher", instructorName)
            .not("consulting_student", "is", null)
            .or(`effective_until.is.null,effective_until.gte.${today}`)
        : Promise.resolve({ data: [] }),
    ]);

    // 중복 제거 후 합산
    const seenIds = new Set<string>();
    const classSchedules: any[] = [];
    for (const s of [
      ...(teacherSchedules.data    ?? []),
      ...(instructorSchedules.data ?? []),
      ...(consultingSchedules.data ?? []),
    ]) {
      if (!seenIds.has(s.id)) { seenIds.add(s.id); classSchedules.push(s); }
    }

    // 개인 일정
    const { data: personalSchedules } = await supabase
      .from("personal_schedules")
      .select("*")
      .eq("profile_id", user.id)
      .eq("is_active", true);

    return (
      <MyScheduleClient
        userRole={role}
        userName={profile.name}
        classSchedules={classSchedules as any[]}
        personalSchedules={(personalSchedules ?? []) as any[]}
        userId={user.id}
      />
    );
  }

  // ── 학생: 수강 중인 수업 시간표 + personal_schedules
  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  const studentId = studentRow?.id ?? null;

  const { data: enrollments } = studentId
    ? await supabase
        .from("enrollments")
        .select(`
          id, course_id, is_active,
          courses (
            id, name, subject, accent_color,
            classroom_schedules ( id, day, start_time, end_time, effective_from, effective_until ),
            instructors ( id, name, color )
          )
        `)
        .eq("student_id", studentId)
        .eq("is_active", true)
    : { data: [] };

  const { data: personalSchedules } = await supabase
    .from("personal_schedules")
    .select("*")
    .eq("profile_id", user.id)
    .eq("is_active", true);

  return (
    <MyScheduleClient
      userRole={role}
      userName={profile.name}
      classSchedules={[]}
      enrollments={(enrollments ?? []) as any[]}
      personalSchedules={(personalSchedules ?? []) as any[]}
      userId={user.id}
    />
  );
}
