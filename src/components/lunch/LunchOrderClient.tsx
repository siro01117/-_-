"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { HomeIcon, BellIcon, LockIcon, AlertIcon, CheckIcon } from "@/components/ui/Icons";
import { saveLunchOrder } from "@/app/student/lunch/actions";

// ── 타입 ──────────────────────────────────────────────────────
interface LunchSettings {
  lunch_price:          number;
  dinner_price:         number;
  order_deadline_days:  number;
  cancel_deadline_days: number;
  available_days:       string[];
  blocked_dates:        string[];
  lunch_vendor:         string;
  dinner_vendor:        string;
  notes:                string | null;
  is_open:              boolean;
}
interface MonthData {
  year:     number;
  month:    number;
  settings: LunchSettings;
  order:    any | null;
}

const DAYS     = ["월","화","수","목","금","토"] as const;
const DAY_KEYS = ["mon","tue","wed","thu","fri","sat"] as const;
const KR_MONTH = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

// ── 유틸 ──────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getWeeks(year: number, month: number) {
  const weeks: (Date | null)[][] = [];
  const first = new Date(year, month - 1, 1);
  const last  = new Date(year, month, 0);
  // 첫 주 월요일 찾기
  const startMon = new Date(first);
  const dow = (first.getDay() + 6) % 7;
  startMon.setDate(first.getDate() - dow);

  let cur = new Date(startMon);
  while (cur <= last) {
    const week: (Date | null)[] = [];
    for (let d = 0; d < 6; d++) {
      const date = new Date(cur); date.setDate(cur.getDate() + d);
      week.push(date.getMonth() + 1 === month ? date : null);
    }
    weeks.push(week);
    cur.setDate(cur.getDate() + 7);
    if (cur > last) break;
  }
  return weeks;
}

function diffDays(dateStr: string) {
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  const today  = new Date();        today.setHours(0,0,0,0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

// ── 셀 상태 계산 ──────────────────────────────────────────────
type CellState = "unavailable" | "blocked" | "past" | "order-closed" | "cancel-locked" | "free";

function getCellState(dateStr: string, s: LunchSettings): CellState {
  const diff = diffDays(dateStr);
  if (diff < 0) return "past";
  const dow = DAY_KEYS[(new Date(dateStr).getDay() + 6) % 7 % 6];
  if (!s.available_days.includes(DAY_KEYS[(new Date(dateStr).getDay() + 6) % 7])) return "unavailable";
  if ((s.blocked_dates as string[]).includes(dateStr)) return "blocked";
  return "free";
}

function canOrder(dateStr: string, s: LunchSettings, alreadyOrdered: boolean) {
  const diff = diffDays(dateStr);
  if (alreadyOrdered) return diff >= s.cancel_deadline_days; // 취소 가능 여부
  return diff > s.order_deadline_days; // 신규 신청 가능 여부
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function LunchOrderClient({ studentId, userName, months }: {
  studentId: string | null;
  userName:  string;
  months:    MonthData[];
}) {
  const [tabIdx,   setTabIdx]   = useState(0);
  const [pending,  startTrans]  = useTransition();
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const md = months[tabIdx];
  const s  = md.settings;

  // 선택 상태 초기화
  const [lunchSel,      setLunchSel]      = useState<Set<string>>(() => new Set(md.order?.lunch_dates ?? []));
  const [dinnerSel,     setDinnerSel]     = useState<Set<string>>(() => new Set(md.order?.dinner_dates ?? []));
  // DB에 저장된 날짜 (취소 마감 제한 기준)
  const [savedLunch,    setSavedLunch]    = useState<Set<string>>(() => new Set(md.order?.lunch_dates ?? []));
  const [savedDinner,   setSavedDinner]   = useState<Set<string>>(() => new Set(md.order?.dinner_dates ?? []));
  const [isDirty,       setIsDirty]       = useState(false);
  const [seatNo,        setSeatNo]        = useState<string>(md.order?.seat_no ?? "");

  // 탭 전환 시 상태 리셋
  function switchTab(idx: number) {
    setTabIdx(idx);
    const od = months[idx].order;
    const sl = new Set<string>(od?.lunch_dates ?? []);
    const sd = new Set<string>(od?.dinner_dates ?? []);
    setLunchSel(new Set(sl)); setDinnerSel(new Set(sd));
    setSavedLunch(sl);        setSavedDinner(sd);
    setSeatNo(od?.seat_no ?? "");
    setIsDirty(false);
    setError(""); setSuccess("");
  }

  const weeks = useMemo(() => getWeeks(md.year, md.month), [md.year, md.month]);

  function toggle(dateStr: string, type: "lunch" | "dinner") {
    if (!studentId) return;
    const sel     = type === "lunch" ? lunchSel    : dinnerSel;
    const saved   = type === "lunch" ? savedLunch  : savedDinner;
    const setSel  = type === "lunch" ? setLunchSel : setDinnerSel;
    const selected = sel.has(dateStr);
    // 이미 선택된 항목 취소: DB 저장된 것만 취소 마감 체크
    if (selected && saved.has(dateStr) && !canOrder(dateStr, s, true)) return;
    // 새 신청: 신청 마감 체크
    if (!selected && !canOrder(dateStr, s, false)) return;
    setSel(prev => { const n = new Set(prev); selected ? n.delete(dateStr) : n.add(dateStr); return n; });
    setIsDirty(true);
    setSuccess("");
  }

  // 합계 계산
  const lunchCount  = lunchSel.size;
  const dinnerCount = dinnerSel.size;
  const total       = lunchCount * s.lunch_price + dinnerCount * s.dinner_price;

  function handleSave() {
    if (!studentId) return;
    setError(""); setSuccess("");
    startTrans(async () => {
      try {
        await saveLunchOrder({
          year:        md.year,
          month:       md.month,
          lunchDates:  Array.from(lunchSel),
          dinnerDates: Array.from(dinnerSel),
          seatNo,
        });
        // 저장 완료 → saved 기준 업데이트
        setSavedLunch(new Set(lunchSel));
        setSavedDinner(new Set(dinnerSel));
        setIsDirty(false);
        setSuccess("저장됐습니다.");
      } catch (e: any) { setError(e.message); }
    });
  }

  const today = new Date(); today.setHours(0,0,0,0);

  return (
    <div style={{ minHeight:"100vh", background:"var(--sc-bg)" }}>
      {/* 헤더 */}
      <header style={{
        position:"sticky", top:0, zIndex:20,
        background:"var(--sc-surface)", borderBottom:"1px solid var(--sc-border)",
        padding:"0 24px", height:52, display:"flex", alignItems:"center", gap:12,
      }}>
        <Link href="/portal" style={{ display:"flex", alignItems:"center", gap:5,
          color:"var(--sc-dim)", fontSize:13, fontWeight:700, textDecoration:"none" }}>
          <HomeIcon /> 홈
        </Link>
        <span style={{ color:"var(--sc-border)" }}>·</span>
        <span style={{ color:"var(--sc-white)", fontSize:14, fontWeight:900 }}>도시락 신청</span>
        <div style={{ flex:1 }} />
        <ThemeToggle />
      </header>

      <main style={{ maxWidth:720, margin:"0 auto", padding:"24px 20px 60px" }}>
        {!studentId && (
          <div style={{ padding:"24px", borderRadius:14, background:"rgba(239,68,68,0.08)",
            border:"1px solid rgba(239,68,68,0.3)", marginBottom:20, fontSize:13, color:"#f87171" }}>
            학생 정보가 없습니다. 관리자에게 등록을 요청해 주세요.
          </div>
        )}

        {/* 공지사항 */}
        {s.notes && (
          <div style={{ padding:"12px 16px", borderRadius:12, background:"rgba(0,232,117,0.07)",
            border:"1px solid rgba(0,232,117,0.25)", marginBottom:20, fontSize:12,
            color:"var(--sc-dim)", whiteSpace:"pre-wrap" }}>
            <><BellIcon size={11}/> {s.notes}</>
          </div>
        )}

        {/* 월 탭 */}
        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
          {months.map((m, i) => (
            <button key={i} type="button" onClick={() => switchTab(i)}
              style={{
                padding:"6px 18px", borderRadius:20, fontSize:13, fontWeight:800, cursor:"pointer",
                background: tabIdx === i ? "var(--sc-green)" : "var(--sc-raised)",
                color:      tabIdx === i ? "var(--sc-bg)"    : "var(--sc-dim)",
                border:     tabIdx === i ? "none"            : "1px solid var(--sc-border)",
              }}>
              {m.year}년 {KR_MONTH[m.month - 1]}
            </button>
          ))}
        </div>

        {/* 신청 닫힘 안내 */}
        {!s.is_open && (
          <div style={{ padding:"16px", borderRadius:12, background:"rgba(239,68,68,0.08)",
            border:"1px solid rgba(239,68,68,0.25)", marginBottom:20, fontSize:13, color:"#f87171", fontWeight:700 }}>
            <><LockIcon size={13}/> 현재 {KR_MONTH[md.month-1]} 도시락 신청이 닫혀 있습니다.</>
          </div>
        )}

        {/* 규정 */}
        <div style={{ marginBottom:20, fontSize:11, color:"var(--sc-dim)", lineHeight:1.8 }}>
          <span style={{ fontWeight:700, color:"var(--sc-white)" }}>규정 </span>
          · 신청 마감: 해당일 <strong style={{ color:"var(--sc-green)" }}>{s.order_deadline_days}일 전</strong>까지
          · 취소 마감: 해당일 <strong style={{ color:"#fbbf24" }}>{s.cancel_deadline_days}일 전</strong>까지
          · 당일 신청/취소 불가 · 선불제 · 환불 불가
        </div>

        {/* 캘린더 */}
        <div style={{ borderRadius:14, overflow:"hidden", border:"1px solid var(--sc-border)",
          marginBottom:24, background:"var(--sc-surface)" }}>

          {/* 헤더 행 */}
          <div style={{ display:"grid", gridTemplateColumns:"80px repeat(6, 1fr)",
            borderBottom:"1px solid var(--sc-border)" }}>
            <div style={{ padding:"10px 8px", fontSize:11, fontWeight:800,
              color:"var(--sc-dim)", textAlign:"center" }}>주차</div>
            {DAYS.map((d, i) => (
              <div key={d} style={{
                padding:"10px 4px", fontSize:12, fontWeight:800, textAlign:"center",
                color: d === "토" ? "#f87171" : "var(--sc-dim)",
                borderLeft:"1px solid var(--sc-border)",
              }}>{d}</div>
            ))}
          </div>

          {/* 주차별 행 */}
          {weeks.map((week, wi) => {
            const hasAny = week.some(d => d !== null);
            if (!hasAny) return null;
            return (
              <div key={wi} style={{ borderBottom:"1px solid var(--sc-border)" }}>
                {/* 날짜 행 */}
                <div style={{ display:"grid", gridTemplateColumns:"80px repeat(6, 1fr)" }}>
                  <div style={{ padding:"8px 6px", fontSize:11, fontWeight:800,
                    color:"var(--sc-dim)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {wi + 1}주차
                  </div>
                  {week.map((date, di) => {
                    if (!date) return (
                      <div key={di} style={{ borderLeft:"1px solid var(--sc-border)",
                        background:"var(--sc-raised)", position:"relative" }}>
                        {/* 빈 날짜 대각선 */}
                        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.2 }}>
                          <line x1="0" y1="0" x2="100%" y2="100%" stroke="var(--sc-dim)" strokeWidth="1"/>
                        </svg>
                      </div>
                    );
                    const ds      = toDateStr(date);
                    const diff    = diffDays(ds);
                    const dayKey  = DAY_KEYS[(date.getDay() + 6) % 7];
                    const isSat   = di === 5;
                    const blocked = (s.blocked_dates as string[]).includes(ds);
                    const isPast  = diff < 0;
                    // 점심: 토요일도 허용 (available_days에 sat 없어도 OK)
                    const lunchAvail  = isSat ? true : s.available_days.includes(dayKey);
                    // 저녁: 토요일 항상 차단
                    const dinnerAvail = isSat ? false : s.available_days.includes(dayKey);
                    // 셀 전체 비활성 여부
                    const baseDisabled = blocked || isPast || !s.is_open || !studentId;
                    // 셀 배경: 점심/저녁 모두 불가일 때만 회색
                    const fullyBlocked = blocked || (!lunchAvail && !dinnerAvail);

                    return (
                      <div key={di} style={{
                        borderLeft:"1px solid var(--sc-border)",
                        padding:"6px 4px", textAlign:"center",
                        background: fullyBlocked ? "var(--sc-raised)" : "transparent",
                        position:"relative",
                        minHeight:72,
                      }}>
                        {/* 대각선 — 완전 차단된 날만 */}
                        {fullyBlocked && (
                          <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.15, pointerEvents:"none" }}>
                            <line x1="0" y1="0" x2="100%" y2="100%" stroke="var(--sc-dim)" strokeWidth="1.5"/>
                          </svg>
                        )}

                        {/* 날짜 숫자 */}
                        <div style={{
                          fontSize:12, fontWeight:800, marginBottom:4,
                          color: isPast ? "var(--sc-border)" : isSat ? "#f87171" : fullyBlocked ? "var(--sc-dim)" : "var(--sc-white)",
                        }}>
                          {date.getDate()}
                        </div>

                        {/* 점심 — 토요일도 가능 */}
                        <LunchCell
                          checked={lunchSel.has(ds)}
                          label="점심"
                          color="#5badff"
                          disabled={!lunchAvail || baseDisabled || (
                            lunchSel.has(ds)
                              ? savedLunch.has(ds) && diff < s.cancel_deadline_days
                              : diff <= s.order_deadline_days
                          )}
                          locked={lunchSel.has(ds) && savedLunch.has(ds) && diff < s.cancel_deadline_days && diff >= 0}
                          onClick={() => toggle(ds, "lunch")}
                        />
                        {/* 저녁 — 토요일 차단, 나머지 가용 여부에 따라 */}
                        {!dinnerAvail ? (
                          <div style={{ height:28, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <svg style={{ opacity:0.12, width:"60%", height:"100%" }}>
                              <line x1="0" y1="0" x2="100%" y2="100%" stroke="var(--sc-dim)" strokeWidth="1"/>
                            </svg>
                          </div>
                        ) : (
                          <LunchCell
                            checked={dinnerSel.has(ds)}
                            label="저녁"
                            color="#c084fc"
                            disabled={baseDisabled || (
                              dinnerSel.has(ds)
                                ? savedDinner.has(ds) && diff < s.cancel_deadline_days
                                : diff <= s.order_deadline_days
                            )}
                            locked={dinnerSel.has(ds) && savedDinner.has(ds) && diff < s.cancel_deadline_days && diff >= 0}
                            onClick={() => toggle(ds, "dinner")}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        <div style={{ display:"flex", gap:16, marginBottom:20, flexWrap:"wrap" }}>
          {[
            { color:"#5badff", label:`점심 (${s.lunch_vendor} ${s.lunch_price.toLocaleString()}원)` },
            { color:"#c084fc", label:`저녁 (${s.dinner_vendor} ${s.dinner_price.toLocaleString()}원)` },
          ].map(({ color, label }) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--sc-dim)" }}>
              <div style={{ width:10, height:10, borderRadius:3, background:color }} />
              {label}
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--sc-dim)" }}>
            <LockIcon size={11} />
            취소 불가 (7일 이내)
          </div>
        </div>

        {/* 합계 + 좌석번호 */}
        <div style={{ padding:"16px 20px", borderRadius:14,
          background:"var(--sc-surface)", border:"1px solid var(--sc-border)", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div style={{ display:"flex", gap:20 }}>
              <div>
                <p style={{ fontSize:10, color:"var(--sc-dim)", margin:"0 0 2px" }}>점심</p>
                <p style={{ fontSize:18, fontWeight:900, color:"#5badff", margin:0 }}>{lunchCount}일</p>
              </div>
              <div>
                <p style={{ fontSize:10, color:"var(--sc-dim)", margin:"0 0 2px" }}>저녁</p>
                <p style={{ fontSize:18, fontWeight:900, color:"#c084fc", margin:0 }}>{dinnerCount}일</p>
              </div>
              <div>
                <p style={{ fontSize:10, color:"var(--sc-dim)", margin:"0 0 2px" }}>예상 금액</p>
                <p style={{ fontSize:18, fontWeight:900, color:"var(--sc-white)", margin:0 }}>
                  {total.toLocaleString()}원
                </p>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
              <p style={{ fontSize:10, color:"var(--sc-dim)", margin:0 }}>신청자</p>
              <p style={{ fontSize:14, fontWeight:800, color:"var(--sc-white)", margin:0 }}>{userName}</p>
            </div>
          </div>
        </div>

        {/* 에러/성공 */}
        {error   && <p style={{ color:"#f87171", fontSize:12, marginBottom:8, fontWeight:600 }}>{error}</p>}
        {success && <p style={{ color:"var(--sc-green)", fontSize:12, marginBottom:8, fontWeight:600 }}>{success}</p>}

        {/* 저장 버튼 */}
        <button type="button" onClick={handleSave}
          disabled={pending || !isDirty || !studentId || !s.is_open}
          style={{
            width:"100%", padding:"13px 0", borderRadius:12, fontSize:14, fontWeight:900,
            background: (!isDirty || !studentId || !s.is_open) ? "var(--sc-raised)" : "var(--sc-green)",
            color:      (!isDirty || !studentId || !s.is_open) ? "var(--sc-dim)"    : "var(--sc-bg)",
            border:"none", cursor: (!isDirty || !studentId || !s.is_open) ? "not-allowed" : "pointer",
            opacity: pending ? 0.6 : 1, transition:"all 0.15s",
          }}>
          {pending ? "저장 중…" : isDirty ? "신청 저장" : "변경 사항 없음"}
        </button>
        <p style={{ textAlign:"center", fontSize:11, color:"var(--sc-dim)", marginTop:8 }}>
          결제는 카운터에서 진행됩니다.
        </p>
      </main>
    </div>
  );
}

// ── 셀 버튼 ──────────────────────────────────────────────────
function LunchCell({ checked, label, color, disabled, locked, onClick }: {
  checked: boolean; label: string; color: string;
  disabled: boolean; locked: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:3,
        width:"100%", height:26, marginBottom:3,
        padding:"0 2px", borderRadius:5, fontSize:9, fontWeight:700,
        cursor: disabled ? "default" : "pointer",
        background: checked ? color + "33" : "transparent",
        color:      checked ? color       : "var(--sc-border)",
        border:     `1px solid ${checked ? color + "66" : "var(--sc-border)"}`,
        opacity:    disabled && !checked ? 0.3 : 1,
        transition: "background 0.12s, color 0.12s, border-color 0.12s",
        flexShrink:0,
      }}>
      {/* 고정 너비 아이콘 영역 — 크기 변화 방지 */}
      <span style={{ width:9, height:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        {locked ? <LockIcon size={8}/> : checked ? <CheckIcon size={8}/> : null}
      </span>
      {label}
    </button>
  );
}
