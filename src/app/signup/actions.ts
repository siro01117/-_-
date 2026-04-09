"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface SignupData {
  loginId:    string;
  password:   string;
  name:       string;
  role:       string;
  birthdate?: string;
  school?:    string;
  phone?:     string;
  gender?:    string;
}

export async function signupUser(data: SignupData) {
  const { loginId, password, name, role, birthdate, school, phone, gender } = data;

  // 유효성 검사
  if (!loginId.trim() || loginId.length < 3) throw new Error("아이디는 3자 이상이어야 합니다.");
  if (!/^[a-zA-Z0-9_]+$/.test(loginId)) throw new Error("아이디는 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
  if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
  if (!name.trim()) throw new Error("이름을 입력하세요.");
  if (!role) throw new Error("역할을 선택하세요.");

  const admin = createAdminClient();

  // 아이디 중복 확인
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("login_id", loginId.toLowerCase())
    .single();

  if (existing) throw new Error("이미 사용 중인 아이디입니다.");

  // Auth 계정 생성 (이메일 인증 없이)
  const email = `${loginId.toLowerCase()}@studycube.app`;
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,    // 이메일 확인 건너뜀
    user_metadata: { name, role },
  });

  if (authErr) {
    if (authErr.message.includes("already registered")) {
      throw new Error("이미 사용 중인 아이디입니다.");
    }
    throw new Error(authErr.message);
  }

  if (!created?.user?.id) throw new Error("계정 생성에 실패했습니다.");

  // 프로필 생성 (approval_status = 'pending')
  const { error: profileErr } = await admin.from("profiles").upsert({
    id:              created.user.id,
    email,
    name:            name.trim(),
    role,
    login_id:        loginId.toLowerCase(),
    birthdate:       birthdate || null,
    school:          school?.trim() || null,
    phone:           phone?.trim() || null,
    gender:          gender || null,
    approval_status: "pending",
  }, { onConflict: "id" });

  if (profileErr) {
    // 프로필 생성 실패 시 auth 유저도 정리
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error("프로필 생성 실패: " + profileErr.message);
  }
}
