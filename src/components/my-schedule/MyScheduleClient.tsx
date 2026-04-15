"use client";

import {
  useState, useEffect, useCallback, useRef,
  useLayoutEffect, useMemo,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { HomeIcon } from "@/components/ui/Icons";
import { getMonday } from "@/components/classroom-schedule/constants";

// ── 레이아웃 상수 ──────────────────────────────────────────────
const BASE_HOUR   = 8;
const TOTAL_HOURS = 17;
const FIXED_PPH   = 60;
const TIME_COL_W  = 52;
const MIN_BLOCK_H = 16;

const DAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
] as const;
type DayKey = typeof DAYS[number]["key"];

const FALLBACK_ACCENTS = [
  "#00e875","#5badff","#c084fc","#fb923c",
  "#fbbf24","#f472b6","#2dd4bf","#f87171",
];

// ── 타입 ──────────────────────────────────────────────────────
export interface ScheduleBlock {
  id:            string;
  day:           DayKey;
  start_time:    string;
  end_time:      string;
  title:         string;
  subtitle?:     string;
  color?:        string;
  isPersonal:    boolean;
  notes?:        string;
  enrolledNames?: string[];
  tags?:         string[];
  raw?:          any;
}

interface Props {
  userRole:          string;
  userName:          string;
  userId:            string;
  classSchedules:    any[];
  enrollments?:      any[];
  personalSchedules: any[];
  readOnly?:         boolean;
}

// ── 유틸 ──────────────────────────────────────────────────────
function toHHMM(t: string) { return t.slice(0, 5); }

function timeToMin(t: string): number {
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (h < BASE_HOUR) h += 24;
  return (h - BASE_HOUR) * 60 + m;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const n = parseInt(c.length === 3 ? c.split("").map(x => x+x).join("") : c, 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}

function blockColor(accent: string, isDark: boolean) {
  const [r, g, b] = hexToRgb(accent);
  if (isDark) {
    return {
      bg:    `rgb(${Math.round(r*0.35+15)},${Math.round(g*0.35+15)},${Math.round(b*0.35+17)})`,
      border: accent, text: "#fff", muted: "rgba(255,255,255,0.65)",
    };
  }
  return {
    bg:    `rgb(${Math.min(252,Math.round(r*0.30+175))},${Math.min(252,Math.round(g*0.30+175))},${Math.min(250,Math.round(b*0.30+173))})`,
    border: `rgb(${Math.round(r*0.52)},${Math.round(g*0.52)},${Math.round(b*0.52)})`,
    text: "#0d0d0d", muted: "rgba(15,15,15,0.58)",
  };
}

function accentFor(key: string): string {
  const hash = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length];
}

function fmtWeekRange(monday: Date, sunday: Date): string {
  const m1 = monday.getMonth() + 1, d1 = monday.getDate();
  const m2 = sunday.getMonth() + 1, d2 = sunday.getDate();
  return m1 === m2 ? `${m1}월 ${d1}일 ~ ${d2}일` : `${m1}월 ${d1}일 ~ ${m2}월 ${d2}일`;
}

const DAY_TO_KEY: Record<number, DayKey | null> = {
  0:"sun", 1:"mon", 2:"tue", 3:"wed", 4:"thu", 5:"fri", 6:"sat",
};

// ── 훅 ────────────────────────────────────────────────────────
function useDarkMode() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function useNowPx() {
  const [px, setPx] = useState<number | null>(null);
  const calc = useCallback(() => {
    const now = new Date();
    let h = now.getHours(); const m = now.getMinutes();
    const ok = h >= BASE_HOUR || h === 0 || (h === 1 && m === 0);
    if (!ok) { setPx(null); return; }
    if (h < BASE_HOUR) h += 24;
    const mins = (h - BASE_HOUR)*60 + m;
    if (mins > TOTAL_HOURS*60) { setPx(null); return; }
    setPx(mins * (FIXED_PPH/60));
  }, []);
  useEffect(() => { calc(); const id = setInterval(calc, 30_000); return () => clearInterval(id); }, [calc]);
  return px;
}

function useIsWideLayout() {
  const [isWide, setIsWide] = useState(false);
  useLayoutEffect(() => {
    function check() { setIsWide(window.innerWidth / window.innerHeight > 1.4); }
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isWide;
}

function useCounterZoom(base: number): number {
  const initialDPR = useRef<number>(1);
  const [zoom, setZoom] = useState(base);
  useLayoutEffect(() => {
    initialDPR.current = window.devicePixelRatio;
    function update() {
      const cssZoom = window.devicePixelRatio / initialDPR.current;
      setZoom(base / Math.max(0.25, Math.min(4, cssZoom)));
    }
    update(); window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [base]);
  return zoom;
}

// ── WeekNav ───────────────────────────────────────────────────
function WeekNav({ weekOffset, setWeekOffset, compact = false }: {
  weekOffset: number;
  setWeekOffset: (fn: (o: number) => number) => void;
  compact?: boolean;
}) {
  const [pickerVal, setPickerVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const monday = getMonday(weekOffset);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const isCurrentWeek = weekOffset === 0;

  function goToDate(dateStr: string) {
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    const thisMonday   = getMonday(0);
    const targetMonday = new Date(d);
    targetMonday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const diffWeeks = Math.round((targetMonday.getTime() - thisMonday.getTime()) / (7*86400000));
    setWeekOffset(() => diffWeeks);
  }

  function openPicker() {
    const y = monday.getFullYear();
    const m = String(monday.getMonth()+1).padStart(2,"0");
    const d = String(monday.getDate()).padStart(2,"0");
    setPickerVal(`${y}-${m}-${d}`);
    setTimeout(() => inputRef.current?.showPicker?.(), 80);
  }

  const navBtn = (dir: -1 | 1) => (
    <button onClick={() => setWeekOffset(o => o + dir)}
      style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        display:"flex", alignItems:"center", justifyContent:"center",
        background:"var(--sc-raised)", border:"1px solid var(--sc-border)",
        color:"var(--sc-white)", fontSize:14, cursor:"pointer",
        transition:"transform 0.1s",
      }}
      onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.1)")}
      onMouseLeave={e=>(e.currentTarget.style.transform="")}>
      {dir === -1 ? "‹" : "›"}
    </button>
  );

  const dateBtn = (
    <div style={{ position:"relative" }}>
      <button onClick={openPicker}
        style={{ fontSize: compact ? 13 : 14, fontWeight:800, color:"var(--sc-white)", background:"none", border:"none", cursor:"pointer", padding:0, lineHeight:1.5 }}>
        {fmtWeekRange(monday, sunday)}
      </button>
      <input ref={inputRef} type="date" value={pickerVal}
        onChange={e => { setPickerVal(e.target.value); goToDate(e.target.value); }}
        style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", opacity:0, pointerEvents:"none" }}
      />
    </div>
  );

  const thisWeekBtn = (
    <button onClick={() => setWeekOffset(() => 0)}
      style={{
        fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:7, flexShrink:0,
        color:      isCurrentWeek ? "var(--sc-bg)"    : "var(--sc-dim)",
        background: isCurrentWeek ? "var(--sc-green)" : "var(--sc-raised)",
        border:     `1px solid ${isCurrentWeek ? "var(--sc-green)" : "var(--sc-border)"}`,
        cursor:"pointer", transition:"all 0.15s",
      }}>
      이번 주
    </button>
  );

  if (compact) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {dateBtn}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {navBtn(-1)}
          <div style={{ flex:1, display:"flex", justifyContent:"center" }}>{thisWeekBtn}</div>
          {navBtn(1)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginTop:6 }}>
      {navBtn(-1)}{dateBtn}{navBtn(1)}{thisWeekBtn}
    </div>
  );
}

// ── 블록 컴포넌트 ─────────────────────────────────────────────
function Block({ b, isDark, onClick, nowPx, onTagClick }: {
  b: ScheduleBlock; isDark: boolean; onClick: () => void;
  nowPx: number | null;
  onTagClick?: (tag: string) => void;
}) {
  const top    = timeToMin(b.start_time) * (FIXED_PPH/60);
  const height = Math.max((timeToMin(b.end_time) - timeToMin(b.start_time)) * (FIXED_PPH/60), MIN_BLOCK_H);
  const accent = b.color ?? accentFor(b.title);
  const clr    = blockColor(accent, isDark);
  const fzTitle = Math.max(8,  Math.min(11, Math.round(height*0.15)));
  const fzTime  = Math.max(7,  Math.min(9,  Math.round(height*0.13)));

  // 현재 시간이 이 블록 안에 있으면 테마색 강조
  const isNow = nowPx !== null && nowPx >= top && nowPx <= top + height;

  return (
    <div
      className="sched-block"
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        position:"absolute", top, height, left:3, right:3,
        background:clr.bg,
        borderLeft: isNow ? `3px solid var(--sc-green)` : `3px solid ${clr.border}`,
        borderRadius:6, cursor:"pointer", overflow:"hidden",
        padding:"4px 6px", userSelect:"none",
        transition:"filter 0.15s, transform 0.15s", zIndex: isNow ? 3 : 2,
        boxShadow: isNow
          ? `0 0 0 1.5px var(--sc-green), 0 2px 10px rgba(0,0,0,0.2)`
          : undefined,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.filter    = isDark ? "brightness(1.4)" : "brightness(0.88)";
        e.currentTarget.style.transform = "scaleX(1.015)";
        e.currentTarget.style.zIndex    = "10";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.filter    = "";
        e.currentTarget.style.transform = "";
        e.currentTarget.style.zIndex    = isNow ? "3" : "2";
      }}
    >
      {height > 16 && (
        <p style={{
          fontSize:fzTitle, fontWeight:700, color:clr.text,
          margin:0, lineHeight:1.3, overflow:"hidden",
          whiteSpace:"nowrap", textOverflow:"ellipsis",
        }}>{b.title}</p>
      )}
      {/* 수강 학생 이름 */}
      {!b.isPersonal && b.enrolledNames && b.enrolledNames.length > 0 && height > 28 && (
        <p style={{
          fontSize: Math.max(7, fzTitle - 2), fontWeight: 600, color: clr.muted,
          margin: "1px 0 0", lineHeight: 1.2, overflow: "hidden",
          whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}>
          {b.enrolledNames.join(" · ")}
        </p>
      )}
      {/* 시간 — 블록 하단 고정 */}
      {height > 22 && (
        <div style={{
          position:"absolute", bottom:3, left:6, right:5,
          display:"flex", alignItems:"baseline", gap:2,
          whiteSpace:"nowrap", overflow:"hidden",
        }}>
          <span style={{ fontSize:fzTime + 1, fontWeight:700, color:clr.muted, fontVariantNumeric:"tabular-nums" }}>
            {toHHMM(b.start_time)}
          </span>
          <span style={{ fontSize:fzTime - 1, fontWeight:300, color:clr.muted, opacity:0.55, margin:"0 1px" }}>
            ~
          </span>
          <span style={{ fontSize:fzTime + 1, fontWeight:700, color:clr.muted, fontVariantNumeric:"tabular-nums" }}>
            {toHHMM(b.end_time)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── 블록 상세 모달 ────────────────────────────────────────────
function DetailModal({ block, onClose, onEdit, onDelete }: {
  block:    ScheduleBlock;
  onClose:  () => void;
  onEdit:   (b: ScheduleBlock) => void;
  onDelete: (id: string, soft: boolean) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState<"soft"|"hard"|null>(null);
  const accent = block.color ?? accentFor(block.title);
  const isRecurring = block.isPersonal && !block.raw?.specific_date;
  const DAY_KR: Record<string, string> = {
    mon:"월",tue:"화",wed:"수",thu:"목",fri:"금",sat:"토",sun:"일",
  };

  async function doDelete(soft: boolean) {
    const msg = soft
      ? "이 일정을 임시로 숨길까요?\n(고정 일정이 이번 주부터 보이지 않게 됩니다)"
      : "이 일정을 완전히 삭제할까요?";
    if (!confirm(msg)) return;
    setDeleting(soft ? "soft" : "hard");
    await onDelete(block.id, soft);
    setDeleting(null);
    onClose();
  }

  const delBtn = (soft: boolean, label: string) => (
    <button
      onClick={() => doDelete(soft)}
      disabled={deleting !== null}
      style={{
        flex:1, padding:"8px 0", borderRadius:8, fontSize:12, fontWeight:800,
        cursor: deleting !== null ? "not-allowed" : "pointer",
        background: soft ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.15)",
        color:      soft ? "#fbbf24"               : "#f87171",
        border:     soft ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(248,113,113,0.3)",
        opacity: deleting !== null ? 0.5 : 1,
        transition:"opacity 0.15s",
      }}>
      {deleting === (soft ? "soft" : "hard") ? "처리 중…" : label}
    </button>
  );

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:"var(--sc-surface)", border:"1px solid var(--sc-border)",
          borderRadius:16, padding:"22px 22px 18px", width:"100%", maxWidth:320,
          display:"flex", flexDirection:"column", gap:14,
        }}
      >
        {/* 상단 색 바 + 제목 */}
        <div style={{ borderLeft:`4px solid ${accent}`, paddingLeft:10 }}>
          <p style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)", margin:"0 0 3px", textTransform:"uppercase", letterSpacing:"0.1em" }}>
            {block.isPersonal ? (isRecurring ? "고정 일정" : "임시 일정") : "수업"}
          </p>
          <p style={{ fontSize:17, fontWeight:900, color:"var(--sc-white)", margin:0, lineHeight:1.3 }}>
            {block.title}
          </p>
          {block.subtitle && (
            <p style={{ fontSize:12, color:"var(--sc-dim)", margin:"4px 0 0", fontWeight:600 }}>
              {block.subtitle}
            </p>
          )}
        </div>

        {/* 정보 */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {isRecurring
            ? <Row label="요일" value={`${DAY_KR[block.day] ?? block.day}요일 (매주)`} />
            : <Row label="날짜" value={block.raw?.specific_date ?? ""} />
          }
          <Row label="시간" value={`${toHHMM(block.start_time)} ~ ${toHHMM(block.end_time)}`} />
          {block.notes && <Row label="메모" value={block.notes} />}
          {block.tags && block.tags.length > 0 && (
            <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)", minWidth:36, flexShrink:0 }}>태그</span>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {block.tags.map(t => (
                  <span key={t} style={{
                    fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20,
                    background:"var(--sc-raised)", border:"1px solid var(--sc-border)",
                    color:"var(--sc-white)",
                  }}>#{t}</span>
                ))}
              </div>
            </div>
          )}
          {block.raw?.group_id && (
            <p style={{ fontSize:10, color:"var(--sc-dim)", fontWeight:600 }}>
              묶음 일정 — 수정/삭제 시 같은 그룹 전체 적용
            </p>
          )}
        </div>

        {/* 버튼 */}
        {block.isPersonal ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:2 }}>
            {/* 닫기 + 수정 */}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={onClose}
                style={{ flex:1, padding:"8px 0", borderRadius:8, fontSize:13, fontWeight:800, cursor:"pointer", background:"var(--sc-raised)", color:"var(--sc-dim)", border:"1px solid var(--sc-border)" }}>
                닫기
              </button>
              <button onClick={() => { onClose(); onEdit(block); }}
                style={{ flex:1, padding:"8px 0", borderRadius:8, fontSize:13, fontWeight:800, cursor:"pointer", background:"var(--sc-raised)", color:"var(--sc-white)", border:"1px solid var(--sc-border)" }}>
                수정
              </button>
            </div>
            {/* 삭제 버튼 — 고정: 임시/완전 | 임시: 삭제만 */}
            <div style={{ display:"flex", gap:8 }}>
              {isRecurring ? (
                <>
                  {delBtn(true,  "임시 삭제")}
                  {delBtn(false, "완전 삭제")}
                </>
              ) : (
                delBtn(false, "삭제")
              )}
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", gap:8, marginTop:2 }}>
            <button onClick={onClose}
              style={{ flex:1, padding:"8px 0", borderRadius:8, fontSize:13, fontWeight:800, cursor:"pointer", background:"var(--sc-raised)", color:"var(--sc-dim)", border:"1px solid var(--sc-border)" }}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
      <span style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)", minWidth:36, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color:"var(--sc-white)", lineHeight:1.4 }}>{value}</span>
    </div>
  );
}

// ── 개인 일정 폼 데이터 타입 ──────────────────────────────────
export type PersonalFormData = {
  title:         string;
  start_time:    string;
  end_time:      string;
  color:         string;
  notes:         string;
  isRecurring:   boolean;
  days:          DayKey[];
  specific_date: string;
  tags:          string[];
};

// ── 개인 일정 추가/수정 모달 ───────────────────────────────────
function PersonalFormModal({ initial, onClose, onSave, presetDay, presetTime, presetDate, suggestedTags }: {
  initial?:        ScheduleBlock | null;
  onClose:         () => void;
  onSave:          (data: PersonalFormData) => Promise<void>;
  presetDay?:      DayKey;
  presetTime?:     string;
  presetDate?:     string;
  suggestedTags?:  string[];  // 다른 일정에서 사용 중인 태그 추천
}) {
  const isEdit        = !!initial;
  const editIsRecurring = isEdit ? !initial!.raw?.specific_date : true;

  const [title,       setTitle]       = useState(initial?.title ?? "");
  const [isRecurring, setIsRecurring] = useState<boolean>(editIsRecurring);
  const [days,        setDays]        = useState<DayKey[]>(
    isEdit ? [initial!.day] : (presetDay ? [presetDay] : ["mon"])
  );
  const [specDate,    setSpecDate]    = useState<string>(
    initial?.raw?.specific_date          // 수정 시: 원본 날짜
    ?? presetDate                         // 클릭으로 열릴 때: 클릭한 열의 날짜
    ?? new Date().toISOString().split("T")[0]  // 기본: 오늘
  );

  // 클릭으로 열렸을 때 시작시간 자동설정, 종료시간은 +1시간
  function addOneHour(t: string) {
    const [h, m] = t.split(":").map(Number);
    return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const defaultStart = presetTime ?? (initial ? toHHMM(initial.start_time) : "09:00");
  const defaultEnd   = presetTime ? addOneHour(presetTime) : (initial ? toHHMM(initial.end_time) : "10:00");

  const [start,       setStart]       = useState(defaultStart);
  const [end,         setEnd]         = useState(defaultEnd);
  const [color,       setColor]       = useState(initial?.color ?? "#5badff");
  const [notes,       setNotes]       = useState(initial?.notes ?? "");
  const [tags,        setTags]        = useState<string[]>(initial?.tags ?? []);
  const [tagInput,    setTagInput]    = useState("");
  const [saving,      setSaving]      = useState(false);

  function addTag() {
    const v = tagInput.trim();
    if (!v || tags.includes(v)) return;
    setTags(prev => [...prev, v]);
    setTagInput("");
  }
  function removeTag(t: string) { setTags(prev => prev.filter(x => x !== t)); }

  function toggleDay(key: DayKey) {
    setDays(prev =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter(d => d !== key) : prev) : [...prev, key]
    );
  }

  async function handleSave() {
    if (!title.trim()) return;
    if (isRecurring && days.length === 0) return;
    setSaving(true);
    await onSave({ title, start_time:start, end_time:end, color, notes, isRecurring, days, specific_date:specDate, tags });
    setSaving(false);
  }

  const inp: React.CSSProperties = {
    width:"100%", borderRadius:8, padding:"8px 12px", fontSize:13, fontWeight:600,
    outline:"none", border:"1px solid var(--sc-border)",
    background:"var(--sc-raised)", color:"var(--sc-white)", boxSizing:"border-box",
  };

  const tabBtn = (active: boolean, label: string, onClick: () => void) => (
    <button onClick={onClick}
      style={{
        flex:1, padding:"7px 0", borderRadius:8, fontSize:12, fontWeight:800, cursor:"pointer",
        background: active ? "var(--sc-green)" : "var(--sc-raised)",
        color:      active ? "var(--sc-bg)"    : "var(--sc-dim)",
        border:     active ? "none"            : "1px solid var(--sc-border)",
        transition:"all 0.15s",
      }}>{label}</button>
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"var(--sc-surface)", border:"1px solid var(--sc-border)", borderRadius:16, padding:24, width:"100%", maxWidth:360, display:"flex", flexDirection:"column", gap:14 }}>

        <h3 style={{ fontSize:15, fontWeight:900, color:"var(--sc-white)", margin:0 }}>
          {isEdit ? "개인 일정 수정" : "개인 일정 추가"}
        </h3>

        {/* 고정/임시 탭 — 수정 시 잠금 */}
        <div style={{ display:"flex", gap:6 }}>
          {isEdit ? (
            <div style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:12, fontWeight:800, textAlign:"center",
              background:"var(--sc-raised)", color:"var(--sc-dim)", border:"1px solid var(--sc-border)" }}>
              {isRecurring ? "고정 일정" : "임시 일정"}
            </div>
          ) : (
            <>
              {tabBtn( isRecurring, "고정 일정", () => setIsRecurring(true))}
              {tabBtn(!isRecurring, "임시 일정", () => setIsRecurring(false))}
            </>
          )}
        </div>

        {/* 제목 */}
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)" }}>제목</label>
          <input style={inp} value={title} onChange={e=>setTitle(e.target.value)} placeholder="예) 수학 준비, 개인 약속" />
        </div>

        {/* 요일 (고정) or 날짜 (임시) */}
        {isRecurring ? (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)" }}>
              요일<span style={{ fontWeight:500, marginLeft:4 }}>{isEdit ? "(추가 선택 시 새 일정 생성)" : "(복수 선택 가능)"}</span>
            </label>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {DAYS.map(d => {
                const active = days.includes(d.key);
                return (
                  <button key={d.key} type="button"
                    onClick={(e) => { e.stopPropagation(); toggleDay(d.key); }}
                    style={{
                      width:38, height:34, borderRadius:8, fontSize:12, fontWeight:800,
                      cursor:"pointer", transition:"all 0.12s",
                      background: active ? "var(--sc-green)" : "var(--sc-raised)",
                      color:      active ? "var(--sc-bg)"    : "var(--sc-dim)",
                      border:     active ? "none"            : "1px solid var(--sc-border)",
                    }}>{d.label}</button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)" }}>날짜</label>
            <input type="date" style={inp} value={specDate} onChange={e=>setSpecDate(e.target.value)} />
          </div>
        )}

        {/* 색상 */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)" }}>색상</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["#00e875","#5badff","#c084fc","#fb923c","#fbbf24","#f472b6"].map(c=>(
              <button key={c} onClick={()=>setColor(c)}
                style={{ width:24, height:24, borderRadius:6, background:c, cursor:"pointer",
                  border: color===c ? "2.5px solid white" : "2px solid transparent",
                  outline: color===c ? `2px solid ${c}` : "none", transition:"all 0.12s" }} />
            ))}
          </div>
        </div>

        {/* 시간 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)" }}>시작</label>
            <input type="time" style={inp} value={start} onChange={e=>setStart(e.target.value)} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)" }}>종료</label>
            <input type="time" style={inp} value={end} onChange={e=>setEnd(e.target.value)} />
          </div>
        </div>

        {/* 태그 */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)" }}>태그</label>
          <div style={{ display:"flex", gap:6 }}>
            <input
              style={{ ...inp, flex:1 }}
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="태그 입력 후 Enter…"
            />
            <button type="button" onClick={addTag}
              style={{ padding:"8px 12px", borderRadius:8, fontSize:12, fontWeight:800, cursor:"pointer",
                background:"var(--sc-green)", color:"var(--sc-bg)", border:"none", flexShrink:0 }}>
              추가
            </button>
          </div>
          {tags.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {tags.map(t => (
                <span key={t} style={{
                  display:"flex", alignItems:"center", gap:4,
                  padding:"3px 8px", borderRadius:20, fontSize:11, fontWeight:700,
                  background:"var(--sc-raised)", border:"1px solid var(--sc-border)", color:"var(--sc-white)",
                }}>
                  #{t}
                  <button type="button" onClick={() => removeTag(t)}
                    style={{ fontSize:13, lineHeight:1, color:"var(--sc-dim)", cursor:"pointer",
                      background:"none", border:"none", padding:0 }}>×</button>
                </span>
              ))}
            </div>
          )}

          {/* 추천 태그 — 이미 선택된 것 제외 */}
          {suggestedTags && suggestedTags.filter(t => !tags.includes(t)).length > 0 && (
            <div>
              <p style={{ fontSize:10, fontWeight:600, color:"var(--sc-dim)", margin:"4px 0 5px" }}>추천</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {suggestedTags.filter(t => !tags.includes(t)).map(t => (
                  <button key={t} type="button" onClick={() => setTags(prev => [...prev, t])}
                    style={{
                      padding:"3px 8px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
                      background:"var(--sc-raised)", border:"1px solid var(--sc-border)",
                      color:"var(--sc-dim)",
                    }}>
                    +#{t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 메모 */}
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)" }}>메모</label>
          <textarea style={{ ...inp, resize:"none" } as React.CSSProperties} rows={2}
            value={notes} onChange={e=>setNotes(e.target.value)} placeholder="선택 입력" />
        </div>

        {/* 버튼 */}
        <div style={{ display:"flex", gap:8, marginTop:2 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:"9px 0", borderRadius:8, fontSize:13, fontWeight:800, cursor:"pointer", background:"var(--sc-raised)", color:"var(--sc-dim)", border:"1px solid var(--sc-border)" }}>
            취소
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            style={{ flex:1, padding:"9px 0", borderRadius:8, fontSize:13, fontWeight:800,
              cursor: saving||!title.trim() ? "not-allowed" : "pointer",
              background:"var(--sc-green)", color:"var(--sc-bg)", border:"none",
              opacity: saving||!title.trim() ? 0.5 : 1, transition:"opacity 0.15s" }}>
            {saving ? "저장 중…" : isEdit ? "수정 저장" : `저장${!isEdit && isRecurring && days.length > 1 ? ` (${days.length}개)` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 시간표 그리드 ──────────────────────────────────────────────
function ScheduleGrid({ blocks, isDark, nowPx, todayKey, onBlockClick, onCellClick, onTagClick, fluid }: {
  blocks:        ScheduleBlock[];
  isDark:        boolean;
  nowPx:         number | null;
  todayKey:      DayKey | null;
  onBlockClick:  (b: ScheduleBlock) => void;
  onCellClick?:  (day: DayKey, time: string) => void;
  onTagClick?:   (tag: string) => void;
  fluid?:        boolean;  // true: 컬럼이 컨테이너 너비를 채움 (세로 레이아웃)
}) {
  const COL_W     = 93;  // 88 * 1.057 ≈ 93 (약 5% 확대)
  const TOTAL_H   = TOTAL_HOURS * FIXED_PPH;
  const gridCols  = fluid
    ? `${TIME_COL_W}px repeat(${DAYS.length}, minmax(${COL_W}px, 1fr))`
    : `${TIME_COL_W}px repeat(${DAYS.length}, ${COL_W}px)`;
  const gridMinW  = TIME_COL_W + DAYS.length * COL_W;
  const HOUR_IDXS = Array.from({ length: TOTAL_HOURS+1 }, (_, i) => i);

  return (
    <div style={{ width: fluid ? "100%" : gridMinW }}>
      {/* 컬럼 헤더 — 페이지 스크롤 시 뷰포트 상단에 고정 */}
      <div style={{
        display:"grid", gridTemplateColumns:gridCols,
        position:"sticky", top:0, zIndex:10,
        width: fluid ? "100%" : gridMinW,
        background:"var(--sc-surface)",
        borderBottom:"1px solid var(--sc-border)",
        borderRadius:"12px 12px 0 0",
        backdropFilter:"blur(8px)",
      }}>
        <div />
        {DAYS.map(d => (
          <div key={d.key} style={{
            padding:"10px 4px", textAlign:"center",
            fontSize:12, fontWeight:800,
            color: d.key === todayKey ? "var(--sc-green)" : "var(--sc-dim)",
            borderLeft:"1px solid var(--sc-border)",
          }}>{d.label}요일</div>
        ))}
      </div>

      {/* 그리드 본문 */}
      <div style={{
        display:"grid", gridTemplateColumns:gridCols,
        background:"var(--sc-surface)", borderRadius:"0 0 12px 12px",
        overflow:"clip", width: fluid ? "100%" : gridMinW,
      }}>
        {/* 시간축 */}
        <div style={{ position:"relative", height:TOTAL_H, borderRight:"1px solid var(--sc-border)" }}>
          {HOUR_IDXS.map(i => (
            <div key={i} style={{
              position:"absolute", top:i*FIXED_PPH-1,
              width:"100%", paddingRight:8, textAlign:"right",
              fontSize:10, fontWeight:700, color:"var(--sc-dim)", lineHeight:1,
            }}>
              {String((BASE_HOUR+i)%24).padStart(2,"0")}:00
            </div>
          ))}
        </div>

        {/* 요일 컬럼 */}
        {DAYS.map(d => {
          const colBlocks = blocks.filter(b => b.day === d.key);
          return (
            <div key={d.key}
              style={{
                position:"relative", height:TOTAL_H, borderLeft:"1px solid var(--sc-border)",
                cursor: onCellClick ? "crosshair" : "default",
              }}
              onClick={onCellClick ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y    = e.clientY - rect.top;
                const mins = Math.round((y / FIXED_PPH) * 60 / 30) * 30; // 30분 단위
                const h    = Math.floor(mins / 60) + BASE_HOUR;
                const m    = mins % 60;
                const time = `${String(h % 24).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
                onCellClick(d.key, time);
              } : undefined}
            >
              {HOUR_IDXS.map(i => (
                <div key={i} style={{ position:"absolute", top:i*FIXED_PPH, left:0, right:0, height:1, background:"var(--sc-border)", opacity:0.45 }} />
              ))}

              {colBlocks.map(b => (
                <Block key={b.id} b={b} isDark={isDark}
                  nowPx={d.key === todayKey ? nowPx : null}
                  onClick={() => onBlockClick(b)}
                  onTagClick={onTagClick} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function MyScheduleClient({
  userRole, userName, userId,
  classSchedules=[], enrollments=[],
  personalSchedules: initialPersonal,
  readOnly=false,
}: Props) {
  const isDark      = useDarkMode();
  const nowPx       = useNowPx();
  const isWide      = useIsWideLayout();
  const sidebarZoom = useCounterZoom(1.0);
  const headerZoom  = useCounterZoom(0.8);
  const supabase    = useMemo(() => createClient(), []);

  const todayKey = DAY_TO_KEY[new Date().getDay()];

  const [weekOffset,   setWeekOffset]   = useState(0);
  const [personal,     setPersonal]     = useState<any[]>(initialPersonal);
  const [detailBlock,  setDetailBlock]  = useState<ScheduleBlock | null>(null);
  const [editBlock,    setEditBlock]    = useState<ScheduleBlock | null>(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [presetDay,    setPresetDay]    = useState<DayKey | undefined>();
  const [presetTime,   setPresetTime]   = useState<string | undefined>();
  const [presetDate,   setPresetDate]   = useState<string | undefined>();
  const [activeTags,   setActiveTags]   = useState<Set<string>>(new Set());

  // ── 현재 주 날짜 범위 ────────────────────────────────────
  const { weekDates } = useMemo(() => {
    const monday  = getMonday(weekOffset);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return { weekDates: dates };
  }, [weekOffset]);

  // weekDates 확정 후 함수 정의 — 클로저에서 weekDates 안전하게 참조
  function openAddWithPreset(day: DayKey, time: string) {
    setPresetDay(day);
    setPresetTime(time);
    const dayIdx = DAYS.findIndex(d => d.key === day);
    setPresetDate(dayIdx >= 0 ? weekDates[dayIdx] : undefined);
    setShowAdd(true);
  }

  // ── 블록 빌드 ─────────────────────────────────────────────
  const allBlocks = useMemo((): ScheduleBlock[] => {
    const result: ScheduleBlock[] = [];

    // 선생님: classroom_schedules (수업 + 상담)
    for (const s of classSchedules) {
      if (!s.day || !s.start_time || !s.end_time) continue;
      const isConsulting = !s.courses && !!s.consulting_student;
      result.push({
        id: s.id, day: s.day as DayKey,
        start_time: toHHMM(s.start_time), end_time: toHHMM(s.end_time),
        title: isConsulting
          ? (s.consulting_student ?? "상담")          // 상담: 제목 = 학생 이름
          : (s.courses?.subject ?? s.courses?.name ?? "수업"),
        subtitle:      s.classrooms?.name,
        color: isConsulting
          ? (s.consulting_teacher_color ?? "#f472b6") // 상담: 선생님 색 or 분홍
          : (s.courses?.accent_color ?? accentFor(s.courses?.name ?? s.id)),
        enrolledNames: s.courses?.enrolled_names ?? [],
        tags:          isConsulting ? ["상담"] : ["수업"],
        isPersonal:    false,
      });
    }

    // 학생: enrollments → courses → classroom_schedules
    for (const e of enrollments) {
      const course = e.courses; if (!course) continue;
      const accent = course.accent_color ?? accentFor(course.name ?? e.id);
      for (const cs of (course.classroom_schedules ?? [])) {
        if (!cs.day || !cs.start_time || !cs.end_time) continue;
        result.push({
          id: cs.id, day: cs.day as DayKey,
          start_time: toHHMM(cs.start_time), end_time: toHHMM(cs.end_time),
          title:    course.subject ?? course.name ?? "수업",
          subtitle: course.instructors?.name ? `${course.instructors.name}T` : undefined,
          color:    accent, tags: ["수업"], isPersonal: false,
        });
      }
    }

    // 개인 일정 — 반복(day) + 특정 날짜(specific_date) 모두 지원
    for (const p of personal) {
      if (!p.is_active || !p.start_time || !p.end_time) continue;

      // specific_date: 해당 주에 포함될 때만 표시
      if (p.specific_date) {
        const dayIdx = weekDates.indexOf(p.specific_date);
        if (dayIdx < 0 || dayIdx > 6) continue;
        const dayKey = DAYS[dayIdx]?.key;
        if (!dayKey) continue;
        result.push({
          id: p.id, day: dayKey,
          start_time: toHHMM(p.start_time), end_time: toHHMM(p.end_time),
          title: p.title ?? "개인 일정",
          color: p.color ?? "#888",
          notes: p.notes ?? undefined,
          tags:  (p.tags && p.tags.length > 0) ? p.tags : [],
          isPersonal: true, raw: p,
        });
        continue;
      }

      // 반복 일정(day)
      if (!p.day) continue;
      result.push({
        id: p.id, day: p.day as DayKey,
        start_time: toHHMM(p.start_time), end_time: toHHMM(p.end_time),
        title: p.title ?? "개인 일정",
        color: p.color ?? "#888",
        notes: p.notes ?? undefined,
        tags:  (p.tags && p.tags.length > 0) ? p.tags : [],
        isPersonal: true, raw: p,
      });
    }

    return result;
  }, [classSchedules, enrollments, personal, weekDates]);

  // ── 태그 목록 + 통계 계산 ─────────────────────────────────
  const { allTags, tagStats } = useMemo(() => {
    const tagSet = new Set<string>();
    // 블록별 분 계산
    const minsByTag: Record<string, number> = {};
    const daysByTag: Record<string, Set<string>> = {};

    for (const b of allBlocks) {
      const blockMins = timeToMin(b.end_time) - timeToMin(b.start_time);
      const bTags = (b.tags && b.tags.length > 0) ? b.tags : ["기타"];
      for (const t of bTags) {
        tagSet.add(t);
        minsByTag[t] = (minsByTag[t] ?? 0) + blockMins;
        if (!daysByTag[t]) daysByTag[t] = new Set();
        daysByTag[t].add(b.day);
      }
    }

    const stats: Record<string, { totalMins: number; avgMins: number }> = {};
    for (const t of Array.from(tagSet)) {
      const totalMins = minsByTag[t] ?? 0;
      const activeDays = daysByTag[t]?.size ?? 1;
      stats[t] = { totalMins, avgMins: Math.round(totalMins / activeDays) };
    }

    return { allTags: Array.from(tagSet), tagStats: stats };
  }, [allBlocks]);

  // 태그 필터 적용
  const filteredBlocks = useMemo(() => {
    if (activeTags.size === 0) return allBlocks;
    return allBlocks.filter(b => {
      const bTags = b.tags ?? [];
      return Array.from(activeTags).some(t =>
        t === "기타" ? bTags.length === 0 : bTags.includes(t)
      );
    });
  }, [allBlocks, activeTags]);

  // ── CRUD ──────────────────────────────────────────────────
  async function handleAdd(data: PersonalFormData) {
    if (data.isRecurring) {
      // 복수 요일이면 group_id로 묶음 처리
      const groupId = data.days.length > 1
        ? crypto.randomUUID()
        : undefined;
      const rows = data.days.map(d => ({
        profile_id: userId, title: data.title,
        day: d, start_time: data.start_time, end_time: data.end_time,
        color: data.color, notes: data.notes || null, tags: data.tags,
        is_active: true, ...(groupId ? { group_id: groupId } : {}),
      }));
      const { data: inserted, error } = await supabase
        .from("personal_schedules").insert(rows).select();
      if (!error && inserted) setPersonal(prev => [...prev, ...inserted]);
    } else {
      const { data: inserted, error } = await supabase
        .from("personal_schedules")
        .insert({ profile_id:userId, title:data.title, specific_date:data.specific_date,
          start_time:data.start_time, end_time:data.end_time,
          color:data.color, notes:data.notes||null, tags:data.tags, is_active:true })
        .select().single();
      if (!error && inserted) setPersonal(prev => [...prev, inserted]);
    }
    setShowAdd(false);
  }

  async function handleUpdate(data: PersonalFormData) {
    if (!editBlock) return;
    const groupId: string | null = editBlock.raw?.group_id ?? null;

    // 공통 패치 (day/specific_date 제외)
    const commonPatch = {
      title:      data.title,
      start_time: data.start_time,
      end_time:   data.end_time,
      color:      data.color,
      notes:      data.notes || null,
      tags:       data.tags,
    };

    if (groupId) {
      // 묶음 일정: 같은 group_id 전체 UPDATE (day는 각자 유지)
      const { data: updatedRows } = await supabase
        .from("personal_schedules")
        .update(commonPatch)
        .eq("group_id", groupId)
        .select();
      if (updatedRows) {
        setPersonal(prev => prev.map(p =>
          updatedRows.find((u: any) => u.id === p.id) ?? p
        ));
      }
    } else {
      // 단일 일정 UPDATE
      const singlePatch = data.isRecurring
        ? { ...commonPatch, day: data.days[0] }
        : { ...commonPatch, specific_date: data.specific_date };
      const { data: updated } = await supabase
        .from("personal_schedules").update(singlePatch).eq("id", editBlock.id).select().single();
      if (updated) setPersonal(prev => prev.map(p => p.id === editBlock.id ? updated : p));

      // 추가 요일 선택 시 새 묶음으로 묶기
      if (data.isRecurring && data.days.length > 1) {
        const newGroupId = crypto.randomUUID();
        // 현재 레코드에 group_id 부여
        await supabase.from("personal_schedules")
          .update({ group_id: newGroupId }).eq("id", editBlock.id);
        // 추가 요일 INSERT
        const extraRows = data.days.slice(1).map(d => ({
          profile_id: userId, title: data.title,
          day: d, start_time: data.start_time, end_time: data.end_time,
          color: data.color, notes: data.notes || null, tags: data.tags,
          is_active: true, group_id: newGroupId,
        }));
        const { data: inserted } = await supabase
          .from("personal_schedules").insert(extraRows).select();
        if (inserted) setPersonal(prev => [
          ...prev.map(p => p.id === editBlock.id ? { ...p, group_id: newGroupId } : p),
          ...inserted,
        ]);
      }
    }

    setEditBlock(null);
  }

  async function handleDelete(id: string, soft: boolean) {
    // 묶음 일정이면 그룹 전체 처리
    const target = personal.find(p => p.id === id);
    const groupId: string | null = target?.group_id ?? null;

    if (groupId) {
      if (soft) {
        const { data: updatedRows } = await supabase
          .from("personal_schedules")
          .update({ is_active: false })
          .eq("group_id", groupId)
          .select();
        if (updatedRows) setPersonal(prev => prev.map(p =>
          updatedRows.find((u: any) => u.id === p.id) ?? p
        ));
      } else {
        await supabase.from("personal_schedules").delete().eq("group_id", groupId);
        setPersonal(prev => prev.filter(p => p.group_id !== groupId));
      }
    } else {
      if (soft) {
        const { data: updated } = await supabase
          .from("personal_schedules").update({ is_active: false }).eq("id", id).select().single();
        if (updated) setPersonal(prev => prev.map(p => p.id === id ? updated : p));
      } else {
        await supabase.from("personal_schedules").delete().eq("id", id);
        setPersonal(prev => prev.filter(p => p.id !== id));
      }
    }
  }

  // ── 공통 UI 조각 ──────────────────────────────────────────
  const isTeacher = ["admin","manager","teacher"].includes(userRole);

  function NavLinks() {
    const ls: React.CSSProperties = { color:"var(--sc-dim)", opacity:0.6 };
    const on  = (e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity="1");
    const off = (e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity="0.6");
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"nowrap", gap:6, marginBottom: isWide ? 16 : 0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"nowrap", flexShrink:0 }}>
          <Link href="/portal" style={{ ...ls, display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:700, textDecoration:"none", transition:"opacity 0.15s" }}
            onMouseEnter={on} onMouseLeave={off}>
            <HomeIcon size={14}/> 홈
          </Link>
          <span style={{ color:"var(--sc-border)", fontSize:12 }}>·</span>
          <span style={{ ...ls, fontSize:12, fontWeight:700 }}>내 시간표</span>
        </div>
        <ThemeToggle />
      </div>
    );
  }

  const addBtn = !readOnly && (
    <button onClick={() => setShowAdd(true)}
      style={{
        display:"flex", alignItems:"center", gap:4,
        background:"var(--sc-green)", color:"var(--sc-bg)",
        border:"none", borderRadius:6, padding:"4px 10px",
        fontSize:11, fontWeight:800, cursor:"pointer", flexShrink:0,
      }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      개인 일정 추가
    </button>
  );

  // ── 태그 필터 + 통계 패널 ───────────────────────────────────
  // 숫자는 크고 얇게, 단위는 작고 가볍게
  function TimeNum({ mins, color = "var(--sc-white)" }: { mins: number; color?: string }) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return (
      <span style={{ display:"inline-flex", alignItems:"baseline", gap:1 }}>
        {h > 0 && (
          <>
            <span style={{ fontSize:22, fontWeight:200, color, lineHeight:1 }}>{h}</span>
            <span style={{ fontSize:12, fontWeight:300, color:"var(--sc-dim)", marginRight:5, letterSpacing:"0.12em" }}>h</span>
          </>
        )}
        {(m > 0 || h === 0) && (
          <>
            <span style={{ fontSize:22, fontWeight:200, color, lineHeight:1 }}>{m}</span>
            <span style={{ fontSize:12, fontWeight:300, color:"var(--sc-dim)", letterSpacing:"0.12em" }}>m</span>
          </>
        )}
      </span>
    );
  }

  // 누적 통계: filteredBlocks 전체 합산
  const cumulativeStats = useMemo(() => {
    const totalMins = filteredBlocks.reduce((acc, b) =>
      acc + timeToMin(b.end_time) - timeToMin(b.start_time), 0);
    const activeDays = new Set(filteredBlocks.map(b => b.day)).size;
    const avgMins = activeDays > 0 ? Math.round(totalMins / activeDays) : 0;
    return { totalMins, avgMins };
  }, [filteredBlocks]);

  const TagPanel = () => (
    <div style={{ marginTop:16 }}>
      <p style={{ fontSize:10, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase",
        color:"var(--sc-dim)", margin:"0 0 8px" }}>태그 필터</p>

      {/* 태그 버튼 — 다중 선택 */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
        <button type="button" onClick={() => setActiveTags(new Set())}
          style={{
            padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
            background: activeTags.size === 0 ? "var(--sc-green)" : "var(--sc-raised)",
            color:      activeTags.size === 0 ? "var(--sc-bg)"    : "var(--sc-dim)",
            border:     activeTags.size === 0 ? "none"            : "1px solid var(--sc-border)",
          }}>전체</button>
        {allTags.map(t => {
          const on = activeTags.has(t);
          return (
            <button key={t} type="button" onClick={() => setActiveTags(prev => {
              const next = new Set(prev);
              on ? next.delete(t) : next.add(t);
              return next;
            })}
              style={{
                padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
                background: on ? "var(--sc-green)" : "var(--sc-raised)",
                color:      on ? "var(--sc-bg)"    : "var(--sc-dim)",
                border:     on ? "none"            : "1px solid var(--sc-border)",
              }}>#{t}</button>
          );
        })}
      </div>

      {/* 누적 통계 카드 */}
      {filteredBlocks.length > 0 && (
        <div style={{
          padding:"10px 12px", borderRadius:10,
          background:"var(--sc-raised)", border:"1px solid var(--sc-border)",
        }}>
          <div style={{ display:"flex", gap:16, alignItems:"flex-end" }}>
            <div>
              <p style={{ fontSize:11, fontWeight:400, color:"var(--sc-dim)", margin:"0 0 3px" }}>
                주 합계
              </p>
              <TimeNum mins={cumulativeStats.totalMins} color="var(--sc-green)" />
            </div>
            <div>
              <p style={{ fontSize:11, fontWeight:400, color:"var(--sc-dim)", margin:"0 0 3px" }}>
                일 평균
              </p>
              <TimeNum mins={cumulativeStats.avgMins} />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const grid = (
    <ScheduleGrid
      blocks={filteredBlocks} isDark={isDark} nowPx={nowPx}
      todayKey={todayKey} onBlockClick={b => setDetailBlock(b)}
      onCellClick={!readOnly ? (day, time) => openAddWithPreset(day, time) : undefined}
      onTagClick={tag => setActiveTags(prev => {
        const next = new Set(prev);
        next.has(tag) ? next.delete(tag) : next.add(tag);
        return next;
      })}
      fluid={!isWide}  // 세로 레이아웃: 컨테이너 너비 채우기
    />
  );

  const modals = (
    <>
      {detailBlock && (
        <DetailModal
          block={detailBlock}
          onClose={() => setDetailBlock(null)}
          onEdit={b => { setDetailBlock(null); setEditBlock(b); }}
          onDelete={handleDelete}
        />
      )}
      {(showAdd || editBlock) && (
        <PersonalFormModal
          initial={editBlock ?? null}
          onClose={() => { setShowAdd(false); setEditBlock(null); setPresetDay(undefined); setPresetTime(undefined); setPresetDate(undefined); }}
          onSave={editBlock ? handleUpdate : handleAdd}
          presetDay={!editBlock ? presetDay : undefined}
          presetTime={!editBlock ? presetTime : undefined}
          presetDate={!editBlock ? presetDate : undefined}
          suggestedTags={allTags}
        />
      )}
    </>
  );

  // ── 가로 레이아웃 ─────────────────────────────────────────
  if (isWide) {
    return (
      <div style={{ display:"flex", alignItems:"flex-start", minHeight:"100vh", background:"var(--sc-bg)" }}>
        <div style={{
          width:260, flexShrink:0, position:"sticky", top:0,
          height:"100vh", overflowY:"auto",
          borderRight:"1px solid var(--sc-border)",
          background:"var(--sc-bg)", padding:"20px 18px",
          display:"flex", flexDirection:"column", gap:0,
          zoom: sidebarZoom,
        }}>
          <NavLinks />
          <p style={{ fontSize:10, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--sc-dim)", margin:"0 0 4px" }}>
            {isTeacher ? "Schedule" : "My Schedule"}
          </p>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"nowrap" }}>
            <h1 style={{ fontSize:18, fontWeight:900, color:"var(--sc-white)", margin:0, whiteSpace:"nowrap" }}>내 시간표</h1>
            <span style={{ fontSize:10, fontWeight:700, color:"var(--sc-dim)", background:"var(--sc-raised)", border:"1px solid var(--sc-border)", borderRadius:5, padding:"2px 6px", whiteSpace:"nowrap", flexShrink:0 }}>
              {userName}
            </span>
          </div>

          <div style={{ marginTop:14 }}>
            <WeekNav weekOffset={weekOffset} setWeekOffset={setWeekOffset} compact />
          </div>

          {!readOnly && (
            <button onClick={() => setShowAdd(true)}
              style={{ marginTop:14, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"var(--sc-green)", color:"var(--sc-bg)", border:"none", borderRadius:7, padding:"5px 0", fontSize:11, fontWeight:800, cursor:"pointer", width:"100%" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              개인 일정 추가
            </button>
          )}

          {/* 사이드바 태그 패널 */}
          <TagPanel />
        </div>

        {/* 그리드 — 자연 크기 유지, 세로는 페이지 스크롤 */}
        <div style={{ flexShrink:0, overflowX:"auto" }}>
          <div style={{ padding:"12px 20px 60px" }}>{grid}</div>
        </div>

        {modals}
      </div>
    );
  }

  // ── 세로 레이아웃 ─────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"var(--sc-bg)" }}>
      <div style={{ position:"sticky", top:0, zIndex:30, background:"var(--sc-bg)", borderBottom:"1px solid var(--sc-border)", backdropFilter:"blur(12px)" }}>
        <div style={{ zoom:headerZoom, padding:"14px 32px 10px" }}>
          <NavLinks />
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, flexWrap:"nowrap" }}>
            <p style={{ fontSize:10, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--sc-dim)", margin:0, whiteSpace:"nowrap" }}>
              {isTeacher ? "Schedule" : "My Schedule"}
            </p>
            <span style={{ color:"var(--sc-border)" }}>·</span>
            <h1 style={{ fontSize:20, fontWeight:900, color:"var(--sc-white)", margin:0, whiteSpace:"nowrap" }}>내 시간표</h1>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)", background:"var(--sc-raised)", border:"1px solid var(--sc-border)", borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap", flexShrink:0 }}>
              {userName} · {isTeacher ? "선생님" : "학생"}
            </span>
            <div style={{ flex:1 }} />
            {addBtn}
          </div>
          <WeekNav weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
        </div>
      </div>

      {/* 태그 필터 + 통계 — 세로 레이아웃 */}
      {allTags.length > 0 && (
        <div style={{ maxWidth:900, margin:"0 auto", padding:"12px 24px 0" }}>
          <TagPanel />
        </div>
      )}

      <div style={{ maxWidth:900, margin:"0 auto", overflowX:"auto", padding:"16px 24px 60px" }}>
        {grid}
      </div>

      {modals}
    </div>
  );
}
