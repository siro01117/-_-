import { createClient } from "@/lib/supabase/server";
import { redirect }      from "next/navigation";
import Link              from "next/link";
import ThemeToggle       from "@/components/ui/ThemeToggle";
import { HomeIcon }      from "@/components/ui/Icons";

const MIN_LOAD = new Promise((r) => setTimeout(r, 500));

export default async function FullSchedulePage() {
  const [, supabase] = await Promise.all([MIN_LOAD, createClient()]);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 내 역할 + 지위 조회
  const { data: myProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!myProfile) redirect("/login");

  const { data: myRoleData } = await supabase
    .from("roles").select("rank").eq("name", myProfile.role).single();
  const myRank: number = (myRoleData as any)?.rank ?? 0;

  // 전체 역할 목록 (rank > 내 rank만 — 하위 지위)
  const { data: allRoles } = await supabase
    .from("roles")
    .select("name, label, color, rank")
    .gt("rank", myRank)
    .order("rank");

  const viewableRoleNames = (allRoles ?? []).map((r: any) => r.name);

  // 열람 가능한 유저 목록 (승인된 유저 중 하위 지위)
  const { data: profiles } = viewableRoleNames.length > 0
    ? await supabase
        .from("profiles")
        .select("id, name, role, students ( grade, school )")
        .in("role", viewableRoleNames)
        .eq("approval_status", "approved")
        .order("name")
    : { data: [] };

  // 역할별로 그룹화
  const grouped = (allRoles ?? []).map((r: any) => ({
    role:     r,
    profiles: (profiles ?? []).filter((p: any) => p.role === r.name),
  })).filter(g => g.profiles.length > 0);

  // 모든 유저 → 범용 뷰어 사용 (rank 체크 포함)
  function scheduleHref(p: any): string {
    return `/schedule/user/${p.id}`;
  }

  function gradeLabel(p: any): string {
    const s = Array.isArray(p.students) ? p.students[0] : p.students;
    if (!s) return "";
    return [s.grade, s.school].filter(Boolean).join(" · ");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--sc-bg)" }}>
      {/* 헤더 */}
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--sc-surface)", borderBottom: "1px solid var(--sc-border)",
        padding: "0 20px", height: 52, display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link href="/portal" style={{ display: "flex", alignItems: "center", gap: 6,
          color: "var(--sc-dim)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          <HomeIcon /> 포털
        </Link>
        <span style={{ color: "var(--sc-border)", fontSize: 18 }}>·</span>
        <span style={{ color: "var(--sc-white)", fontSize: 14, fontWeight: 900 }}>전체 시간표</span>
        <div style={{ flex: 1 }} />
        <ThemeToggle />
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px", display: "flex", flexDirection: "column", gap: 40 }}>
        {/* 교실 시간표 링크 */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sc-dim)", marginBottom: 12 }}>
            교실 시간표
          </p>
          <Link href="/manage/classroom-schedule" style={{
            display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
            background: "var(--sc-surface)", border: "1px solid var(--sc-green)",
            borderRadius: 12, textDecoration: "none",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: "rgba(0,232,117,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sc-green)"
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: "var(--sc-white)", margin: 0 }}>교실 점유 시간표</p>
              <p style={{ fontSize: 12, color: "var(--sc-dim)", margin: "3px 0 0" }}>교실별 수업 배치 현황 확인</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sc-dim)"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>
        </div>

        {/* 역할별 그룹 */}
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--sc-dim)", fontSize: 13 }}>
            열람 가능한 시간표가 없습니다.
            <p style={{ fontSize: 11, marginTop: 8 }}>역할 설정에서 지위(rank)를 설정해 주세요.</p>
          </div>
        ) : grouped.map(({ role, profiles: roleProfiles }) => (
          <div key={role.name}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: role.color }} />
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "var(--sc-dim)", margin: 0 }}>
                {role.label}
              </p>
              <span style={{ fontSize: 11, color: "var(--sc-dim)" }}>· {roleProfiles.length}명</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--sc-dim)",
                background: "var(--sc-raised)", border: "1px solid var(--sc-border)",
                borderRadius: 6, padding: "1px 6px" }}>지위 {role.rank}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {roleProfiles.map((p: any) => (
                <Link key={p.id} href={scheduleHref(p)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  background: "var(--sc-surface)", border: "1px solid var(--sc-border)",
                  borderRadius: 10, textDecoration: "none", transition: "border-color 0.15s",
                }}
                className="hover:border-[color:var(--sc-green)]">
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: `${role.color}22`,
                    border: `1px solid ${role.color}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 900, color: role.color, flexShrink: 0,
                  }}>
                    {(p.name ?? "?")[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "var(--sc-white)", margin: 0 }}>
                      {p.name ?? "이름 없음"}
                    </p>
                    {gradeLabel(p) && (
                      <p style={{ fontSize: 11, color: "var(--sc-dim)", margin: "2px 0 0" }}>
                        {gradeLabel(p)}
                      </p>
                    )}
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--sc-dim)"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
