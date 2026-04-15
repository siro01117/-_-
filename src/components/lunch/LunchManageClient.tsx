"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { HomeIcon, ClipboardIcon, CheckIcon } from "@/components/ui/Icons";
import { updatePaymentStatus, updatePaidAmount, saveAdjustments, deleteLunchOrder, saveLunchSettings } from "@/app/student/lunch/actions";

// ── 타입 ──────────────────────────────────────────────────────
interface Order {
  id:           string;
  lunch_dates:  string[];
  dinner_dates: string[];
  seat_no?:     string;
  is_paid:      boolean;
  paid_at?:     string;
  paid_amount:  number;
  adjustments:  { type:"lunch"|"dinner"; count:number; reason:string; date:string }[];
  memo?:        string;
  students: { id: string; profiles: { id: string; name: string } };
}
interface Settings {
  year: number; month: number;
  lunch_price: number; dinner_price: number;
  order_deadline_days: number; cancel_deadline_days: number;
  available_days: string[]; blocked_dates: string[];
  lunch_vendor: string; dinner_vendor: string;
  notes: string; is_open: boolean;
}

const KR_MONTH  = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAY_KEYS  = ["mon","tue","wed","thu","fri","sat"];
const DAY_LABEL = ["월","화","수","목","금","토"];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getWeeks(year: number, month: number) {
  const weeks: (Date | null)[][] = [];
  const first = new Date(year, month-1, 1);
  const last  = new Date(year, month, 0);
  const startMon = new Date(first);
  startMon.setDate(first.getDate() - (first.getDay() + 6) % 7);
  let cur = new Date(startMon);
  while (cur <= last) {
    const week: (Date|null)[] = [];
    for (let d=0; d<6; d++) { const dt=new Date(cur); dt.setDate(cur.getDate()+d); week.push(dt.getMonth()+1===month?dt:null); }
    weeks.push(week);
    cur.setDate(cur.getDate()+7);
    if (cur > last) break;
  }
  return weeks;
}

// ── 메인 ─────────────────────────────────────────────────────
export default function LunchManageClient({ year, month, settings: initSettings, initialOrders }: {
  year: number; month: number;
  settings: Settings;
  initialOrders: Order[];
}) {
  const router = useRouter();
  const [tab,     setTab]    = useState<"daily"|"monthly"|"students"|"settings">("daily");
  const [orders,  setOrders] = useState<Order[]>(initialOrders);
  const [settings, setSettings] = useState<Settings>(initSettings);
  const [pending, startTrans]   = useTransition();

  const weeks = useMemo(() => getWeeks(year, month), [year, month]);
  const today = toDateStr(new Date());
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));

  // 날짜별 집계
  const dayCount = useMemo(() => {
    const map: Record<string, { lunch: number; dinner: number; names: string[] }> = {};
    for (const o of orders) {
      const name = o.students?.profiles?.name ?? "?";
      for (const d of (o.lunch_dates ?? [])) {
        if (!map[d]) map[d] = { lunch:0, dinner:0, names:[] };
        map[d].lunch++;
        if (!map[d].names.includes(name)) map[d].names.push(name);
      }
      for (const d of (o.dinner_dates ?? [])) {
        if (!map[d]) map[d] = { lunch:0, dinner:0, names:[] };
        map[d].dinner++;
        if (!map[d].names.includes(name)) map[d].names.push(name);
      }
    }
    return map;
  }, [orders]);

  function togglePaid(order: Order) {
    startTrans(async () => {
      try {
        await updatePaymentStatus(order.id, !order.is_paid);
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, is_paid: !o.is_paid } : o));
      } catch {}
    });
  }

  function handleSaveSettings() {
    startTrans(async () => {
      try { await saveLunchSettings(settings); alert("설정이 저장됐습니다."); router.refresh(); }
      catch (e: any) { alert(e.message); }
    });
  }

  const totalLunch  = orders.reduce((a, o) => a + (o.lunch_dates?.length ?? 0), 0);
  const totalDinner = orders.reduce((a, o) => a + (o.dinner_dates?.length ?? 0), 0);
  const totalRevenue = totalLunch * settings.lunch_price + totalDinner * settings.dinner_price;
  const paidCount = orders.filter(o => o.is_paid).length;

  return (
    <div style={{ minHeight:"100vh", background:"var(--sc-bg)" }}>
      {/* 헤더 */}
      <header style={{ position:"sticky", top:0, zIndex:20, background:"var(--sc-surface)",
        borderBottom:"1px solid var(--sc-border)", padding:"0 24px", height:52,
        display:"flex", alignItems:"center", gap:12 }}>
        <Link href="/portal" style={{ display:"flex", alignItems:"center", gap:5,
          color:"var(--sc-dim)", fontSize:13, fontWeight:700, textDecoration:"none" }}>
          <HomeIcon /> 홈
        </Link>
        <span style={{ color:"var(--sc-border)" }}>·</span>
        <span style={{ color:"var(--sc-white)", fontSize:14, fontWeight:900 }}>
          도시락 관리 — {year}년 {KR_MONTH[month-1]}
        </span>
        <div style={{ flex:1 }} />
        <ThemeToggle />
      </header>

      {/* 탭 */}
      <div style={{ background:"var(--sc-surface)", borderBottom:"1px solid var(--sc-border)",
        padding:"0 24px", display:"flex", gap:4 }}>
        {([
          { key:"daily",    label:"일일 현황" },
          { key:"monthly",  label:"월별 현황" },
          { key:"students", label:"학생별"    },
          { key:"settings", label:"설정"      },
        ] as const).map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            style={{
              padding:"12px 16px", fontSize:13, fontWeight:700, cursor:"pointer",
              background:"transparent", border:"none",
              color:      tab === key ? "var(--sc-white)" : "var(--sc-dim)",
              borderBottom: tab === key ? "2px solid var(--sc-green)" : "2px solid transparent",
              transition:"all 0.15s",
            }}>{label}</button>
        ))}
      </div>

      <main style={{ maxWidth:900, margin:"0 auto", padding:"24px 20px 60px" }}>

        {/* ── 일일 현황 탭 ────────────────────────────────── */}
        {tab === "daily" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {/* 오늘/내일 카드 */}
            {[today, tomorrow].map((ds, i) => {
              const d = dayCount[ds];
              const dateObj = new Date(ds);
              const label = i === 0 ? "오늘" : "내일";
              return (
                <div key={ds} style={{ padding:"20px 24px", borderRadius:16,
                  background:"var(--sc-surface)", border:"1px solid var(--sc-border)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <span style={{ fontSize:12, fontWeight:800, padding:"3px 10px", borderRadius:20,
                      background: i===0 ? "rgba(0,232,117,0.15)" : "var(--sc-raised)",
                      color: i===0 ? "var(--sc-green)" : "var(--sc-dim)",
                      border: `1px solid ${i===0 ? "rgba(0,232,117,0.4)" : "var(--sc-border)"}` }}>
                      {label}
                    </span>
                    <span style={{ fontSize:14, fontWeight:700, color:"var(--sc-white)" }}>
                      {dateObj.getMonth()+1}월 {dateObj.getDate()}일
                    </span>
                  </div>
                  <div style={{ display:"flex", gap:24, marginBottom:16 }}>
                    <div>
                      <p style={{ fontSize:10, color:"var(--sc-dim)", margin:"0 0 4px" }}>
                        점심 ({settings.lunch_vendor})
                      </p>
                      <p style={{ fontSize:36, fontWeight:200, color:"#5badff", margin:0, lineHeight:1 }}>
                        {d?.lunch ?? 0}
                        <span style={{ fontSize:14, fontWeight:500, marginLeft:3 }}>명</span>
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize:10, color:"var(--sc-dim)", margin:"0 0 4px" }}>
                        저녁 ({settings.dinner_vendor})
                      </p>
                      <p style={{ fontSize:36, fontWeight:200, color:"#c084fc", margin:0, lineHeight:1 }}>
                        {d?.dinner ?? 0}
                        <span style={{ fontSize:14, fontWeight:500, marginLeft:3 }}>명</span>
                      </p>
                    </div>
                  </div>
                  {d && (
                    <div style={{ fontSize:11, color:"var(--sc-dim)" }}>
                      신청자: {d.names.join(", ")}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 이번 달 요약 */}
            <div style={{ padding:"16px 20px", borderRadius:14,
              background:"var(--sc-surface)", border:"1px solid var(--sc-border)",
              display:"flex", gap:24, flexWrap:"wrap" }}>
              <Stat label="총 신청자" value={`${orders.length}명`} />
              <Stat label="점심 합계" value={`${totalLunch}건`} color="#5badff" />
              <Stat label="저녁 합계" value={`${totalDinner}건`} color="#c084fc" />
              <Stat label="예상 매출" value={`${totalRevenue.toLocaleString()}원`} color="var(--sc-green)" />
              <Stat label="납부 완료" value={`${paidCount}/${orders.length}명`}
                color={paidCount === orders.length ? "var(--sc-green)" : "#fbbf24"} />
            </div>
          </div>
        )}

        {/* ── 월별 현황 탭 ────────────────────────────────── */}
        {tab === "monthly" && (
          <div style={{ borderRadius:14, overflow:"hidden", border:"1px solid var(--sc-border)",
            background:"var(--sc-surface)" }}>
            <div style={{ display:"grid", gridTemplateColumns:"80px repeat(6, 1fr)",
              borderBottom:"1px solid var(--sc-border)" }}>
              <div style={{ padding:"10px 8px", fontSize:11, fontWeight:800,
                color:"var(--sc-dim)", textAlign:"center" }}>주차</div>
              {DAY_LABEL.map((d, i) => (
                <div key={d} style={{ padding:"10px 4px", fontSize:12, fontWeight:800,
                  textAlign:"center", borderLeft:"1px solid var(--sc-border)",
                  color: d === "토" ? "#f87171" : "var(--sc-dim)" }}>{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => {
              if (!week.some(Boolean)) return null;
              return (
                <div key={wi} style={{ borderBottom:"1px solid var(--sc-border)" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"80px repeat(6, 1fr)" }}>
                    <div style={{ padding:"8px", fontSize:11, fontWeight:800,
                      color:"var(--sc-dim)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {wi+1}주차
                    </div>
                    {week.map((date, di) => {
                      if (!date) return (
                        <div key={di} style={{ borderLeft:"1px solid var(--sc-border)",
                          background:"var(--sc-raised)", minHeight:64, position:"relative" }}>
                          <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.15 }}>
                            <line x1="0" y1="0" x2="100%" y2="100%" stroke="var(--sc-dim)" strokeWidth="1"/>
                          </svg>
                        </div>
                      );
                      const ds = toDateStr(date);
                      const d  = dayCount[ds];
                      const isToday = ds === today;
                      return (
                        <div key={di} style={{
                          borderLeft:"1px solid var(--sc-border)", padding:"6px 4px",
                          textAlign:"center", minHeight:64,
                          background: isToday ? "rgba(0,232,117,0.05)" : "transparent",
                        }}>
                          <div style={{ fontSize:11, fontWeight:800, marginBottom:4,
                            color: di===5 ? "#f87171" : isToday ? "var(--sc-green)" : "var(--sc-dim)" }}>
                            {date.getDate()}
                          </div>
                          {d ? (
                            <>
                              <div style={{ fontSize:11, fontWeight:700, color:"#5badff" }}>
                                점 {d.lunch}명
                              </div>
                              <div style={{ fontSize:11, fontWeight:700, color:"#c084fc" }}>
                                저 {d.dinner}명
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize:10, color:"var(--sc-border)" }}>—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 학생별 현황 탭 ──────────────────────────────── */}
        {tab === "students" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {/* 미납 필터 헤더 */}
            <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:12, color:"var(--sc-dim)", alignSelf:"center" }}>
                총 {orders.length}명 · 납부 {paidCount}명 · 미납 {orders.length - paidCount}명
              </span>
            </div>

            {orders.length === 0 && (
              <p style={{ color:"var(--sc-dim)", fontSize:13, padding:"40px 0", textAlign:"center" }}>
                이번 달 신청 내역이 없습니다.
              </p>
            )}

            {[...orders].sort((a, b) => {
              // 미정산(금액 불일치)을 위로
              const calc = (o: Order) => {
                const l = o.lunch_dates?.length ?? 0;
                const d = o.dinner_dates?.length ?? 0;
                const base = l * settings.lunch_price + d * settings.dinner_price;
                const adj  = (o.adjustments ?? []).reduce((s, x) =>
                  s + x.count * (x.type === "lunch" ? settings.lunch_price : settings.dinner_price), 0);
                return base - adj;
              };
              const aSettled = (a.paid_amount > 0) && (a.paid_amount === calc(a));
              const bSettled = (b.paid_amount > 0) && (b.paid_amount === calc(b));
              return Number(aSettled) - Number(bSettled);
            }).map(o => {
              const name       = o.students?.profiles?.name ?? "알 수 없음";
              const lCount     = o.lunch_dates?.length  ?? 0;
              const dCount     = o.dinner_dates?.length ?? 0;
              const baseAmount = lCount * settings.lunch_price + dCount * settings.dinner_price;
              const adjRefund  = (o.adjustments ?? []).reduce((s, a) =>
                s + a.count * (a.type === "lunch" ? settings.lunch_price : settings.dinner_price), 0);
              const calcAmount = baseAmount - adjRefund;   // 차감 반영 실 청구액
              const paidAmount = o.paid_amount ?? 0;
              const delta      = paidAmount - calcAmount;  // + 환불필요, - 추가납부
              const settled    = paidAmount > 0 && delta === 0;
              const hasDelta   = paidAmount > 0 && delta !== 0;

              return (
                <OrderCard
                  key={o.id}
                  order={o}
                  name={name}
                  lCount={lCount}
                  dCount={dCount}
                  baseAmount={baseAmount}
                  calcAmount={calcAmount}
                  adjRefund={adjRefund}
                  paidAmount={paidAmount}
                  delta={delta}
                  settled={settled}
                  hasDelta={hasDelta}
                  lunchPrice={settings.lunch_price}
                  dinnerPrice={settings.dinner_price}
                  pending={pending}
                  onTogglePaid={() => togglePaid(o)}
                  onPaidAmountSave={async (v) => {
                    await updatePaidAmount(o.id, v);
                    setOrders(prev => prev.map(x =>
                      x.id === o.id ? { ...x, paid_amount: v, is_paid: v > 0 } : x
                    ));
                  }}
                  onAdjSaved={(adjs) => setOrders(prev => prev.map(x =>
                    x.id === o.id ? { ...x, adjustments: adjs } : x
                  ))}
                  onDelete={async () => {
                    await deleteLunchOrder(o.id);
                    setOrders(prev => prev.filter(x => x.id !== o.id));
                    router.refresh();
                  }}
                />
              );
            })}
          </div>
        )}

        {/* ── 설정 탭 ─────────────────────────────────────── */}
        {tab === "settings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:480 }}>
            <Row label="신청 열기/닫기">
              <button type="button" onClick={() => setSettings(s => ({ ...s, is_open: !s.is_open }))}
                style={{
                  padding:"6px 20px", borderRadius:20, fontSize:12, fontWeight:800, cursor:"pointer",
                  background: settings.is_open ? "rgba(0,232,117,0.15)" : "rgba(239,68,68,0.1)",
                  color:      settings.is_open ? "var(--sc-green)"       : "#f87171",
                  border:     `1px solid ${settings.is_open ? "rgba(0,232,117,0.4)" : "rgba(239,68,68,0.3)"}`,
                }}>
                {settings.is_open ? "신청 중" : "닫힘"}
              </button>
            </Row>
            <Row label="점심 가격 (원)">
              <NumInput value={settings.lunch_price} onChange={v => setSettings(s => ({ ...s, lunch_price: v }))} />
            </Row>
            <Row label="저녁 가격 (원)">
              <NumInput value={settings.dinner_price} onChange={v => setSettings(s => ({ ...s, dinner_price: v }))} />
            </Row>
            <Row label="점심 업체">
              <input value={settings.lunch_vendor} onChange={e => setSettings(s => ({ ...s, lunch_vendor: e.target.value }))}
                className="sc-input text-sm" style={{ padding:"7px 12px", width:200 }} />
            </Row>
            <Row label="저녁 업체">
              <input value={settings.dinner_vendor} onChange={e => setSettings(s => ({ ...s, dinner_vendor: e.target.value }))}
                className="sc-input text-sm" style={{ padding:"7px 12px", width:200 }} />
            </Row>
            <Row label="신청 마감 (n일 전)">
              <NumInput value={settings.order_deadline_days} min={0} max={30}
                onChange={v => setSettings(s => ({ ...s, order_deadline_days: v }))} />
            </Row>
            <Row label="취소 마감 (n일 전)">
              <NumInput value={settings.cancel_deadline_days} min={0} max={30}
                onChange={v => setSettings(s => ({ ...s, cancel_deadline_days: v }))} />
            </Row>
            <Row label="공지사항">
              <textarea value={settings.notes} rows={3}
                onChange={e => setSettings(s => ({ ...s, notes: e.target.value }))}
                className="sc-input text-sm resize-none" style={{ padding:"8px 12px", width:"100%" }}
                placeholder="학생에게 보여지는 공지..." />
            </Row>
            <Row label="차단 날짜 (공휴일 등)">
              <textarea
                value={(settings.blocked_dates as string[]).join("\n")}
                rows={4}
                onChange={e => setSettings(s => ({
                  ...s,
                  blocked_dates: e.target.value.split("\n").map(d => d.trim()).filter(Boolean)
                }))}
                className="sc-input text-sm resize-none"
                style={{ padding:"8px 12px", width:"100%", fontFamily:"monospace" }}
                placeholder={"YYYY-MM-DD 형식으로 한 줄씩\n예:\n2025-03-01\n2025-03-10"}
              />
            </Row>
            <button type="button" onClick={handleSaveSettings} disabled={pending}
              style={{
                width:"100%", padding:"12px 0", borderRadius:12, fontSize:14, fontWeight:900,
                background:"var(--sc-green)", color:"var(--sc-bg)", border:"none", cursor:"pointer",
                opacity: pending ? 0.6 : 1,
              }}>
              {pending ? "저장 중…" : "설정 저장"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ── 공통 UI ───────────────────────────────────────────────────
function Stat({ label, value, color = "var(--sc-white)" }: { label:string; value:string; color?:string }) {
  return (
    <div>
      <p style={{ fontSize:9, color:"var(--sc-dim)", margin:"0 0 2px", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</p>
      <p style={{ fontSize:20, fontWeight:200, color, margin:0 }}>{value}</p>
    </div>
  );
}
function Row({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--sc-dim)", marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}
function NumInput({ value, onChange, min=0, max=999999 }: { value:number; onChange:(v:number)=>void; min?:number; max?:number }) {
  return (
    <input type="number" min={min} max={max} value={value}
      onChange={e => onChange(parseInt(e.target.value)||0)}
      className="sc-input text-sm" style={{ padding:"7px 12px", width:120 }} />
  );
}

// ── 학생 주문 카드 ────────────────────────────────────────────
function OrderCard({
  order, name, lCount, dCount, baseAmount, calcAmount, adjRefund,
  paidAmount, delta, settled, hasDelta, lunchPrice, dinnerPrice,
  pending, onTogglePaid, onPaidAmountSave, onAdjSaved, onDelete,
}: {
  order: Order; name: string; lCount: number; dCount: number;
  baseAmount: number; calcAmount: number; adjRefund: number;
  paidAmount: number; delta: number; settled: boolean; hasDelta: boolean;
  lunchPrice: number; dinnerPrice: number; pending: boolean;
  onTogglePaid: () => void;
  onPaidAmountSave: (v: number) => Promise<void>;
  onAdjSaved: (adjs: Order["adjustments"]) => void;
  onDelete: () => Promise<void>;
}) {
  const [editing,   setEditing]   = useState(false);
  const [inputVal,  setInputVal]  = useState(String(paidAmount || ""));
  const [saving,    setSaving]    = useState(false);

  async function handleSave() {
    const v = parseInt(inputVal) || 0;
    setSaving(true);
    try { await onPaidAmountSave(v); setEditing(false); }
    catch {}
    setSaving(false);
  }

  return (
    <div style={{
      padding:"14px 16px", borderRadius:12, background:"var(--sc-surface)",
      border: `1px solid ${
        hasDelta && delta > 0 ? "rgba(251,191,36,0.4)"
        : hasDelta && delta < 0 ? "rgba(239,68,68,0.3)"
        : settled ? "rgba(0,232,117,0.3)"
        : "var(--sc-border)"
      }`,
    }}>
      {/* 이름 + 상태 (양 끝 배치) */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
          <span style={{ fontSize:14, fontWeight:800, color:"var(--sc-white)", whiteSpace:"nowrap" }}>{name}</span>
          {order.seat_no && (
            <span style={{ fontSize:10, color:"var(--sc-dim)", background:"var(--sc-raised)",
              border:"1px solid var(--sc-border)", borderRadius:6, padding:"1px 6px", whiteSpace:"nowrap" }}>
              좌석 {order.seat_no}
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
        {/* 상태 뱃지 — 오른쪽 끝 */}
        {hasDelta ? (
          <span style={{
            fontSize:11, fontWeight:800, borderRadius:20, padding:"3px 10px",
            background: delta > 0 ? "rgba(251,191,36,0.15)" : "rgba(239,68,68,0.1)",
            color:      delta > 0 ? "#fbbf24"               : "#f87171",
            border: `1px solid ${delta > 0 ? "rgba(251,191,36,0.4)" : "rgba(239,68,68,0.3)"}`,
            whiteSpace:"nowrap", flexShrink:0,
          }}>
            {delta > 0 ? `환불 ${delta.toLocaleString()}원` : `추가납부 ${Math.abs(delta).toLocaleString()}원`}
          </span>
        ) : settled ? (
          <span style={{ fontSize:11, fontWeight:700, color:"var(--sc-green)",
            background:"rgba(0,232,117,0.08)", border:"1px solid rgba(0,232,117,0.25)",
            borderRadius:20, padding:"3px 10px", whiteSpace:"nowrap", flexShrink:0 }}>
            정산완료
          </span>
        ) : (
          <span style={{ fontSize:11, fontWeight:700, color:"var(--sc-dim)",
            background:"var(--sc-raised)", border:"1px solid var(--sc-border)",
            borderRadius:20, padding:"3px 10px", whiteSpace:"nowrap", flexShrink:0 }}>
            미납
          </span>
        )}
          {/* 삭제 버튼 */}
          <button type="button"
            onClick={async () => {
              if (!confirm(`"${name}" 학생의 신청을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
              try { await onDelete(); } catch (e: any) { alert(e.message); }
            }}
            style={{ padding:"3px 8px", borderRadius:8, fontSize:10, fontWeight:700,
              cursor:"pointer", background:"rgba(239,68,68,0.08)", color:"#f87171",
              border:"1px solid rgba(239,68,68,0.2)", flexShrink:0 }}>
            삭제
          </button>
        </div>
      </div>

      {/* 신청 정보 */}
      <div style={{ fontSize:12, color:"var(--sc-dim)", display:"flex", gap:12, flexWrap:"wrap", marginBottom:6 }}>
        <span>점심 <strong style={{ color:"#5badff" }}>{lCount}일</strong></span>
        <span>저녁 <strong style={{ color:"#c084fc" }}>{dCount}일</strong></span>
        <span>신청 <strong style={{ color:"var(--sc-white)" }}>{baseAmount.toLocaleString()}원</strong></span>
        {adjRefund > 0 && (
          <span>차감 <strong style={{ color:"#f87171" }}>−{adjRefund.toLocaleString()}원</strong></span>
        )}
        <span>실청구 <strong style={{ color:"var(--sc-white)" }}>{calcAmount.toLocaleString()}원</strong></span>
      </div>

      {/* 조정 뱃지 */}
      {order.adjustments?.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
          {order.adjustments.map((a, i) => (
            <span key={i} style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20,
              background:"rgba(239,68,68,0.08)", color:"#f87171", border:"1px solid rgba(239,68,68,0.2)" }}>
              {a.type === "lunch" ? "점심" : "저녁"} -{a.count}개 · {a.reason}
            </span>
          ))}
        </div>
      )}

      {/* 납부금액 + 버튼 */}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, flex:1 }}>
          <span style={{ fontSize:11, color:"var(--sc-dim)", whiteSpace:"nowrap" }}>납부금액</span>
          {editing ? (
            <>
              <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
                min={0} step={500} autoFocus
                style={{ width:110, padding:"4px 8px", borderRadius:8, fontSize:12, fontWeight:700,
                  background:"var(--sc-raised)", border:"1px solid var(--sc-green)",
                  color:"var(--sc-white)", outline:"none" }} />
              <span style={{ fontSize:11, color:"var(--sc-dim)" }}>원</span>
              <button type="button" onClick={handleSave} disabled={saving}
                style={{ padding:"4px 10px", borderRadius:8, fontSize:11, fontWeight:800,
                  background:"var(--sc-green)", color:"var(--sc-bg)", border:"none",
                  cursor:"pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "…" : "저장"}
              </button>
              <button type="button" onClick={() => { setEditing(false); setInputVal(String(paidAmount || "")); }}
                style={{ padding:"4px 8px", borderRadius:8, fontSize:11, fontWeight:800,
                  background:"var(--sc-raised)", color:"var(--sc-dim)",
                  border:"1px solid var(--sc-border)", cursor:"pointer" }}>
                취소
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize:13, fontWeight:700,
                color: paidAmount > 0 ? "var(--sc-white)" : "var(--sc-border)" }}>
                {paidAmount > 0 ? `${paidAmount.toLocaleString()}원` : "미입력"}
              </span>
              <button type="button" onClick={() => { setEditing(true); setInputVal(String(paidAmount || "")); }}
                style={{ padding:"3px 8px", borderRadius:8, fontSize:10, fontWeight:700,
                  background:"var(--sc-raised)", color:"var(--sc-dim)",
                  border:"1px solid var(--sc-border)", cursor:"pointer" }}>
                수정
              </button>
            </>
          )}
        </div>

        {/* 납부완료: 금액 일치할 때만 */}
        {settled && (
          <button type="button" onClick={onTogglePaid} disabled={pending}
            style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:800,
              cursor:"pointer", transition:"all 0.15s", flexShrink:0,
              background:"rgba(0,232,117,0.15)", color:"var(--sc-green)",
              border:"1px solid rgba(0,232,117,0.4)" }}>
            <CheckIcon size={11} /> 납부완료
          </button>
        )}

        <AdjustButton order={order} lunchPrice={lunchPrice} dinnerPrice={dinnerPrice} onSaved={onAdjSaved} />
      </div>
    </div>
  );
}

// ── 조정 추가 버튼 + 미니 모달 ───────────────────────────────
const REASONS = ["조리 실수", "배달 지연", "품질 불량", "수량 부족", "기타"];

function AdjustButton({ order, lunchPrice, dinnerPrice, onSaved }: {
  order:       Order;
  lunchPrice:  number;
  dinnerPrice: number;
  onSaved:     (adjs: Order["adjustments"]) => void;
}) {
  const [open,    setOpen]    = useState(false);
  const [type,    setType]    = useState<"lunch"|"dinner">("lunch");
  const [count,   setCount]   = useState(1);
  const [reason,  setReason]  = useState(REASONS[0]);
  const [date,    setDate]    = useState(new Date().toISOString().split("T")[0]);
  const [saving,  setSaving]  = useState(false);

  const maxCount = type === "lunch"
    ? (order.lunch_dates?.length ?? 0)
    : (order.dinner_dates?.length ?? 0);

  async function handleAdd() {
    setSaving(true);
    const newAdj = { type, count, reason, date };
    const updated = [...(order.adjustments ?? []), newAdj];
    try {
      await saveAdjustments(order.id, updated);
      onSaved(updated);
      setOpen(false);
      setCount(1);
    } catch {}
    setSaving(false);
  }

  async function handleRemove(idx: number) {
    const updated = (order.adjustments ?? []).filter((_, i) => i !== idx);
    await saveAdjustments(order.id, updated);
    onSaved(updated);
  }

  const refundAmt = (order.adjustments ?? []).reduce((acc, a) =>
    acc + a.count * (a.type === "lunch" ? lunchPrice : dinnerPrice), 0);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        style={{
          padding:"5px 10px", borderRadius:20, fontSize:11, fontWeight:700,
          cursor:"pointer", flexShrink:0,
          background:"rgba(239,68,68,0.08)", color:"var(--sc-dim)",
          border:"1px solid var(--sc-border)",
        }}>
        차감
      </button>

      {open && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.6)" }}
               onClick={() => setOpen(false)} />
          <div style={{
            position:"fixed", zIndex:101, top:"50%", left:"50%",
            transform:"translate(-50%,-50%)", width:"100%", maxWidth:360,
            background:"var(--sc-surface)", border:"1px solid var(--sc-border)",
            borderRadius:16, padding:20, boxShadow:"0 20px 60px rgba(0,0,0,0.4)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
              <p style={{ fontWeight:900, fontSize:14, color:"var(--sc-white)", margin:0 }}>차감 추가</p>
              <button type="button" onClick={() => setOpen(false)}
                style={{ background:"none", border:"none", color:"var(--sc-dim)", fontSize:18, cursor:"pointer" }}>×</button>
            </div>

            {/* 기존 조정 목록 */}
            {(order.adjustments ?? []).length > 0 && (
              <div style={{ marginBottom:14, display:"flex", flexDirection:"column", gap:5 }}>
                {order.adjustments.map((a, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8,
                    padding:"6px 10px", borderRadius:8, background:"var(--sc-raised)",
                    fontSize:11, color:"var(--sc-dim)" }}>
                    <span style={{ flex:1 }}>
                      {a.type === "lunch" ? "점심" : "저녁"} {a.count}개 차감 · {a.reason} · {a.date}
                    </span>
                    <button type="button" onClick={() => handleRemove(i)}
                      style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer", fontSize:13 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* 새 차감 입력 */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {/* 점심/저녁 */}
              <div style={{ display:"flex", gap:6 }}>
                {(["lunch","dinner"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    style={{
                      flex:1, padding:"7px 0", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer",
                      background: type === t ? "rgba(239,68,68,0.15)" : "var(--sc-raised)",
                      color:      type === t ? "#f87171"               : "var(--sc-dim)",
                      border:     `1px solid ${type === t ? "rgba(239,68,68,0.4)" : "var(--sc-border)"}`,
                    }}>
                    {t === "lunch" ? "점심" : "저녁"}
                  </button>
                ))}
              </div>

              {/* 개수 */}
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <label style={{ fontSize:11, color:"var(--sc-dim)", width:40 }}>개수</label>
                <div style={{ display:"flex", gap:4 }}>
                  {[1,2,3,4,5].filter(n => n <= maxCount).map(n => (
                    <button key={n} type="button" onClick={() => setCount(n)}
                      style={{
                        width:32, height:32, borderRadius:8, fontSize:12, fontWeight:800, cursor:"pointer",
                        background: count === n ? "rgba(239,68,68,0.15)" : "var(--sc-raised)",
                        color:      count === n ? "#f87171"               : "var(--sc-dim)",
                        border:     `1px solid ${count === n ? "rgba(239,68,68,0.4)" : "var(--sc-border)"}`,
                      }}>{n}</button>
                  ))}
                </div>
              </div>

              {/* 날짜 */}
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <label style={{ fontSize:11, color:"var(--sc-dim)", width:40 }}>날짜</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="sc-input text-sm" style={{ padding:"6px 10px", flex:1 }} />
              </div>

              {/* 사유 */}
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <label style={{ fontSize:11, color:"var(--sc-dim)", width:40 }}>사유</label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="sc-input text-sm" style={{ padding:"6px 10px", flex:1 }}>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <button type="button" onClick={handleAdd} disabled={saving || maxCount === 0}
                style={{
                  padding:"10px 0", borderRadius:10, fontSize:13, fontWeight:800,
                  cursor: maxCount === 0 ? "not-allowed" : "pointer",
                  background:"rgba(239,68,68,0.15)", color:"#f87171",
                  border:"1px solid rgba(239,68,68,0.4)", opacity: saving ? 0.6 : 1,
                }}>
                {maxCount === 0 ? "신청 없음" : saving ? "저장 중…" : `${type === "lunch" ? "점심" : "저녁"} ${count}개 차감 추가`}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
