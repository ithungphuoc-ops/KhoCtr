"use client";

// Port từ frontend/src/components/GhiChu/GhiChuList.jsx — render danh sách ghi chú
// theo 2 chế độ: 'kanban' (5 cột theo trạng thái) hoặc 'list' (grid card).
import { StickyNote } from "lucide-react";
import GhiChuItem from "./GhiChuItem";
import { TRANG_THAI_ORDER, TRANG_THAI_MAP } from "./ghiChuConfig";
import type { GhiChu } from "@/lib/data/ghi-chu";

export default function GhiChuList({
  items = [],
  viewMode = "kanban",
  showCT = false,
  congTrinhMap = {},
  onEdit,
  onDelete,
  onComplete,
  onDetail,
}: {
  items?: GhiChu[];
  viewMode?: "kanban" | "list";
  showCT?: boolean;
  congTrinhMap?: Record<number, string>;
  onEdit?: (item: GhiChu) => void;
  onDelete?: (id: number) => void;
  onComplete?: (id: number) => void;
  onDetail?: (item: GhiChu) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <StickyNote className="w-12 h-12 text-hp-text-disabled mx-auto mb-3" />
        <p className="text-hp-text-muted text-sm">Chưa có ghi chú nào</p>
      </div>
    );
  }

  if (viewMode === "kanban") {
    const grouped: Record<string, GhiChu[]> = {};
    TRANG_THAI_ORDER.forEach((k) => {
      grouped[k] = [];
    });
    items.forEach((x) => {
      if (grouped[x.trang_thai]) grouped[x.trang_thai].push(x);
      else grouped.mo.push(x);
    });

    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TRANG_THAI_ORDER.map((status) => {
          const col = TRANG_THAI_MAP[status];
          const colItems = grouped[status] || [];
          return (
            <div key={status} className="flex-shrink-0 w-64">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${col.badge}`}>{col.label}</span>
                <span className="text-xs text-hp-text-muted font-medium">{colItems.length}</span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {colItems.map((item) => (
                  <GhiChuItem key={item.id} item={item} showCT={showCT} congTrinhMap={congTrinhMap} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} onDetail={onDetail} />
                ))}
                {colItems.length === 0 && (
                  <div className="border-2 border-dashed border-hp-border rounded-hp-lg h-16 flex items-center justify-center">
                    <span className="text-xs text-hp-text-muted">Trống</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map((item) => (
        <GhiChuItem key={item.id} item={item} showCT={showCT} congTrinhMap={congTrinhMap} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} onDetail={onDetail} />
      ))}
    </div>
  );
}
