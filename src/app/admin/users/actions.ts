"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect }          from "next/navigation";

// ── 어드민 확인 헬퍼 ──────────────────────────────────────────────
async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/portal");
}

// ────────────────────────────────────────────────────────────────
//  유저 관련 액션
// ────────────────────────────────────────────────────────────────

// 유저 프로필 업데이트 (이름, 역할, 기타 정보)
export async function updateUserProfile(userId: string, data: {
  name:      string;
  role:      string;
  login_id?: string | null;
  password?: string | null;
  birthdate?:string | null;
  school?:   string | null;
  phone?:    string | null;
  gender?:   string | null;
}) {
  await assertAdmin();
  const admin = createAdminClient();

  // login_id 변경 시 auth email 도 변경
  const authUpdate: Record<string, any> = {};
  if (data.login_id !== undefined && data.login_id) {
    authUpdate.email = `${data.login_id}@studycube.app`;
  }
  if (data.password) {
    if (data.password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
    authUpdate.password = data.password;
  }
  if (Object.keys(authUpdate).length > 0) {
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, authUpdate);
    if (authErr) throw new Error("계정 변경 실패: " + authErr.message);
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
}

// 어드민이 직접 유저 추가 (자동 승인)
export async function createUser(data: {
  loginId:     string;
  password:    string;
  name:        string;
  role:        string;
  birthdate?:  string;
  school?:     string;
  phone?:      string;
  gender?:     string;
  autoApprove: boolean;
}) {
  await assertAdmin();
  const admin = createAdminClient();

  // 아이디 중복 확인
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("login_id", data.loginId)
    .single();
  if (existing) throw new Error("이미 사용 중인 아이디입니다.");

  const email = `${data.loginId}@studycube.app`;
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
    user_metadata: { name: data.name, role: data.role },
  });

  if (authErr) throw new Error(authErr.message);
  if (!created?.user?.id) throw new Error("계정 생성에 실패했습니다.");

  const { error: profileErr } = await admin.from("profiles").upsert({
    id:              created.user.id,
    email,
    name:            data.name,
    role:            data.role,
    login_id:        data.loginId,
    birthdate:       data.birthdate ?? null,
    school:          data.school ?? null,
    phone:           data.phone ?? null,
    gender:          data.gender ?? null,
    approval_status: data.autoApprove ? "approved" : "pending",
  }, { onConflict: "id" });

  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error("프로필 생성 실패: " + profileErr.message);
  }
}

// 유저 승인
export async function approveUser(userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

// 유저 삭제
export async function deleteUser(userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("profiles").delete().eq("id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

// ────────────────────────────────────────────────────────────────
//  역할 관련 액션
// ────────────────────────────────────────────────────────────────

export async function createRole(data: {
  name:           string;
  label:          string;
  color:          string;
  permissions:    Record<string, string[]>;
  category_order: string[];
  show_in_signup: boolean;
}) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("roles").insert(data);
  if (error) throw new Error(error.message);
}

export async function updateRole(id: string, data: {
  label?:          string;
  color?:          string;
  permissions?:    Record<string, string[]>;
  category_order?: string[];
  show_in_signup?: boolean;
}) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("roles").update(data).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRole(id: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("roles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ────────────────────────────────────────────────────────────────
//  레거시 (다른 컴포넌트가 참조하는 경우 대비)
// ────────────────────────────────────────────────────────────────
export async function updateName(userId: string, name: string) {
  return updateUserProfile(userId, { name, role: "user" });
}
