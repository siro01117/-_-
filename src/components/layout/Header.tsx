"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/providers/ThemeProvider";
function CubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
      <polygon points="14,3 25,9 25,21 14,27 3,21 3,9"
        stroke="var(--sc-green)" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <polyline points="3,9 14,15 25,9"
        stroke="var(--sc-green)" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <line x1="14" y1="15" x2="14" y2="27"
        stroke="var(--sc-green)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

// 달/해 아이콘
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export default function Header({ name, role, roleLabel }: { name: string; role: string; roleLabel?: string }) {
  const router   = useRouter();
  const supabase = createClient();
  const { theme, toggle } = useTheme();

  const isDark = theme === "dark";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // 역할 표시 레이블과 색상 동적 결정
  const displayLabel = roleLabel ?? role.toUpperCase();
  const badgeStyle = role === "admin"
    ? "text-sc-green bg-[color:var(--sc-green)]/10 border-[color:var(--sc-green)]/20"
    : "text-sc-dim bg-sc-raised border-sc-border";

  return (
    <header
      className="flex items-center justify-between px-8 py-4 sticky top-0 z-50"
      style={{
        backgroundColor: "var(--sc-bg)",
        borderBottom: "1px solid var(--sc-border)",
        backdropFilter: "blur(12px)",
        transition: "background-color 0.3s ease, border-color 0.3s ease",
      }}
    >
      {/* 로고 */}
      <div className="flex items-center gap-2">
        <CubeIcon />
        <span className="font-black text-[16px] tracking-tight" style={{ color: "var(--sc-white)" }}>
          Study<span style={{ color: "var(--sc-green)" }}>CUBE</span>
        </span>
      </div>

      {/* 우측 */}
      <div className="flex items-center gap-3">
        {/* 역할 뱃지 */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-widest ${badgeStyle}`}>
          {displayLabel}
        </span>

        {/* 이름 */}
        <span className="text-sm font-semibold" style={{ color: "var(--sc-white)" }}>
          {name}
        </span>

        {/* 구분선 */}
        <div className="w-px h-4" style={{ background: "var(--sc-border)" }} />

        {/* 테마 토글 */}
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--sc-dim)" }}>
            {isDark ? <MoonIcon /> : <SunIcon />}
          </span>
          <button
            onClick={toggle}
            className={`theme-toggle ${isDark ? "active" : ""}`}
            aria-label="테마 전환"
          >
            <div className="theme-toggle-knob" />
          </button>
        </div>

        {/* 구분선 */}
        <div className="w-px h-4" style={{ background: "var(--sc-border)" }} />

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="text-[12px] font-medium transition-colors duration-150"
          style={{ color: "var(--sc-dim)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sc-white)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sc-dim)")}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
