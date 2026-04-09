"use client";

import { useState, useEffect, useRef } from "react";
import { DAYS, DayKey } from "./constants";

// ── 타입 ──────────────────────────────────────────────────────
type AddType    = "permanent" | "temporary";
type DeleteType = "permanent" | "temporary";
type TempScope  = "once" | "weeks";

export interface Course {
  id:              string;
  name:            string;       // auto-generated (fallback)
  subject?:        string;
  instructorName?: string;
  instructorColor?: string;
  enrolledNames?:  string[];
}

/** 블록 표시용 라벨 — subject 우선, 없으면 name */
function courseLabel(c: Course) {
  return c.subject || c.name || "수업";
}

interface CellInfo {
  classroomId:   string;
  classroomName: string;
  day:           string;
  time:          string;
  scheduleId?:   string;
  courseName?:   string;
  teacherName?:  string;
  startTime?:    string;
  endTime?:      string;
}

interface Props {
  cell:               CellInfo | null;
  courses:            Course[];
  preselectedCourse?: Course | null;
  onClose:            () => void;
  onSave:             (data: SaveData) => void;
}

export interface SaveData {
  cell:          CellInfo;
  action:        "add" | "delete";
  // 추가
  addType?:      AddType;
  selectedDays?: DayKey[];
  startTime?:    string;
  endTime?:      string;
  courseId?:     string;
  newCourseName?: string;
  // 삭제
  deleteType?:   DeleteType;
  // 임시 공통
  tempScope?:    TempScope;
  weeksCount?:   number;
}

const DAY_LABEL: Record<string, string> = {
  mon:"월", tue:"화", wed:"수", thu:"목", fri:"금", sat:"토", sun:"일",
};

function addHour(t: string) {
  const [h, m] = t.split(":").map(Number);
  const nh = Math.floor((h * 60 + m + 60) / 60) % 24;
  const nm = (h * 60 + m + 60) % 60;
  return `${String(nh).padStart(2,"0")}:${String(nm).padStart(2,"0")}`;
}

// ── 수업 검색 ─────────────────────────────────────────────────
function CourseSearchInput({ courses, value, onSelect }: {
  courses:  Course[];
  value:    Course | null;
  onSelect: (c: Course | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open,  setOpen]  = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const q = query.toLowerCase();
  const filtered = courses.filter((c) =>
    courseLabel(c).toLowerCase().includes(q) ||
    (c.instructorName ?? "").toLowerCase().includes(q)
  );

  // ── 선택된 상태 ───────────────────────────────────────────
  if (value) return (
    <div className="sc-input" style={{ padding: "10px 12px" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* 과목 */}
          <p className="text-sm font-bold truncate" style={{ color: "var(--sc-white)" }}>
            {courseLabel(value)}
          </p>
          {/* 선생님 + 학생 수 */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {value.instructorName && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--sc-dim)" }}>
                <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%",
                               background: value.instructorColor ?? "#888" }} />
                {value.instructorName}
              </span>
            )}
            {(value.enrolledNames?.length ?? 0) > 0 && (
              <span className="text-xs" style={{ color: "var(--sc-dim)" }}>
                · 학생 {value.enrolledNames!.length}명
              </span>
            )}
          </div>
          {/* 학생 이름 미리보기 */}
          {(value.enrolledNames?.length ?? 0) > 0 && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
              {value.enrolledNames!.slice(0, 5).join(", ")}
              {value.enrolledNames!.length > 5 && ` 외 ${value.enrolledNames!.length - 5}명`}
            </p>
          )}
        </div>
        <button onClick={() => { onSelect(null); setQuery(""); }}
                className="hover:opacity-60 flex-shrink-0" style={{ color: "var(--sc-dim)" }}>×</button>
      </div>
    </div>
  );

  // ── 검색 드롭다운 ─────────────────────────────────────────
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="과목명 또는 선생님 이름 검색..."
        className="sc-input text-sm w-full"
        style={{ padding: "10px 12px" }}
        autoFocus
      />
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: "var(--sc-surface)", border: "1px solid var(--sc-border)",
          borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          maxHeight: 260, overflowY: "auto",
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--sc-dim)" }}>
              {query ? "검색 결과 없음" : "수업 목록 없음"}
            </div>
          ) : filtered.map((c) => (
            <button key={c.id}
              onClick={() => { onSelect(c); setOpen(false); setQuery(""); }}
              className="w-full text-left"
              style={{ padding: "10px 14px", display: "block", borderBottom: "1px solid var(--sc-border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sc-raised)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* 과목명 */}
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--sc-white)", marginBottom: 3 }}>
                {courseLabel(c)}
              </p>
              {/* 선생님 + 학생 수 */}
              <div className="flex items-center gap-2 flex-wrap">
                {c.instructorName && (
                  <span className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--sc-dim)" }}>
                    <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%",
                                   background: c.instructorColor ?? "#888" }} />
                    {c.instructorName}
                  </span>
                )}
                {(c.enrolledNames?.length ?? 0) > 0 && (
                  <span style={{ fontSize: 11, color: "var(--sc-dim)" }}>
                    학생 {c.enrolledNames!.length}명
                  </span>
                )}
              </div>
              {/* 학생 이름 */}
              {(c.enrolledNames?.length ?? 0) > 0 && (
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                  {c.enrolledNames!.slice(0, 4).join(" · ")}
                  {c.enrolledNames!.length > 4 && ` 외 ${c.enrolledNames!.length - 4}명`}
                </p>
              )}
            </button>
          ))}

          {/* 수업 추가는 수업 관리에서 */}
          <a href="/manage/courses" target="_blank" rel="noreferrer"
            style={{
              display: "block", padding: "10px 14px", fontSize: 12, fontWeight: 600,
              color: "var(--sc-dim)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sc-raised)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >+ 수업 추가는 → 수업 관리 페이지에서</a>
        </div>
      )}
    </div>
  );
}

// ── 임시 범위 선택기 ──────────────────────────────────────────
function TempScopeSelector({ scope, setScope, weeks, setWeeks }: {
  scope: TempScope; setScope: (s: TempScope) => void;
  weeks: number;   setWeeks: (n: number) => void;
}) {
  return (
    <div className="p-4 rounded-xl animate-fade-up"
         style={{ background:"var(--sc-raised)", border:"1px solid var(--sc-border)", animationFillMode:"forwards" }}>
      <p className="text-[11px] font-bold uppercase tracking-widest mb-3"
         style={{ color:"var(--sc-dim)" }}>적용 기간</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {(["once","weeks"] as TempScope[]).map((s) => (
          <button key={s} onClick={() => setScope(s)}
            className="py-2 rounded-lg text-xs font-bold transition-all duration-200"
            style={{
              background: scope === s ? "var(--sc-green)"  : "var(--sc-surface)",
              color:      scope === s ? "var(--sc-bg)"     : "var(--sc-dim)",
              border:     `1px solid ${scope === s ? "var(--sc-green)" : "var(--sc-border)"}`,
            }}>
            {s === "once" ? "이번 주만" : "N주 동안"}
          </button>
        ))}
      </div>
      {scope === "weeks" && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setWeeks(Math.max(1, weeks - 1))}
            className="w-9 h-9 rounded-full text-lg font-black flex items-center justify-center
                       transition-all hover:scale-110 active:scale-95"
            style={{ background:"var(--sc-surface)", border:"1px solid var(--sc-border)", color:"var(--sc-white)" }}>−</button>
          <div className="text-center min-w-[60px]">
            <span className="text-3xl font-black" style={{ color:"var(--sc-green)" }}>{weeks}</span>
            <span className="text-sm ml-1" style={{ color:"var(--sc-dim)" }}>주</span>
          </div>
          <button onClick={() => setWeeks(Math.min(52, weeks + 1))}
            className="w-9 h-9 rounded-full text-lg font-black flex items-center justify-center
                       transition-all hover:scale-110 active:scale-95"
            style={{ background:"var(--sc-surface)", border:"1px solid var(--sc-border)", color:"var(--sc-white)" }}>+</button>
        </div>
      )}
    </div>
  );
}

// ── 메인 모달 ─────────────────────────────────────────────────
export default function EditModal({ cell, courses, preselectedCourse, onClose, onSave }: Props) {
  const isEdit = !!cell?.scheduleId;

  // 추가 상태
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedDays,   setSelectedDays]   = useState<DayKey[]>([]);
  const [startTime,      setStartTime]      = useState("14:00");
  const [endTime,        setEndTime]        = useState("15:00");
  const [addType,        setAddType]        = useState<AddType>("permanent");

  // 삭제 상태
  const [deleteType, setDeleteType] = useState<DeleteType>("temporary");

  // 임시 공통
  const [tempScope, setTempScope] = useState<TempScope>("once");
  const [weeks,     setWeeks]     = useState(2);

  // preselectedCourse가 들어오면 자동 선택
  useEffect(() => {
    if (preselectedCourse) {
      setSelectedCourse(preselectedCourse);
    }
  }, [preselectedCourse]);

  useEffect(() => {
    if (!cell) return;
    const st = cell.startTime ?? cell.time;
    setStartTime(st);
    setEndTime(cell.endTime ?? addHour(st));
    setSelectedDays([cell.day as DayKey]);
    setSelectedCourse(null);
    setAddType("permanent");
    setDeleteType("temporary");
    setTempScope("once");
    setWeeks(2);
  }, [cell]);

  if (!cell) return null;

  function toggleDay(d: DayKey) {
    setSelectedDays((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  }

  function submit(action: "add" | "delete") {
    const isTemp = action === "add" ? addType === "temporary" : deleteType === "temporary";
    onSave({
      cell:          cell!,
      action,
      addType:       action === "add"    ? addType    : undefined,
      deleteType:    action === "delete" ? deleteType : undefined,
      selectedDays:  action === "add"    ? selectedDays  : undefined,
      startTime:     action === "add"    ? startTime     : undefined,
      endTime:       action === "add"    ? endTime       : undefined,
      courseId:      action === "add"    ? selectedCourse?.id  : undefined,
      tempScope:     isTemp ? tempScope : undefined,
      weeksCount:    isTemp && tempScope === "weeks" ? weeks : undefined,
    });
  }

  const dayLabel = DAY_LABEL[cell.day] ?? cell.day;

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-40"
           style={{ background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)" }}
           onClick={onClose} />

      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in"
           style={{ background:"var(--sc-surface)", border:"1px solid var(--sc-border)",
                    animationFillMode:"forwards", maxHeight:"90vh", overflowY:"auto" }}>

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
               style={{ color:"var(--sc-dim)" }}>
              {cell.classroomName} · {dayLabel}요일
            </p>
            <h3 className="font-black text-lg" style={{ color:"var(--sc-white)" }}>
              {isEdit ? "일정 관리" : "일정 추가"}
            </h3>
            {isEdit && (
              <p className="text-sm mt-0.5" style={{ color:"var(--sc-dim)" }}>
                {cell.courseName ?? "수업"}
                {cell.teacherName ? ` · ${cell.teacherName}` : ""}
                {cell.startTime ? ` · ${cell.startTime}~${cell.endTime}` : ""}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-xl hover:opacity-60"
                  style={{ color:"var(--sc-dim)" }}>×</button>
        </div>

        {/* ── 추가 폼 ─────────────────────────────────────────── */}
        {!isEdit && (
          <div className="space-y-4 mb-5">
            {/* 수업 */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
                 style={{ color:"var(--sc-dim)" }}>수업</p>
              <CourseSearchInput
                courses={courses}
                value={selectedCourse}
                onSelect={setSelectedCourse}
              />
            </div>

            {/* 요일 */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
                 style={{ color:"var(--sc-dim)" }}>요일 (중복 가능)</p>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map(({ key, label }) => {
                  const on = selectedDays.includes(key);
                  return (
                    <button key={key} onClick={() => toggleDay(key)}
                      className="w-9 h-9 rounded-lg text-sm font-bold transition-all duration-150"
                      style={{
                        background: on ? "var(--sc-green)"  : "var(--sc-raised)",
                        color:      on ? "var(--sc-bg)"     : "var(--sc-dim)",
                        border:     `1px solid ${on ? "var(--sc-green)" : "var(--sc-border)"}`,
                        transform:  on ? "scale(1.08)" : "scale(1)",
                      }}>{label}</button>
                  );
                })}
              </div>
            </div>

            {/* 시간 */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
                 style={{ color:"var(--sc-dim)" }}>시간</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-[10px] mb-1" style={{ color:"var(--sc-dim)" }}>시작</p>
                  <input type="time" step="300" value={startTime}
                    onChange={(e) => { setStartTime(e.target.value); setEndTime(addHour(e.target.value)); }}
                    className="sc-input text-sm w-full" style={{ padding:"9px 10px" }} />
                </div>
                <span style={{ color:"var(--sc-dim)", marginTop:18 }}>→</span>
                <div className="flex-1">
                  <p className="text-[10px] mb-1" style={{ color:"var(--sc-dim)" }}>종료</p>
                  <input type="time" step="300" value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="sc-input text-sm w-full" style={{ padding:"9px 10px" }} />
                </div>
              </div>
            </div>

            {/* 추가 유형 */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
                 style={{ color:"var(--sc-dim)" }}>추가 유형</p>
              <div className="grid grid-cols-2 gap-2">
                {(["permanent","temporary"] as AddType[]).map((t) => (
                  <button key={t} onClick={() => setAddType(t)}
                    className="py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
                    style={{
                      background: addType === t ? "var(--sc-green)"  : "var(--sc-raised)",
                      color:      addType === t ? "var(--sc-bg)"     : "var(--sc-dim)",
                      border:     `1px solid ${addType === t ? "var(--sc-green)" : "var(--sc-border)"}`,
                      transform:  addType === t ? "scale(1.02)" : "scale(1)",
                    }}>
                    {t === "permanent" ? "🔒 고정 추가" : "⏱ 임시 추가"}
                  </button>
                ))}
              </div>
            </div>

            {/* 임시 추가 → 기간 */}
            {addType === "temporary" && (
              <TempScopeSelector scope={tempScope} setScope={setTempScope} weeks={weeks} setWeeks={setWeeks} />
            )}
          </div>
        )}

        {/* ── 삭제 폼 (기존 일정 클릭) ────────────────────────── */}
        {isEdit && (
          <div className="space-y-4 mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2"
                 style={{ color:"var(--sc-dim)" }}>삭제 유형</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { type:"temporary" as DeleteType, label:"⏱ 임시 삭제", sub:"이 기간만 취소" },
                  { type:"permanent" as DeleteType, label:"🗑 고정 삭제", sub:"오늘 이후 완전 삭제" },
                ]).map(({ type, label, sub }) => (
                  <button key={type} onClick={() => setDeleteType(type)}
                    className="py-3 rounded-xl text-sm font-bold transition-all duration-200 flex flex-col items-center gap-0.5"
                    style={{
                      background: deleteType === type
                        ? (type === "permanent" ? "rgba(239,68,68,0.15)" : "var(--sc-raised)")
                        : "var(--sc-raised)",
                      color:  deleteType === type
                        ? (type === "permanent" ? "#f87171" : "var(--sc-white)")
                        : "var(--sc-dim)",
                      border: `1px solid ${deleteType === type
                        ? (type === "permanent" ? "rgba(239,68,68,0.4)" : "var(--sc-green)")
                        : "var(--sc-border)"}`,
                      transform: deleteType === type ? "scale(1.02)" : "scale(1)",
                    }}>
                    {label}
                    <span style={{ fontSize:10, fontWeight:400, opacity:0.7 }}>{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 임시 삭제 → 기간 */}
            {deleteType === "temporary" && (
              <TempScopeSelector scope={tempScope} setScope={setTempScope} weeks={weeks} setWeeks={setWeeks} />
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose}
            className="py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background:"var(--sc-raised)", color:"var(--sc-dim)", border:"1px solid var(--sc-border)" }}>
            취소
          </button>
          <button onClick={() => submit(isEdit ? "delete" : "add")}
            className="py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{
              background: isEdit && deleteType === "permanent" ? "rgba(239,68,68,0.2)" : "var(--sc-green)",
              color:      isEdit && deleteType === "permanent" ? "#f87171" : "var(--sc-bg)",
              border:     isEdit && deleteType === "permanent" ? "1px solid rgba(239,68,68,0.4)" : "none",
            }}>
            {isEdit
              ? (deleteType === "permanent" ? "고정 삭제" : "임시 삭제")
              : "추가"}
          </button>
        </div>
      </div>
    </>
  );
}
