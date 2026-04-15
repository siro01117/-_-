"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

async function getStudentId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("students").select("id").eq("profile_id", userId).maybeSingle();
  return data?.id ?? null;
}

// ── 월별 도시락 신청 저장 (upsert) ───────────────────────────
export async function saveLunchOrder(data: {
  year:         number;
  month:        number;
  lunchDates:   string[];
  dinnerDates:  string[];
  seatNo?:      string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const studentId = await getStudentId(supabase, user.id);
  if (!studentId) throw new Error("학생 정보가 없습니다. 관리자에게 문의하세요.");

  // 설정 가져와서 마감일 검증
  const { data: settings } = await supabase
    .from("lunch_settings")
    .select("order_deadline_days, cancel_deadline_days, is_open, blocked_dates, available_days")
    .eq("year", data.year).eq("month", data.month).maybeSingle();

  if (settings && !settings.is_open) throw new Error("현재 해당 월의 도시락 신청이 닫혀 있습니다.");

  const deadlineDays = settings?.order_deadline_days ?? 1;
  const cancelDays   = settings?.cancel_deadline_days ?? 7;
  const today        = new Date(); today.setHours(0, 0, 0, 0);

  // 기존 주문 조회 (취소 마감 체크용)
  const { data: existing } = await supabase
    .from("lunch_orders")
    .select("lunch_dates, dinner_dates")
    .eq("student_id", studentId).eq("year", data.year).eq("month", data.month)
    .maybeSingle();

  const prevLunch  = new Set<string>(existing?.lunch_dates  ?? []);
  const prevDinner = new Set<string>(existing?.dinner_dates ?? []);
  const newLunch   = new Set(data.lunchDates);
  const newDinner  = new Set(data.dinnerDates);

  // 신규 추가 날짜: 신청 마감 체크
  for (const d of [...data.lunchDates, ...data.dinnerDates]) {
    if (prevLunch.has(d) || prevDinner.has(d)) continue; // 기존 항목은 skip
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    const diff   = Math.ceil((target.getTime() - today.getTime()) / 86400000);
    if (diff <= deadlineDays) throw new Error(`${d} 은(는) 신청 마감된 날짜입니다 (${deadlineDays}일 전까지).`);
  }

  // 삭제(취소) 날짜: 취소 마감 체크
  for (const d of Array.from(prevLunch)) {
    if (newLunch.has(d)) continue;
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    const diff   = Math.ceil((target.getTime() - today.getTime()) / 86400000);
    if (diff < cancelDays) throw new Error(`${d} 점심은 취소 마감됐습니다 (${cancelDays}일 전까지).`);
  }
  for (const d of Array.from(prevDinner)) {
    if (newDinner.has(d)) continue;
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    const diff   = Math.ceil((target.getTime() - today.getTime()) / 86400000);
    if (diff < cancelDays) throw new Error(`${d} 저녁은 취소 마감됐습니다 (${cancelDays}일 전까지).`);
  }

  const { error } = await supabase.from("lunch_orders").upsert({
    student_id:    studentId,
    year:          data.year,
    month:         data.month,
    lunch_dates:   data.lunchDates,
    dinner_dates:  data.dinnerDates,
    order_dates:   Array.from(new Set([...data.lunchDates, ...data.dinnerDates])),
    seat_no:       data.seatNo ?? null,
    submitted_at:  new Date().toISOString(),
    updated_at:    new Date().toISOString(),
  }, { onConflict: "student_id,year,month" });

  if (error) throw new Error(error.message);
}

// ── 납부 처리 (관리자) ────────────────────────────────────────
export async function updatePaymentStatus(orderId: string, isPaid: boolean) {
  const admin = createAdminClient();
  const { error } = await admin.from("lunch_orders").update({
    is_paid: isPaid,
    paid_at: isPaid ? new Date().toISOString() : null,
  }).eq("id", orderId);
  if (error) throw new Error(error.message);
}

// ── 납부 금액 업데이트 (관리자) ───────────────────────────────
export async function updatePaidAmount(orderId: string, paidAmount: number) {
  const admin = createAdminClient();
  const { error } = await admin.from("lunch_orders").update({
    paid_amount: paidAmount,
    is_paid:     paidAmount > 0,
    paid_at:     paidAmount > 0 ? new Date().toISOString() : null,
  }).eq("id", orderId);
  if (error) throw new Error(error.message);
}

// ── 조정 내역 저장 (관리자 차감) ─────────────────────────────
export async function saveAdjustments(orderId: string, adjustments: {
  type: "lunch" | "dinner"; count: number; reason: string; date: string;
}[]) {
  const admin = createAdminClient();
  const { error } = await admin.from("lunch_orders")
    .update({ adjustments })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

// ── 주문 삭제 (관리자) ────────────────────────────────────────
export async function deleteLunchOrder(orderId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("lunch_orders")
    .delete()
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

// ── 도시락 설정 저장 (관리자) ─────────────────────────────────
export async function saveLunchSettings(data: {
  year: number; month: number;
  lunch_price: number; dinner_price: number;
  order_deadline_days: number; cancel_deadline_days: number;
  available_days: string[]; blocked_dates: string[];
  lunch_vendor: string; dinner_vendor: string;
  notes: string; is_open: boolean;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("lunch_settings").upsert(data, { onConflict: "year,month" });
  if (error) throw new Error(error.message);
}
