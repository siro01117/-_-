"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { DAYS, DayKey, CLASSROOM_ORDER } from "./constants";

// ── 레이아웃 상수 ─────────────────────────────────────────────
const BASE_HOUR    = 8;           // 08:00 기준
const TOTAL_HOURS  = 17;          // 08:00 ~ 01:00
const TIME_COL_W   = 52;
const MIN_BLOCK_H  = 16;
const FALLBACK_PPH = 56;          // SSR fallback

// 화면 높이에 맞춰 PX_PER_HOUR 동적 계산
// topOffset: 시간표 위쪽 차지 픽셀 (wide=탭행만, tall=헤더+탭행+여백)
function usePxPerHour(topOffset: number) {
  const [pph, setPph] = useState(FALLBACK_PPH);
  const calc = useCallback(() => {
    const available = window.innerHeight - topOffset;
    setPph(Math.max(28, Math.floor(available / TOTAL_HOURS)));
  }, [topOffset]);
  useLayoutEffect(() => {
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [calc]);
  return pph;
}

// ── 타입 ──────────────────────────────────────────────────────
interface Classroom { id: string; name: string; }

export interface ScheduleEntry {
  id:               string;
  classroom_id:     string;
  day:              DayKey;
  start_time:       string;   // "HH:MM" or "HH:MM:SS"
  end_time:         string;
  course_id?:       string;
  course_name?:     string;
  course_subject?:  string;   // 과목 (블록에 표시)
  teacher_name?:    string;
  teacher_color?:   string;   // 교사 색 (accent용)
  course_accent?:   string;   // 수업 강조 색
  enrolled_names?:  string[]; // 수강 학생 이름
  is_override?:     boolean;
}

export interface CellClickInfo {
  classroomId:   string;
  classroomName: string;
  day:           string;
  time:          string;
  scheduleId?:   string;
  courseId?:     string;
  courseName?:   string;
  teacherName?:  string;
  startTime?:    string;
  endTime?:      string;
}

interface Props {
  view:         "day" | "room";
  classrooms:   Classroom[];
  schedules:    ScheduleEntry[];
  selectedDay:  DayKey;
  selectedRoom: string;
  onDayChange:  (d: DayKey) => void;
  onRoomChange: (id: string) => void;
  onCellClick:  (info: CellClickInfo) => void;
  onViewChange: (v: "day" | "room") => void;
  isWide?:      boolean;   // 사이드바 레이아웃 여부
}

// ── 현재 시간 위치 계산 ────────────────────────────────────────
function useCurrentTimePx(pxPerHour: number): number | null {
  const [px, setPx] = useState<number | null>(null);
  const pxPerMin = pxPerHour / 60;

  const calcPx = useCallback(() => {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const inRange = (h >= BASE_HOUR) || (h === 0) || (h === 1 && m === 0);
    if (!inRange) { setPx(null); return; }
    if (h < BASE_HOUR) h += 24;
    const minutesFromBase = (h - BASE_HOUR) * 60 + m;
    if (minutesFromBase > TOTAL_HOURS * 60) { setPx(null); return; }
    setPx(minutesFromBase * pxPerMin);
  }, [pxPerMin]);

  useEffect(() => {
    calcPx();
    const id = setInterval(calcPx, 30_000);
    return () => clearInterval(id);
  }, [calcPx]);

  return px;
}

// ── 현재 시간 인디케이터 ──────────────────────────────────────
function NowIndicator({ top }: { top: number }) {
  return (
    <div
      className="pointer-events-none"
      style={{
        position:   "absolute",
        top,
        left:       0,
        right:      0,
        height:     1,
        zIndex:     15,
        background: "var(--sc-green)",
        opacity:    0.7,
      }}
    />
  );
}

// ── 유틸 ──────────────────────────────────────────────────────
function toHHMM(t: string): string { return t.slice(0, 5); }

function timeToMinutesFromBase(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (h < BASE_HOUR) h += 24;  // 자정 이후 처리
  return (h - BASE_HOUR) * 60 + m;
}

function indexToHour(i: number): number { return (BASE_HOUR + i) % 24; }
function hhmm(h: number, m = 0) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── 색상 결정 ─────────────────────────────────────────────────
// accent 색을 기준으로: 어두운 bg + 선명한 border accent
const FALLBACK_ACCENTS = [
  "#00e875","#5badff","#c084fc","#fb923c",
  "#fbbf24","#f472b6","#2dd4bf","#f87171",
];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num   = parseInt(clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function colorFor(entry: ScheduleEntry) {
  // 우선순위: course_accent → teacher_color → 해시 기반 fallback
  const accent = entry.course_accent ?? entry.teacher_color
    ?? (() => {
      const key  = entry.teacher_name ?? entry.course_name ?? entry.id;
      const hash = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      return FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length];
    })();

  const [r, g, b] = hexToRgb(accent);
  // 아주 어두운 배경: 원색 12% + 기본 어두운 베이스
  const bg = `rgb(${Math.round(r * 0.14 + 13)}, ${Math.round(g * 0.14 + 13)}, ${Math.round(b * 0.14 + 15)})`;
  return { bg, border: accent, text: "#ffffff" };
}

// ── 블록 컴포넌트 ─────────────────────────────────────────────
function ScheduleBlock({
  schedule,
  pxPerHour,
  onClick,
}: {
  schedule:  ScheduleEntry;
  pxPerHour: number;
  onClick:   () => void;
}) {
  const pxPerMin = pxPerHour / 60;
  const startMin = timeToMinutesFromBase(toHHMM(schedule.start_time));
  const endMin   = timeToMinutesFromBase(toHHMM(schedule.end_time));
  const top      = startMin * pxPerMin;
  const height   = Math.max((endMin - startMin) * pxPerMin, MIN_BLOCK_H);
  const color    = colorFor(schedule);
  const showName     = height > 18;
  const showTeacher  = height > 40;
  const showTime     = height > 30;
  const showStudents = height > 68;

  const names = schedule.enrolled_names ?? [];

  return (
    <div
      className="sched-block"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        position:     "absolute",
        top,
        height,
        left:         3,
        right:        3,
        background:   color.bg,
        borderLeft:   `3px solid ${color.border}`,
        borderRadius: 6,
        cursor:       "pointer",
        overflow:     "hidden",
        padding:      "4px 6px 4px 6px",
        userSelect:   "none",
        transition:   "filter 0.15s, transform 0.15s",
        zIndex:       2,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.filter    = "brightness(1.4)";
        e.currentTarget.style.transform = "scaleX(1.015)";
        e.currentTarget.style.zIndex    = "10";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter    = "";
        e.currentTarget.style.transform = "";
        e.currentTarget.style.zIndex    = "2";
      }}
    >
      {/* 임시 뱃지 */}
      {schedule.is_override && (
        <div style={{
          position:     "absolute",
          top:          3,
          right:        4,
          fontSize:     8,
          fontWeight:   800,
          color:        "#000",
          background:   color.border,
          borderRadius: 3,
          padding:      "1px 4px",
          opacity:      0.9,
        }}>임시</div>
      )}

      {/* 과목 (없으면 수업명 fallback) */}
      {showName && (
        <p style={{
          fontSize:     11,
          fontWeight:   800,
          color:        color.border,        // accent 색으로 과목명 강조
          marginTop:    0,
          lineHeight:   1.3,
          overflow:     "hidden",
          whiteSpace:   "nowrap",
          textOverflow: "ellipsis",
          paddingRight: schedule.is_override ? 24 : 0,
        }}>
          {schedule.course_subject ?? schedule.course_name ?? "수업"}
        </p>
      )}

      {/* 강사명 */}
      {showTeacher && schedule.teacher_name && (
        <p style={{
          fontSize:     10,
          color:        "rgba(255,255,255,0.82)",
          marginTop:    2,
          overflow:     "hidden",
          whiteSpace:   "nowrap",
          textOverflow: "ellipsis",
        }}>
          {schedule.teacher_name} T
        </p>
      )}

      {/* 수강 학생 이름 */}
      {showStudents && names.length > 0 && (
        <p style={{
          fontSize:     9,
          color:        "rgba(255,255,255,0.65)",
          marginTop:    2,
          overflow:     "hidden",
          whiteSpace:   "nowrap",
          textOverflow: "ellipsis",
          lineHeight:   1.4,
        }}>
          {names.slice(0, 4).join(" · ")}{names.length > 4 ? ` +${names.length - 4}` : ""}
        </p>
      )}

      {/* 시간 — 하단 */}
      {showTime && (
        <div style={{
          position:     "absolute",
          bottom:       3,
          left:         6,
          right:        5,
          fontSize:     9,
          fontWeight:   600,
          color:        "rgba(255,255,255,0.6)",
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
        }}>
          {toHHMM(schedule.start_time)} ~ {toHHMM(schedule.end_time)}
        </div>
      )}
    </div>
  );
}

// ── 탭 버튼 ───────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200"
      style={{
        background: active ? "var(--sc-green)"  : "var(--sc-raised)",
        color:      active ? "var(--sc-bg)"     : "var(--sc-dim)",
        border:     `1px solid ${active ? "var(--sc-green)" : "var(--sc-border)"}`,
        transform:  active ? "scale(1.04)" : "scale(1)",
      }}
    >
      {children}
    </button>
  );
}

// ── 메인 그리드 ───────────────────────────────────────────────
export default function ScheduleGrid({
  view, classrooms, schedules,
  selectedDay, selectedRoom,
  onDayChange, onRoomChange, onCellClick, onViewChange,
  isWide = false,
}: Props) {
  // wide: 탭행(52px) 만 제외, tall: 상단 헤더 전체 제외
  const pxPerHour   = usePxPerHour(isWide ? 60 : 300);
  const pxPerMin    = pxPerHour / 60;
  const TOTAL_HEIGHT = TOTAL_HOURS * pxPerHour;
  const HOUR_INDICES = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i);
  const nowPx       = useCurrentTimePx(pxPerHour);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  const sortedRooms = [...classrooms].sort((a, b) => {
    const ai = CLASSROOM_ORDER.indexOf(a.name);
    const bi = CLASSROOM_ORDER.indexOf(b.name);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const cols: { id: string; label: string }[] =
    view === "day"
      ? sortedRooms.map((r) => ({ id: r.id, label: r.name }))
      : DAYS.map((d) => ({ id: d.key, label: d.label + "요일" }));

  function getBlocksForCol(colId: string): ScheduleEntry[] {
    if (view === "day") {
      return schedules.filter((s) => s.classroom_id === colId && s.day === selectedDay);
    } else {
      const activeRoom = sortedRooms.find((r) => r.id === selectedRoom);
      return schedules.filter(
        (s) => s.classroom_id === (activeRoom?.id ?? "") && s.day === (colId as DayKey)
      );
    }
  }

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, colId: string) {
    if ((e.target as HTMLElement).closest(".sched-block")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromBase = Math.round(y / pxPerMin / 5) * 5;
    const clamped  = Math.min(Math.max(0, minutesFromBase), TOTAL_HOURS * 60 - 5);
    const totalMins = BASE_HOUR * 60 + clamped;
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const clickedTime = hhmm(h, m);

    if (view === "day") {
      const room = sortedRooms.find((r) => r.id === colId);
      onCellClick({ classroomId: colId, classroomName: room?.name ?? "", day: selectedDay, time: clickedTime });
    } else {
      const activeRoom = sortedRooms.find((r) => r.id === selectedRoom);
      onCellClick({ classroomId: activeRoom?.id ?? "", classroomName: activeRoom?.name ?? "", day: colId as DayKey, time: clickedTime });
    }
  }

  function handleBlockClick(s: ScheduleEntry, colId: string) {
    const base = {
      scheduleId:  s.id,
      courseId:    s.course_id,
      courseName:  s.course_subject ?? s.course_name,
      teacherName: s.teacher_name,
      startTime:   toHHMM(s.start_time),
      endTime:     toHHMM(s.end_time),
      time:        toHHMM(s.start_time),
    };
    if (view === "day") {
      const room = sortedRooms.find((r) => r.id === colId);
      onCellClick({ classroomId: colId, classroomName: room?.name ?? "", day: selectedDay, ...base });
    } else {
      const activeRoom = sortedRooms.find((r) => r.id === selectedRoom);
      onCellClick({ classroomId: activeRoom?.id ?? "", classroomName: activeRoom?.name ?? "", day: colId as DayKey, ...base });
    }
  }

  const gridCols = `${TIME_COL_W}px repeat(${cols.length}, 1fr)`;

  return (
    <div>
      {/* 탭 행 + 뷰 토글 (오른쪽) */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {view === "day"
            ? DAYS.map(({ key, label }) => (
                <TabBtn key={key} active={selectedDay === key} onClick={() => onDayChange(key)}>
                  {label}
                </TabBtn>
              ))
            : sortedRooms.map((room) => (
                <TabBtn key={room.id} active={selectedRoom === room.id} onClick={() => onRoomChange(room.id)}>
                  {room.name}
                </TabBtn>
              ))}
        </div>

        {/* 요일별/교실별 토글 — 오른쪽 */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl flex-shrink-0"
             style={{ background: "var(--sc-surface)", border: "1px solid var(--sc-border)" }}>
          {(["day", "room"] as const).map((v) => (
            <button key={v} onClick={() => onViewChange(v)}
              className="px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200"
              style={{
                background: view === v ? "var(--sc-green)"  : "transparent",
                color:      view === v ? "var(--sc-bg)"     : "var(--sc-dim)",
                border:     "none",
              }}>
              {v === "day" ? "요일별" : "교실별"}
            </button>
          ))}
        </div>
      </div>

      {/* 그리드 박스 */}
      <div
        className="rounded-2xl sc-timetable-scroll"
        style={{
          border:     "1px solid var(--sc-border)",
          background: "var(--sc-surface)",
          overflowY:  "auto",
          maxHeight:  isWide ? "calc(100vh - 60px)" : "calc(100vh - 260px)",
        }}
      >
        {/* 컬럼 헤더 (sticky) */}
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: gridCols,
            position:            "sticky",
            top:                 0,
            zIndex:              20,
            background:          "var(--sc-raised)",
            borderBottom:        "1px solid var(--sc-border)",
          }}
        >
          {/* 시간열 헤더 여백 */}
          <div style={{ height: 36 }} />
          {cols.map((col) => (
            <div
              key={col.id}
              style={{
                textAlign:     "center",
                padding:       "8px 4px",
                fontSize:      11,
                fontWeight:    700,
                letterSpacing: "0.04em",
                color:         hoveredCol === col.id ? "var(--sc-white)" : "var(--sc-dim)",
                borderLeft:    "1px solid var(--sc-border)",
                background:    hoveredCol === col.id
                  ? "rgba(0,255,133,0.06)"
                  : "transparent",
                transition:    "color 0.15s, background 0.15s",
              }}
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* 타임 그리드 */}
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: gridCols,
            height:              TOTAL_HEIGHT,
          }}
        >
          {/* 시간 레이블 컬럼 */}
          <div style={{ position: "relative", borderRight: "1px solid var(--sc-border)" }}>
            {HOUR_INDICES.map((i) => (
              <div
                key={i}
                style={{
                  position:   "absolute",
                  /* 08:00 레이블이 잘리지 않도록 첫 번째만 양수 offset */
                  top:        i === 0 ? 4 : i * pxPerHour - 8,
                  right:      6,
                  left:       0,
                  textAlign:  "right",
                  fontSize:   10,
                  fontWeight: 600,
                  color:      "var(--sc-dim)",
                  userSelect: "none",
                }}
              >
                {hhmm(indexToHour(i))}
              </div>
            ))}

            {/* 현재 시간 레이블 */}
            {nowPx !== null && (
              <div
                className="pointer-events-none"
                style={{
                  position:   "absolute",
                  top:        nowPx - 8,
                  right:      6,
                  left:       0,
                  textAlign:  "right",
                  fontSize:   10,
                  fontWeight: 800,
                  color:      "var(--sc-green)",
                  userSelect: "none",
                  zIndex:     16,
                }}
              >
                {(() => {
                  const now = new Date();
                  return `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
                })()}
              </div>
            )}
          </div>

          {/* 데이터 컬럼들 */}
          {cols.map((col) => {
            const blocks = getBlocksForCol(col.id);
            const isHovered = hoveredCol === col.id;
            return (
              <div
                key={col.id}
                style={{
                  position:   "relative",
                  borderLeft: "1px solid var(--sc-border)",
                  cursor:     "crosshair",
                  background: isHovered ? "rgba(0,255,133,0.025)" : "transparent",
                  transition: "background 0.15s",
                }}
                onClick={(e) => handleColumnClick(e, col.id)}
                onMouseEnter={() => setHoveredCol(col.id)}
                onMouseLeave={() => setHoveredCol(null)}
              >
                {/* 시간 구분선 */}
                {HOUR_INDICES.map((i) => (
                  <div key={i}>
                    <div style={{
                      position:   "absolute",
                      top:        i * pxPerHour,
                      left:       0,
                      right:      0,
                      height:     1,
                      background: "var(--sc-border)",
                    }} />
                    {i < TOTAL_HOURS && (
                      <div style={{
                        position:   "absolute",
                        top:        i * pxPerHour + pxPerHour / 2,
                        left:       0,
                        right:      0,
                        height:     1,
                        background: "var(--sc-border)",
                        opacity:    0.3,
                      }} />
                    )}
                  </div>
                ))}

                {/* 일정 블록들 */}
                {blocks.map((s) => (
                  <ScheduleBlock
                    key={s.id}
                    schedule={s}
                    pxPerHour={pxPerHour}
                    onClick={() => handleBlockClick(s, col.id)}
                  />
                ))}

                {/* 현재 시간 인디케이터 */}
                {nowPx !== null && <NowIndicator top={nowPx} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
