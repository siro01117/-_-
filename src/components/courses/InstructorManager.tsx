"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ── 타입 ──────────────────────────────────────────────────────
export interface Instructor {
  id:       string;
  name:     string;
  subjects: string[];
  color:    string;
  memo?:    string;
}

// ── 색상 팔레트 ───────────────────────────────────────────────
const COLOR_PALETTE = [
  "#6366f1","#8b5cf6","#ec4899","#f43f5e",
  "#f97316","#eab308","#22c55e","#14b8a6",
  "#06b6d4","#3b82f6","#00e875","#a3e635",
  "#1e293b","#334155","#64748b","#94a3b8",
];

// ── 아이콘 ─────────────────────────────────────────────────────
const ip = {
  width:16, height:16, viewBox:"0 0 24 24", fill:"none",
  stroke:"currentColor", strokeWidth:1.75,
  strokeLinecap:"round" as const, strokeLinejoin:"round" as const,
};
const PencilIcon = () => <svg {...ip}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon  = () => <svg {...ip}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const PlusIcon   = () => <svg {...ip}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const XIcon      = () => <svg {...ip}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

// ── 과목 태그 입력 ────────────────────────────────────────────
function SubjectTagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const v = input.trim();
    if (!v || tags.includes(v)) return;
    onChange([...tags, v]);
    setInput("");
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); }}}
          placeholder="과목 이름 입력..."
          className="sc-input text-sm flex-1"
          style={{ padding: "8px 12px" }}
        />
        <button
          onClick={add}
          className="px-4 rounded-xl text-sm font-bold transition-all active:scale-95"
          style={{ background: "var(--sc-green)", color: "var(--sc-bg)", flexShrink: 0 }}
        >
          추가
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {tags.map((tag, i) => (
            <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: "var(--sc-raised)", border: "1px solid var(--sc-border)", color: "var(--sc-white)" }}>
              {tag}
              <button onClick={() => onChange(tags.filter((_, j) => j !== i))}
                      className="hover:opacity-60 ml-0.5" style={{ color: "var(--sc-dim)", lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 강사 폼 모달 ──────────────────────────────────────────────
function InstructorFormModal({ initial, onClose, onSave }: {
  initial?: Instructor;
  onClose: () => void;
  onSave:  (data: Omit<Instructor, "id">) => Promise<void>;
}) {
  const isEdit = !!initial;
  const [name,     setName]     = useState(initial?.name     ?? "");
  const [subjects, setSubjects] = useState<string[]>(initial?.subjects ?? []);
  const [color,    setColor]    = useState(initial?.color    ?? COLOR_PALETTE[0]);
  const [memo,     setMemo]     = useState(initial?.memo     ?? "");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  async function handleSave() {
    if (!name.trim()) { setError("선생님 이름을 입력하세요."); return; }
    setSaving(true);
    await onSave({ name: name.trim(), subjects, color, memo: memo.trim() || undefined });
    setSaving(false);
  }

  return (
    <>
      <div className="fixed inset-0 z-[70]"
           style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
           onClick={onClose} />
      <div className="fixed z-[80] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-full max-w-md rounded-2xl p-6 shadow-2xl"
           style={{ background: "var(--sc-surface)", border: "1px solid var(--sc-border)", maxHeight: "90vh", overflowY: "auto" }}
           onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--sc-dim)" }}>
              {isEdit ? "선생님 수정" : "선생님 등록"}
            </p>
            <h3 className="font-black text-lg" style={{ color: "var(--sc-white)" }}>
              {isEdit ? "정보 수정" : "새 선생님 추가"}
            </h3>
          </div>
          <button onClick={onClose} className="text-xl hover:opacity-60" style={{ color: "var(--sc-dim)" }}>×</button>
        </div>

        <div className="space-y-4 mb-5">
          {/* 이름 */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--sc-dim)" }}>이름 *</p>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="선생님 이름..." className="sc-input text-sm w-full"
              style={{ padding: "10px 12px" }} autoFocus />
          </div>

          {/* 담당 색상 */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--sc-dim)" }}>
              표시 색상
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {COLOR_PALETTE.map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 26, height: 26, borderRadius: "50%", background: c,
                  border: color === c ? "2.5px solid var(--sc-white)" : "2.5px solid transparent",
                  outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2,
                  transform: color === c ? "scale(1.2)" : "scale(1)", transition: "all 0.15s",
                }} />
              ))}
            </div>
            {/* 미리보기 */}
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                 style={{ background: "var(--sc-raised)", border: "1px solid var(--sc-border)" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--sc-white)" }}>
                {name || "선생님 이름"}
              </span>
            </div>
          </div>

          {/* 담당 과목 */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--sc-dim)" }}>
              담당 과목
            </p>
            <SubjectTagInput tags={subjects} onChange={setSubjects} />
          </div>

          {/* 메모 */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--sc-dim)" }}>메모</p>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="특이사항, 연락처 등..."
              rows={3}
              className="sc-input text-sm w-full resize-none"
              style={{ padding: "10px 12px" }}
            />
          </div>
        </div>

        {error && <p className="text-sm mb-3 text-center" style={{ color: "#f87171" }}>{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} className="py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--sc-raised)", color: "var(--sc-dim)", border: "1px solid var(--sc-border)" }}>취소</button>
          <button onClick={handleSave} disabled={saving}
            className="py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: "var(--sc-green)", color: "var(--sc-bg)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중..." : (isEdit ? "수정 완료" : "추가")}
          </button>
        </div>
      </div>
    </>
  );
}

// ── 강사 카드 ─────────────────────────────────────────────────
function InstructorCard({ inst, onEdit, onDelete }: {
  inst: Instructor; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2.5 relative group"
         style={{ background: "var(--sc-surface)", border: "1px solid var(--sc-border)",
                  borderLeft: `3px solid ${inst.color}` }}>
      {/* 이름 + 색상 */}
      <div className="flex items-center gap-2">
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: inst.color, flexShrink: 0 }} />
        <p className="font-black text-sm" style={{ color: "var(--sc-white)" }}>{inst.name}</p>
      </div>

      {/* 과목 태그 */}
      {inst.subjects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {inst.subjects.map((s, i) => (
            <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${inst.color}20`, color: inst.color, border: `1px solid ${inst.color}40` }}>
              {s}
            </span>
          ))}
        </div>
      )}

      {/* 메모 */}
      {inst.memo && (
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--sc-dim)" }}>
          {inst.memo}
        </p>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        <button onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
          style={{ background: "var(--sc-raised)", color: "var(--sc-dim)", border: "1px solid var(--sc-border)" }}>
          <PencilIcon />
        </button>
        <button onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ── 삭제 확인 ─────────────────────────────────────────────────
function DeleteConfirm({ inst, onCancel, onConfirm }: {
  inst: Instructor; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[70]"
           style={{ background: "rgba(0,0,0,0.5)" }} onClick={onCancel} />
      <div className="fixed z-[80] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-full max-w-sm rounded-2xl p-6 shadow-2xl"
           style={{ background: "var(--sc-surface)", border: "1px solid rgba(239,68,68,0.3)" }}
           onClick={(e) => e.stopPropagation()}>
        <h3 className="font-black text-lg mb-2" style={{ color: "var(--sc-white)" }}>선생님 삭제</h3>
        <p className="text-sm mb-1" style={{ color: "var(--sc-dim)" }}>
          <span style={{ color: "var(--sc-white)", fontWeight: 700 }}>"{inst.name}"</span> 선생님을 삭제하시겠어요?
        </p>
        <p className="text-xs mb-5" style={{ color: "rgba(239,68,68,0.8)" }}>
          담당 수업에서 강사 정보가 제거됩니다.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--sc-raised)", color: "var(--sc-dim)", border: "1px solid var(--sc-border)" }}>취소</button>
          <button onClick={onConfirm} className="py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" }}>삭제</button>
        </div>
      </div>
    </>
  );
}

// ── 메인 InstructorManager 모달 ───────────────────────────────
interface Props {
  onClose:   () => void;
  onUpdated: () => void;
}

export default function InstructorManager({ onClose, onUpdated }: Props) {
  const supabase = createClient();
  const [instructors,  setInstructors]  = useState<Instructor[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [editTarget,   setEditTarget]   = useState<Instructor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Instructor | null>(null);
  const [search,       setSearch]       = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("instructors")
      .select("id, name, subjects, color, memo")
      .order("name");
    setInstructors((data ?? []) as Instructor[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: Omit<Instructor, "id">) {
    const { error } = await supabase.from("instructors").insert(data);
    if (error) { alert(`저장 실패: ${error.message}\n\n마이그레이션(add_instructors.sql)을 Supabase에서 실행했는지 확인하세요.`); return; }
    setCreateOpen(false);
    await load();
    onUpdated();
  }

  async function handleEdit(data: Omit<Instructor, "id">) {
    if (!editTarget) return;
    const { error } = await supabase.from("instructors").update(data).eq("id", editTarget.id);
    if (error) { alert(`수정 실패: ${error.message}`); return; }
    setEditTarget(null);
    await load();
    onUpdated();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("instructors").delete().eq("id", deleteTarget.id);
    if (error) { alert(`삭제 실패: ${error.message}`); return; }
    setDeleteTarget(null);
    await load();
    onUpdated();
  }

  const filtered = instructors.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.subjects.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      {/* 배경 */}
      <div className="fixed inset-0 z-50"
           style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
           onClick={onClose} />

      {/* 패널 */}
      <div className="fixed z-[60] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-full max-w-lg rounded-2xl shadow-2xl"
           style={{ background: "var(--sc-bg)", border: "1px solid var(--sc-border)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
           onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-6 pt-5 pb-4"
             style={{ borderBottom: "1px solid var(--sc-border)", flexShrink: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--sc-dim)" }}>Management</p>
              <h2 className="text-xl font-black" style={{ color: "var(--sc-white)" }}>선생님 관리</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: "var(--sc-green)", color: "var(--sc-bg)" }}>
                <PlusIcon /> 선생님 추가
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-60 transition-all"
                style={{ background: "var(--sc-raised)", color: "var(--sc-dim)", border: "1px solid var(--sc-border)" }}>
                <XIcon />
              </button>
            </div>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 과목 검색..." className="sc-input text-sm w-full"
            style={{ padding: "8px 12px" }} />
        </div>

        {/* 목록 */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px 24px" }}>
          {loading ? (
            <div className="text-center py-10" style={{ color: "var(--sc-dim)", fontSize: 13 }}>불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <p style={{ color: "var(--sc-dim)", fontSize: 13 }}>
                {search ? `"${search}" 검색 결과 없음` : "등록된 선생님이 없습니다."}
              </p>
              {!search && (
                <button onClick={() => setCreateOpen(true)}
                  className="mt-3 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: "var(--sc-green)", color: "var(--sc-bg)" }}>
                  첫 선생님 추가
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((inst) => (
                <InstructorCard
                  key={inst.id}
                  inst={inst}
                  onEdit={() => setEditTarget(inst)}
                  onDelete={() => setDeleteTarget(inst)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 하위 모달들 */}
      {createOpen && (
        <InstructorFormModal onClose={() => setCreateOpen(false)} onSave={handleCreate} />
      )}
      {editTarget && (
        <InstructorFormModal initial={editTarget} onClose={() => setEditTarget(null)} onSave={handleEdit} />
      )}
      {deleteTarget && (
        <DeleteConfirm inst={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </>
  );
}
