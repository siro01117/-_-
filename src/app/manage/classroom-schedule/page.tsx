import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ScheduleClient from "@/components/classroom-schedule/ScheduleClient";

export default async function ClassroomSchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 교실 + 고정 일정을 병렬로 로드 (권한은 미들웨어에서 이미 체크됨)
  const today = new Date().toISOString().split("T")[0];

  const [classroomsRes, fixedRes] = await Promise.all([
    supabase
      .from("classrooms")
      .select("id, name, floor, description")
      .order("floor", { ascending: false })
      .order("name"),
    supabase
      .from("classroom_schedules")
      .select(`
        id, day, start_time, end_time, effective_from, effective_until, notes,
        consulting_student, consulting_teacher, consulting_teacher_color,
        courses ( id, name, subject, instructor_id, accent_color, enrolled_names,
          instructors ( id, name, color )
        ),
        classrooms ( id, name )
      `)
      .or(`effective_until.is.null,effective_until.gte.${today}`),
  ]);

  return (
    <ScheduleClient
      classrooms={classroomsRes.data ?? []}
      fixedSchedules={(fixedRes.data ?? []) as unknown as Parameters<typeof ScheduleClient>[0]['fixedSchedules']}
    />
  );
}
