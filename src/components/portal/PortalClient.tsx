"use client";

import { useState } from "react";
import PortalGrid, { PortalGridProps } from "./PortalGrid";
import { RoleRow } from "@/types";

interface Props {
  currentPermissions: PortalGridProps;
  roleLabel:          string;
  isAdmin:            boolean;
  allRoles?:          RoleRow[];  // admin 전용: 모든 역할 목록
}

export default function PortalClient({
  currentPermissions,
  roleLabel,
  isAdmin,
  allRoles = [],
}: Props) {
  const [viewRoleName, setViewRoleName] = useState<string | null>(null);

  // admin 이 다른 역할 뷰 미리보기 중이면 해당 권한 사용
  const viewRole = viewRoleName ? allRoles.find((r) => r.name === viewRoleName) : null;
  const displayPermissions: PortalGridProps = viewRole
    ? { permissions: viewRole.permissions, category_order: viewRole.category_order }
    : currentPermissions;

  return (
    <>
      {/* 뷰 스위처 — admin 만 표시 */}
      {isAdmin && allRoles.length > 0 && (
        <div className="flex items-center gap-1 mb-10 animate-fade-in flex-wrap"
             style={{ animationFillMode: "forwards", animationDelay: "80ms" }}>
          <span className="text-[11px] font-bold text-sc-dim uppercase tracking-widest mr-3">
            View
          </span>
          <div className="flex items-center gap-1 bg-sc-surface border border-sc-border rounded-xl p-1 flex-wrap">
            {/* 내 뷰 버튼 */}
            <button
              onClick={() => setViewRoleName(null)}
              style={{ transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              className={`relative px-4 py-1.5 rounded-lg text-[11px] font-bold tracking-widest
                ${!viewRoleName ? "bg-sc-green text-sc-bg shadow-sm" : "text-sc-dim hover:text-sc-white"}`}>
              내 뷰
            </button>
            {/* 각 역할 미리보기 */}
            {allRoles.map((r) => {
              const active = viewRoleName === r.name;
              return (
                <button key={r.name} onClick={() => setViewRoleName(active ? null : r.name)}
                  style={{ transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                  className={`relative px-4 py-1.5 rounded-lg text-[11px] font-bold tracking-widest
                    ${active ? "bg-sc-green text-sc-bg shadow-sm" : "text-sc-dim hover:text-sc-white"}`}>
                  {r.label}
                </button>
              );
            })}
          </div>
          {viewRole && (
            <span className="ml-3 text-[11px] text-sc-dim">
              {viewRole.label} 뷰 미리보기
            </span>
          )}
        </div>
      )}

      <PortalGrid
        key={viewRoleName ?? "__me__"}
        permissions={displayPermissions.permissions}
        category_order={displayPermissions.category_order}
      />
    </>
  );
}
