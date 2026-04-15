"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect }          from "next/navigation";

// ── 권한 확인 (admin 또는 manager) ────────────────────────────
async function assertAdminOrManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!["admin", "manager"].includes(profile?.role ?? "")) redirect("/portal");
  return { supabase, admin: createAdminClient(), role: profile!.role };
}

// ── 학생 유저 생성 (관리자/매니저 직접 생성) ─────────────────
export async function createStudentUser(data: {
  loginId:    string;
  password:   string;
  name:       string;
  role:       string;
  birthdate?: string;
  school?:    string;
  phone?:     string;
  gender?:    string;
  grade?:     string;
}) {
  const { admin } = await assertAdminOrManager();

  const { data: existing } = await admin
    .from("profiles").select("id").eq("login_id", data.loginId).maybeSingle();
  if (existing) throw new Error("이미 사용 중인 아이디입니다.");

  const email = `${data.loginId.toLowerCase()}@studycube.app`;
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email, password: data.password, email_confirm: true,
    user_metadata: { name: data.name, role: data.role },
  });
  if (authErr) throw new Error(authErr.message);
  if (!created?.user?.id) throw new Error("계정 생성 실패");

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: created.user.id, email,
    name: data.name, role: data.role,
    login_id:  data.loginId.toLowerCase(),
    birthdate: data.birthdate ?? null,
    school:    data.school?.trim() || null,
    phone:     data.phone?.trim() || null,
    gender:    data.gender || null,
    approval_status: "approved",
  }, { onConflict: "id" });

  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error("프로필 생성 실패: " + profileErr.message);
  }

  // students 레코드 생성 (grade 저장용)
  if (data.grade) {
    await admin.from("students").insert({
      profile_id: created.user.id,
      grade:      data.grade,
      school:     data.school ?? null,
    });
  }
}

// ── 학생 정보 수정 ────────────────────────────────────────────
export async function updateStudentUser(userId: string, data: {
  name:       string;
  role:       string;
  login_id?:  string | null;
  password?:  string | null;
  birthdate?: string | null;
  school?:    string | null;
  phone?:     string | null;
  gender?:    string | null;
  grade?:     string | null;
}) {
  const { admin } = await assertAdminOrManager();

  const authUpdate: Record<string, any> = {};
  if (data.login_id) authUpdate.email = `${data.login_id}@studycube.app`;
  if (data.password) {
    if (data.password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
    authUpdate.password = data.password;
  }
  if (Object.keys(authUpdate).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(userId, authUpdate);
    if (error) throw new Error("계정 변경 실패: " + error.message);
  }

  const { error } = await admin.from("profiles").update({
    name:      data.name,
    role:      data.role,
    login_id:  data.login_id,
    birthdate: data.birthdate,
    school:    data.school,
    phone:     data.phone,
    gender:    data.gender,
  }).eq("id", userId);
  if (error) throw new Error(error.message);

  // students.grade 업데이트 (없으면 생성)
  const { data: existing } = await admin.from("students")
    .select("id").eq("profile_id", userId).maybeSingle();
  if (existing) {
    await admin.from("students").update({ grade: data.grade ?? null }).eq("id", existing.id);
  } else if (data.grade) {
    await admin.from("students").insert({ profile_id: userId, grade: data.grade });
  }
}

// ── 가입 승인 ─────────────────────────────────────────────────
export async function approveStudent(userId: string) {
  const { admin } = await assertAdminOrManager();
  const { error } = await admin.from("profiles")
    .update({ approval_status: "approved" }).eq("id", userId);
  if (error) throw new Error(error.message);
}

// ── 가입 거절 (삭제) ─────────────────────────────────────────
export async function rejectStudent(userId: string) {
  const { admin } = await assertAdminOrManager();
  await admin.from("profiles").delete().eq("id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

// ── 학생 삭제 ─────────────────────────────────────────────────
export async function deleteStudent(userId: string) {
  const { admin } = await assertAdminOrManager();
  await admin.from("profiles").delete().eq("id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

// ── 비밀번호 초기화 ───────────────────────────────────────────
export async function resetStudentPassword(userId: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
  const { admin } = await assertAdminOrManager();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw new Error(error.message);
}
