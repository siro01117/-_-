import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";
import LunchManageClient from "@/components/lunch/LunchManageClient";

const MIN_LOAD = new Promise(r => setTimeout(r, 400));

export default async function ManageLunchPage() {
  const [, supabase] = await Promise.all([MIN_LOAD, createClient()]);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","manager"].includes(profile?.role ?? "")) redirect("/portal");

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // 설정
  const { data: settings } = await supabase
    .from("lunch_settings").select("*").eq("year", year).eq("month", month).maybeSingle();

  // 이번 달 전체 주문 (학생 이름 포함)
  const { data: orders } = await supabase
    .from("lunch_orders")
    .select(`
      id, year, month, lunch_dates, dinner_dates, seat_no, is_paid, paid_at, paid_amount, adjustments, memo,
      students (
        id,
        profiles ( id, name )
      )
    `)
    .eq("year", year).eq("month", month)
    .order("submitted_at");

  const defaultSettings = {
    year, month,
    lunch_price: 7500, dinner_price: 7000,
    order_deadline_days: 1, cancel_deadline_days: 7,
    available_days: ["mon","tue","wed","thu","fri"],
    blocked_dates: [], lunch_vendor: "스피드런치",
    dinner_vendor: "한솥", notes: "", is_open: true,
  };

  return (
    <LunchManageClient
      year={year}
      month={month}
      settings={{ ...defaultSettings, ...(settings ?? {}) }}
      initialOrders={(orders ?? []) as any[]}
    />
  );
}
