"use client";

import { useRef } from "react";

// 올해 고3 출생년도 (만 17~18세 기준)
function getDefaultYear() {
  return new Date().getFullYear() - 18;
}

const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
  </svg>
);

interface Props {
  value:     string;
  onChange:  (v: string) => void;
  className?: string;
  inputStyle?: React.CSSProperties;
}

export default function DateInput({ value, onChange, className = "sc-input w-full", inputStyle }: Props) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  function handleCalendarClick() {
    const el = hiddenRef.current;
    if (!el) return;
    // 비어있으면 고3 출생년도 1월 1일로 기본 세팅 후 달력 오픈
    if (!el.value) {
      el.value = `${getDefaultYear()}-01-01`;
    }
    try { el.showPicker(); } catch {}
  }

  function handleHiddenChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value); // YYYY-MM-DD
  }

  return (
    <div className="relative">
      {/* 보이는 텍스트 입력 */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="YYYY-MM-DD"
        className={className}
        style={{ paddingRight: 34, ...inputStyle }}
        maxLength={10}
      />

      {/* 숨겨진 날짜 피커 */}
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={handleHiddenChange}
        tabIndex={-1}
        style={{
          position:  "absolute",
          top:       0,
          left:      0,
          width:     "100%",
          height:    "100%",
          opacity:   0,
          pointerEvents: "none",
        }}
      />

      {/* 초록 달력 아이콘 */}
      <button
        type="button"
        onClick={handleCalendarClick}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
        style={{ color: "var(--sc-green)", lineHeight: 0 }}
      >
        <CalendarIcon />
      </button>
    </div>
  );
}
