"use client";

import type { ReactNode } from "react";

// Port từ frontend/src/components/ui/CardListItem.jsx — HPCons Design System: Card List
// (Mobile fallback cho <table>, xem 10-data-display/cards.md + 07-responsive).
export function CardListItem({
  children,
  className = "",
  onClick,
  highlight = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-hp-card rounded-hp-lg border ${highlight ? "border-hp-danger/40 bg-hp-danger/5" : "border-hp-border"} p-3 sm:p-4 space-y-2 ${
        onClick ? "cursor-pointer active:bg-hp-elevated transition-colors" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardListRow({ label, value, valueClassName = "" }: { label: string; value: ReactNode; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm min-h-[28px]">
      <span className="text-hp-text-secondary flex-shrink-0">{label}</span>
      <span className={`text-hp-text font-medium text-right truncate ${valueClassName}`}>{value}</span>
    </div>
  );
}

export function CardList({
  loading,
  empty,
  emptyMessage = "Không có dữ liệu",
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (loading) return <div className="py-10 text-center text-hp-text-muted text-sm">Đang tải dữ liệu...</div>;
  if (empty) return <div className="py-10 text-center text-hp-text-muted text-sm">{emptyMessage}</div>;
  return <div className="space-y-3">{children}</div>;
}
