"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createStudentUser, updateStudentUser,
  approveStudent, rejectStudent, deleteStudent, resetStudentPassword,
} from "@/app/manage/students/register/actions";
import DateInput from "@/components/ui/DateInput";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { HomeIcon, PlusIcon, PencilIcon, TrashIcon, CheckIcon,
  HashIcon, SchoolIcon, PhoneIcon, CalendarIcon } from "@/components/ui/Icons";

// ── 타입 ──────────────────────────────────────────────────────
interface Profile {
  id:              string;
  name:            string;
  login_id?:       string;
  email:           string;
  role:            string;
  birthdate?:      string;
  school?:         string;
  phone?:          string;
  gender?:         string;
  grade?:          string;   // students.grade에서 join
  approval_status: "pending" | "approved";
  created_at:      string;
}
interface RoleOption { name: string; label: string; color: string; }

// ── 아이콘 ────────────────────────────────────────────────────
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const KeyIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;

const GENDER_KO: Record<string, string> = { male: "남", female: "여" };

// ── 역할 배지 ─────────────────────────────────────────────────
function RoleBadge({ role, roles }: { role: string; roles: RoleOption[] }) {
  const r = roles.find(r => r.name === role);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      background: r ? `${r.color}22` : "var(--sc-raised)",
      color: r?.color ?? "var(--sc-dim)",
      border: `1px solid ${r ? `${r.color}55` : "var(--sc-border)"}`,
    }}>{r?.label ?? role}</span>
  );
}

// ── 학생 폼 모달 ──────────────────────────────────────────────
const GRADE_OPTIONS = ["1학년", "2학년", "3학년", "N수생"] as const;

function StudentFormModal({ initial, roles, schools, onClose, onSaved }: {
  initial?:  Profile;
  roles:     RoleOption[];
  schools:   string[];   // 기존 학교 목록 (자동완성용)
  onClose:   () => void;
  onSaved:   () => void;
}) {
  const isEdit = !!initial;
  const [name,      setName]     = useState(initial?.name      ?? "");
  const [role,      setRole]     = useState(initial?.role      ?? (roles[0]?.name ?? "user"));
  const [loginId,   setLoginId]  = useState(initial?.login_id  ?? "");
  const [password,  setPassword] = useState("");
  const [showPw,    setShowPw]   = useState(false);
  const [birthdate,   setBirthdate]  = useState(initial?.birthdate ?? "");
  const [school,      setSchool]     = useState(initial?.school    ?? "");
  const [schoolQuery, setSchoolQuery]= useState(initial?.school    ?? "");
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [phone,       setPhone]      = useState(initial?.phone     ?? "");
  const [gender,      setGender]     = useState(initial?.gender    ?? "");
  const [grade,  setGrade]  = useState(initial?.grade ?? "");
  const isNSu = grade === "N수생";
  const gradeValue = grade;
  const [error,     setError]    = useState("");
  const [pending,   startTrans]  = useTransition();

  function handleSave() {
    if (!name.trim()) { setError("이름을 입력하세요."); return; }
    if (!isEdit && !loginId.trim()) { setError("아이디를 입력하세요."); return; }
    if (!isEdit && password.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }
    setError("");
    startTrans(async () => {
      try {
        if (isEdit) {
          await updateStudentUser(initial!.id, {
            name: name.trim(), role,
            login_id:  loginId.trim() || null,
            password:  password || null,
            birthdate: birthdate || null,
            school:    school.trim() || null,
            phone:     phone.trim() || null,
            gender:    gender || null,
            grade:     gradeValue || null,
          });
        } else {
          await createStudentUser({
            loginId: loginId.trim(), password, name: name.trim(), role,
            birthdate: birthdate || undefined,
            school:    isNSu ? undefined : school.trim() || undefined,
            phone:     phone.trim() || undefined,
            gender:    gender || undefined,
            grade:     gradeValue || undefined,
          });
        }
        onSaved(); onClose();
      } catch (e: any) { setError(e.message); }
    });
  }

  const inp: React.CSSProperties = {
    width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13,
    fontWeight: 600, outline: "none", border: "1px solid var(--sc-border)",
    background: "var(--sc-raised)", color: "var(--sc-white)",
  };

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="fixed z-[60] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl shadow-2xl"
           style={{ background: "var(--sc-surface)", border: "1px solid var(--sc-border)", maxHeight: "90vh", overflowY: "auto" }}
           onClick={e => e.stopPropagation()}>

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--sc-dim)" }}>
                {isEdit ? "학생 수정" : "학생 추가"}
              </p>
              <h3 className="font-black text-lg" style={{ color: "var(--sc-white)" }}>
                {isEdit ? "정보 수정" : "새 학생 등록"}
              </h3>
            </div>
            <button type="button" onClick={onClose} className="text-xl hover:opacity-60" style={{ color: "var(--sc-dim)" }}>×</button>
          </div>

          <div className="space-y-3">
            {/* 이름 */}
            <div>
              <label className="block text-[11px] font-bold mb-1" style={{ color: "var(--sc-dim)" }}>이름 *</label>
              <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="학생 이름" autoFocus />
            </div>

            {/* 역할 */}
            <div>
              <label className="block text-[11px] font-bold mb-1.5" style={{ color: "var(--sc-dim)" }}>역할</label>
              <div className="flex flex-wrap gap-1.5">
                {roles.map(r => (
                  <button key={r.name} type="button" onClick={() => setRole(r.name)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: role === r.name ? `${r.color}22` : "var(--sc-raised)",
                      color:      role === r.name ? r.color          : "var(--sc-dim)",
                      border:     `1px solid ${role === r.name ? r.color : "var(--sc-border)"}`,
                    }}>{r.label}</button>
                ))}
              </div>
            </div>

            {/* 아이디 */}
            <div>
              <label className="block text-[11px] font-bold mb-1" style={{ color: "var(--sc-dim)" }}>
                아이디 {!isEdit && "*"}
                {isEdit && <span style={{ fontWeight: 400, marginLeft: 4 }}>(변경 시 입력)</span>}
              </label>
              <input style={inp} value={loginId} onChange={e => setLoginId(e.target.value)}
                placeholder={isEdit ? "변경하지 않으려면 비워두세요" : "영문/숫자/밑줄"} />
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-[11px] font-bold mb-1" style={{ color: "var(--sc-dim)" }}>
                비밀번호 {!isEdit && "*"}
                {isEdit && <span style={{ fontWeight: 400, marginLeft: 4 }}>(변경 시 입력)</span>}
              </label>
              <div className="relative">
                <input style={{ ...inp, paddingRight: 36 }} type={showPw ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={isEdit ? "변경하지 않으려면 비워두세요" : "8자 이상"} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--sc-dim)" }}>
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* 생년월일 */}
            <div>
              <label className="block text-[11px] font-bold mb-1" style={{ color: "var(--sc-dim)" }}>생년월일</label>
              <DateInput value={birthdate} onChange={setBirthdate} inputStyle={inp} />
            </div>

            {/* 학교 — N수생이면 숨김 */}
            {!isNSu && <div style={{ position: "relative" }}>
              <label className="block text-[11px] font-bold mb-1" style={{ color: "var(--sc-dim)" }}>학교</label>
              <input style={inp}
                value={schoolQuery}
                onChange={e => { setSchoolQuery(e.target.value); setSchool(e.target.value); setShowSchoolSuggestions(true); }}
                onFocus={() => setShowSchoolSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSchoolSuggestions(false), 150)}
                placeholder="재학 중인 학교명" />
              {showSchoolSuggestions && schoolQuery && (
                (() => {
                  const matched = schools.filter(s =>
                    s.toLowerCase().includes(schoolQuery.toLowerCase()) && s !== schoolQuery
                  );
                  return matched.length > 0 ? (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, marginTop: 4,
                      background: "var(--sc-surface)", border: "1px solid var(--sc-border)",
                      borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", maxHeight: 160, overflowY: "auto",
                    }}>
                      {matched.map(s => (
                        <button key={s} type="button"
                          onMouseDown={() => { setSchool(s); setSchoolQuery(s); setShowSchoolSuggestions(false); }}
                          style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "9px 12px", fontSize: 13, fontWeight: 600,
                            color: "var(--sc-white)", background: "transparent", border: "none", cursor: "pointer",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--sc-raised)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()
              )}
            </div>}

            {/* 학년 */}
            <div>
              <label className="block text-[11px] font-bold mb-1.5" style={{ color: "var(--sc-dim)" }}>학년</label>
              <div style={{ display: "flex", gap: 6 }}>
                {GRADE_OPTIONS.map(g => (
                  <button key={g} type="button"
                    onClick={() => setGrade(prev => prev === g ? "" : g)}
                    style={{
                      flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      background: grade === g
                        ? (g === "N수생" ? "rgba(251,191,36,0.2)" : "var(--sc-green)")
                        : "var(--sc-raised)",
                      color: grade === g
                        ? (g === "N수생" ? "#fbbf24" : "var(--sc-bg)")
                        : "var(--sc-dim)",
                      border: `1px solid ${grade === g
                        ? (g === "N수생" ? "#fbbf24" : "var(--sc-green)")
                        : "var(--sc-border)"}`,
                      transition: "all 0.12s",
                    }}>{g}</button>
                ))}
              </div>
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-[11px] font-bold mb-1" style={{ color: "var(--sc-dim)" }}>연락처</label>
              <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>

            {/* 성별 */}
            <div>
              <label className="block text-[11px] font-bold mb-1.5" style={{ color: "var(--sc-dim)" }}>성별</label>
              <div className="flex gap-2">
                {[{ v: "male", l: "남" }, { v: "female", l: "여" }, { v: "", l: "미선택" }].map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setGender(v)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: gender === v ? "var(--sc-green)" : "var(--sc-raised)",
                      color:      gender === v ? "var(--sc-bg)"    : "var(--sc-dim)",
                      border:     `1px solid ${gender === v ? "var(--sc-green)" : "var(--sc-border)"}`,
                    }}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm mt-3 text-center" style={{ color: "#f87171" }}>{error}</p>}

          <div className="grid grid-cols-2 gap-2 mt-5">
            <button type="button" onClick={onClose}
              className="py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "var(--sc-raised)", color: "var(--sc-dim)", border: "1px solid var(--sc-border)" }}>취소</button>
            <button type="button" onClick={handleSave} disabled={pending}
              className="py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: "var(--sc-green)", color: "var(--sc-bg)", opacity: pending ? 0.6 : 1 }}>
              {pending ? "처리 중…" : isEdit ? "수정 완료" : "등록"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── 비밀번호 초기화 모달 ─────────────────────────────────────
function ResetPasswordModal({ profile, onClose, onSaved }: {
  profile: Profile; onClose: () => void; onSaved: () => void;
}) {
  const [pw,      setPw]      = useState("");
  const [showPw,  setShowPw]  = useState(false);
  const [error,   setError]   = useState("");
  const [pending, startTrans] = useTransition();

  function handleReset() {
    if (pw.length < 8) { setError("8자 이상 입력하세요."); return; }
    setError("");
    startTrans(async () => {
      try {
        await resetStudentPassword(profile.id, pw);
        onSaved(); onClose();
      } catch (e: any) { setError(e.message); }
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-[70]" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="fixed z-[80] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
           style={{ background: "var(--sc-surface)", border: "1px solid var(--sc-border)" }}
           onClick={e => e.stopPropagation()}>
        <h3 className="font-black text-base mb-1" style={{ color: "var(--sc-white)" }}>비밀번호 초기화</h3>
        <p className="text-xs mb-4" style={{ color: "var(--sc-dim)" }}>{profile.name} 학생의 비밀번호를 변경합니다.</p>
        <div className="relative mb-3">
          <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
            placeholder="새 비밀번호 (8자 이상)"
            className="sc-input text-sm w-full" style={{ padding: "9px 36px 9px 12px" }} autoFocus />
          <button type="button" onClick={() => setShowPw(v => !v)}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--sc-dim)" }}>
            {showPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {error && <p className="text-xs mb-2 text-center" style={{ color: "#f87171" }}>{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose}
            className="py-2 rounded-xl text-sm font-bold"
            style={{ background: "var(--sc-raised)", color: "var(--sc-dim)", border: "1px solid var(--sc-border)" }}>취소</button>
          <button type="button" onClick={handleReset} disabled={pending}
            className="py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: "var(--sc-green)", color: "var(--sc-bg)", opacity: pending ? 0.6 : 1 }}>
            {pending ? "변경 중…" : "변경"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── 학생 카드 ─────────────────────────────────────────────────
function StudentCard({ profile, roles, onEdit, onDelete, onResetPw }: {
  profile: Profile; roles: RoleOption[];
  onEdit: () => void; onDelete: () => void; onResetPw: () => void;
}) {
  const age = profile.birthdate
    ? new Date().getFullYear() - parseInt(profile.birthdate.slice(0, 4))
    : null;

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 relative group"
         style={{ background: "var(--sc-surface)", border: "1px solid var(--sc-border)" }}>

      {/* 이름 + 역할 */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-black text-sm" style={{ color: "var(--sc-white)" }}>{profile.name}</p>
        <RoleBadge role={profile.role} roles={roles} />
        {profile.approval_status === "pending" && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24",
            background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: 20, padding: "2px 7px" }}>승인 대기</span>
        )}
      </div>

      {/* 상세 정보 */}
      <div className="flex flex-col gap-1">
        {profile.login_id && (
          <p className="text-xs" style={{ color: "var(--sc-dim)" }}>
            <HashIcon size={11}/> <span style={{ color: "var(--sc-white)", fontWeight: 600 }}>{profile.login_id}</span>
          </p>
        )}
        {(profile.school || profile.grade) && (
          <p className="text-xs" style={{ color: "var(--sc-dim)" }}>
            <SchoolIcon size={11}/> {[profile.school, profile.grade].filter(Boolean).join(" · ")}
          </p>
        )}
        {(age || profile.gender) && (
          <p className="text-xs" style={{ color: "var(--sc-dim)" }}>
            {age && `${age}세`}
            {age && profile.gender && " · "}
            {profile.gender && GENDER_KO[profile.gender]}
            {profile.birthdate && ` (${profile.birthdate})`}
          </p>
        )}
        {profile.phone && (
          <p className="text-xs" style={{ color: "var(--sc-dim)" }}><PhoneIcon size={11}/> {profile.phone}</p>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        <button type="button" onClick={onResetPw} title="비밀번호 초기화"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
          style={{ background: "var(--sc-raised)", color: "var(--sc-dim)", border: "1px solid var(--sc-border)" }}>
          <KeyIcon />
        </button>
        <button type="button" onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
          style={{ background: "var(--sc-raised)", color: "var(--sc-dim)", border: "1px solid var(--sc-border)" }}>
          <PencilIcon />
        </button>
        <button type="button" onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ── 승인 대기 카드 ────────────────────────────────────────────
function PendingCard({ profile, roles, onApprove, onReject }: {
  profile: Profile; roles: RoleOption[];
  onApprove: () => void; onReject: () => void;
}) {
  const [pending, startTrans] = useTransition();
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
         style={{ background: "var(--sc-surface)", border: "1px solid rgba(251,191,36,0.3)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-black text-sm" style={{ color: "var(--sc-white)" }}>{profile.name}</p>
        <RoleBadge role={profile.role} roles={roles} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24",
          background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)",
          borderRadius: 20, padding: "2px 7px" }}>승인 대기 중</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {profile.login_id && <p className="text-xs" style={{ color: "var(--sc-dim)" }}><HashIcon size={11}/> {profile.login_id}</p>}
        {profile.school   && <p className="text-xs" style={{ color: "var(--sc-dim)" }}><SchoolIcon size={11}/> {profile.school}</p>}
        {profile.phone    && <p className="text-xs" style={{ color: "var(--sc-dim)" }}><PhoneIcon size={11}/> {profile.phone}</p>}
        <p className="text-xs" style={{ color: "var(--sc-dim)" }}>
          <CalendarIcon size={11}/> 가입 신청: {new Date(profile.created_at).toLocaleDateString("ko-KR")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={pending}
          onClick={() => startTrans(async () => { try { await rejectStudent(profile.id); onReject(); } catch {} })}
          className="py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", opacity: pending ? 0.6 : 1 }}>
          거절
        </button>
        <button type="button" disabled={pending}
          onClick={() => startTrans(async () => { try { await approveStudent(profile.id); onApprove(); } catch {} })}
          className="py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
          style={{ background: "var(--sc-green)", color: "var(--sc-bg)", opacity: pending ? 0.6 : 1 }}>
          {pending ? "처리 중…" : <span style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><CheckIcon size={12}/> 승인</span>}
        </button>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function StudentManager({ initialProfiles, roles, myRole }: {
  initialProfiles: Profile[];
  roles:           RoleOption[];
  myRole:          string;
}) {
  const router  = useRouter();

  // page.tsx에서 students join으로 넘어온 grade 추출
  const [profiles, setProfiles] = useState<Profile[]>(
    initialProfiles.map((p: any) => ({
      ...p,
      grade: p.students?.[0]?.grade ?? p.students?.grade ?? undefined,
    }))
  );
  const [tab,       setTab]       = useState<"pending" | "students">("pending");
  const [search,    setSearch]    = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [resetPwTarget, setResetPwTarget] = useState<Profile | null>(null);
  const [pending,   startTrans]   = useTransition();

  const pending_  = profiles.filter(p => p.approval_status === "pending");
  const approved_ = profiles.filter(p => p.approval_status === "approved");

  // 기존 학교 목록 (자동완성용)
  const schoolList = useMemo(() =>
    Array.from(new Set(profiles.map(p => p.school).filter(Boolean) as string[])).sort(),
  [profiles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return approved_.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.login_id ?? "").toLowerCase().includes(q) ||
      (p.school ?? "").toLowerCase().includes(q) ||
      (p.phone ?? "").includes(q)
    );
  }, [approved_, search]);

  function refresh() { router.refresh(); }

  async function handleDelete(profile: Profile) {
    if (!confirm(`"${profile.name}" 학생을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    startTrans(async () => {
      try {
        await deleteStudent(profile.id);
        setProfiles(prev => prev.filter(p => p.id !== profile.id));
      } catch (e: any) { alert(e.message); }
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--sc-bg)" }}>

      {/* 헤더 */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--sc-bg)",
        borderBottom: "1px solid var(--sc-border)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 28px" }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/portal" className="flex items-center gap-1.5 text-xs font-bold hover:opacity-70 transition-opacity"
                    style={{ color: "var(--sc-dim)", textDecoration: "none" }}>
                <HomeIcon size={13} /> 홈
              </Link>
              <span style={{ color: "var(--sc-border)" }}>·</span>
              <h1 className="font-black text-lg" style={{ color: "var(--sc-white)" }}>학생 관리</h1>
              {pending_.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, background: "#fbbf24",
                  color: "#000", borderRadius: 20, padding: "2px 8px" }}>
                  대기 {pending_.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button type="button" onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: "var(--sc-green)", color: "var(--sc-bg)" }}>
                <PlusIcon /> 학생 추가
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 mt-3">
            {([
              { key: "pending",  label: `승인 대기 (${pending_.length})` },
              { key: "students", label: `전체 학생 (${approved_.length})` },
            ] as const).map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: tab === key ? "var(--sc-green)" : "var(--sc-raised)",
                  color:      tab === key ? "var(--sc-bg)"    : "var(--sc-dim)",
                  border:     `1px solid ${tab === key ? "var(--sc-green)" : "var(--sc-border)"}`,
                }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px" }}>

        {/* 승인 대기 탭 */}
        {tab === "pending" && (
          pending_.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--sc-dim)", fontSize: 13 }}>
              대기 중인 가입 신청이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {pending_.map(p => (
                <PendingCard key={p.id} profile={p} roles={roles}
                  onApprove={() => {
                    setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, approval_status: "approved" } : x));
                    if (pending_.length <= 1) setTab("students");
                  }}
                  onReject={() => setProfiles(prev => prev.filter(x => x.id !== p.id))}
                />
              ))}
            </div>
          )
        )}

        {/* 학생 목록 탭 */}
        {tab === "students" && (
          <>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="이름, 아이디, 학교, 연락처 검색..."
              className="sc-input text-sm w-full mb-5" style={{ padding: "10px 14px" }} />

            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--sc-dim)", fontSize: 13 }}>
                {search ? `"${search}" 검색 결과 없음` : "등록된 학생이 없습니다."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map(p => (
                  <StudentCard key={p.id} profile={p} roles={roles}
                    onEdit={() => setEditTarget(p)}
                    onDelete={() => handleDelete(p)}
                    onResetPw={() => setResetPwTarget(p)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 모달들 */}
      {createOpen && (
        <StudentFormModal roles={roles} schools={schoolList}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); refresh(); }} />
      )}
      {editTarget && (
        <StudentFormModal initial={editTarget} roles={roles} schools={schoolList}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refresh(); }} />
      )}
      {resetPwTarget && (
        <ResetPasswordModal profile={resetPwTarget}
          onClose={() => setResetPwTarget(null)}
          onSaved={() => setResetPwTarget(null)} />
      )}
    </div>
  );
}
