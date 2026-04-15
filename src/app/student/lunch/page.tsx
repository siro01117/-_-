import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";
import LunchOrderClient from "@/components/lunch/LunchOrderClient";

const MIN_LOAD = new Promise(r => setTimeout(r, 400));

export default async function StudentLunchPage() {
  const [, supabase] = await Promise.all([MIN_LOAD, createClient()]);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // 프로필 + 학생 레코드
  const { data: profile } = await supabase
    .from("profiles").select("name").eq("id", user.id).single();

  const { data: studentRow } = await supabase
    .from("students").select("id").eq("profile_id", user.id).maybeSingle();

  // 이번 달 + 다음 달 설정 (없으면 기본값)
  const months = [
    { year, month },
    { year: month === 12 ? year + 1 : year, month: month === 12 ? 1 : month + 1 },
  ];

  const [settings1, settings2, order1, order2] = await Promise.all([
    supabase.from("lunch_settings").select("*").eq("year", months[0].year).eq("month", months[0].month).maybeSingle(),
    supabase.from("lunch_settings").select("*").eq("year", months[1].year).eq("month", months[1].month).maybeSingle(),
    studentRow
      ? supabase.from("lunch_orders").select("*").eq("student_id", studentRow.id)
          .eq("year", months[0].year).eq("month", months[0].month).maybeSingle()
      : Promise.resolve({ data: null }),
    studentRow
      ? supabase.from("lunch_orders").select("*").eq("student_id", studentRow.id)
          .eq("year", months[1].year).eq("month", months[1].month).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const defaultSettings = {
    lunch_price: 7500, dinner_price: 7000,
    order_deadline_days: 1, cancel_deadline_days: 7,
    available_days: ["mon","tue","wed","thu","fri"],
    blocked_dates: [], lunch_vendor: "스피드런치",
    dinner_vendor: "한솥", notes: null, is_open: true,
  };

  return (
    <LunchOrderClient
      studentId={studentRow?.id ?? null}
      userName={profile?.name ?? ""}
      months={[
        { ...months[0], settings: { ...defaultSettings, ...(settings1.data ?? {}) }, order: order1.data },
        { ...months[1], settings: { ...defaultSettings, ...(settings2.data ?? {}) }, order: order2.data },
      ]}
    />
  );
}
