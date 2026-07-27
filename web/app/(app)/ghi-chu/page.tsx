"use client";

// Port từ frontend/src/pages/GhiChu.jsx.
import { useState, useEffect, useMemo } from "react";
import { LayoutGrid, List, RefreshCw, StickyNote, ChevronDown, ChevronRight } from "lucide-react";
import { getGhiChuList } from "@/lib/api-client";
import { useCongTrinh } from "@/components/CongTrinhProvider";
import GhiChuModule from "@/components/GhiChu/GhiChuModule";
import { TRANG_THAI_MAP } from "@/components/GhiChu/ghiChuConfig";
import type { GhiChu } from "@/lib/data/ghi-chu";
import type { CongTrinh } from "@/lib/data/cong-trinh";

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-hp-card rounded-hp-lg border border-hp-border shadow-sm px-4 py-3 flex items-center gap-3">
      <div className={`w-2 h-8 rounded-full ${color}`} />
      <div>
        <p className="text-xs text-hp-text-muted">{label}</p>
        <p className="text-xl font-bold text-hp-text">{value}</p>
      </div>
    </div>
  );
}

function CTGroup({ ct, items, onExpand, isOpen }: { ct: CongTrinh; items: GhiChu[]; onExpand: () => void; isOpen: boolean }) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const overdue = items.filter((x) => {
    if (!x.deadline || ["hoan_thanh", "huy"].includes(x.trang_thai)) return false;
    const d = new Date(x.deadline.split("T")[0]);
    d.setHours(0, 0, 0, 0);
    return d < now;
  }).length;
  const done = items.filter((x) => x.trang_thai === "hoan_thanh").length;

  const byStatus: Record<string, number> = {};
  Object.keys(TRANG_THAI_MAP).forEach((k) => {
    byStatus[k] = 0;
  });
  items.forEach((x) => {
    if (byStatus[x.trang_thai] !== undefined) byStatus[x.trang_thai]++;
  });

  return (
    <div className="bg-hp-card rounded-hp-lg border border-hp-border shadow-sm overflow-hidden">
      <button onClick={onExpand} className="w-full flex items-center justify-between px-5 py-4 min-h-10 hover:bg-hp-elevated transition-colors">
        <div className="flex items-center gap-3">
          {isOpen ? <ChevronDown className="w-4 h-4 text-hp-primary" /> : <ChevronRight className="w-4 h-4 text-hp-text-muted" />}
          <div className="text-left">
            <p className="font-semibold text-hp-text">{ct.ten_ct}</p>
            <p className="text-xs text-hp-text-muted font-mono">{ct.ma_ct}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {overdue > 0 && <span className="px-2 py-0.5 bg-hp-danger/15 text-hp-danger text-xs font-bold rounded-full animate-pulse">{overdue} quá hạn</span>}
          {done > 0 && <span className="px-2 py-0.5 bg-hp-success/15 text-hp-success text-xs rounded-full">{done} xong</span>}
          <span className="text-sm font-medium text-hp-text-secondary">{items.length} ghi chú</span>
        </div>
      </button>

      {items.length > 0 && (
        <div className="px-5 pb-3 flex gap-1.5 flex-wrap">
          {Object.entries(byStatus)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => (
              <span key={k} className={`text-xs px-2 py-0.5 rounded-full ${TRANG_THAI_MAP[k]?.badge}`}>
                {TRANG_THAI_MAP[k]?.label}: {v}
              </span>
            ))}
        </div>
      )}

      {isOpen && (
        <div className="border-t border-hp-border p-5">
          <GhiChuModule congTrinhId={ct.id} congTrinhList={[]} title="" />
        </div>
      )}
    </div>
  );
}

export default function GhiChuPage() {
  const { congTrinhs, isAdmin, selectedCT } = useCongTrinh();

  const [mode, setMode] = useState<"all" | "by_ct">("all");
  const [allItems, setAllItems] = useState<GhiChu[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCTs, setOpenCTs] = useState<Record<number, boolean>>({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await getGhiChuList({ limit: 500 });
      setAllItems((res.data as { data?: GhiChu[] })?.data || []);
    } catch {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "by_ct") loadAll();
  }, [mode]);

  const globalStats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return {
      total: allItems.length,
      overdue: allItems.filter((x) => {
        if (!x.deadline || ["hoan_thanh", "huy"].includes(x.trang_thai)) return false;
        const d = new Date(x.deadline.split("T")[0]);
        d.setHours(0, 0, 0, 0);
        return d < now;
      }).length,
      hoan_thanh: allItems.filter((x) => x.trang_thai === "hoan_thanh").length,
      mo: allItems.filter((x) => x.trang_thai === "mo").length,
    };
  }, [allItems]);

  const itemsByCT = useMemo(() => {
    const g: Record<number, GhiChu[]> = {};
    allItems.forEach((x) => {
      if (!g[x.cong_trinh_id]) g[x.cong_trinh_id] = [];
      g[x.cong_trinh_id].push(x);
    });
    return g;
  }, [allItems]);

  const congTrinhList = useMemo(() => (isAdmin ? congTrinhs || [] : []), [isAdmin, congTrinhs]);

  const toggleCT = (id: number) => setOpenCTs((p) => ({ ...p, [id]: !p[id] }));

  if (!isAdmin) {
    if (!selectedCT) {
      return (
        <div className="text-center py-16">
          <StickyNote className="w-12 h-12 text-hp-text-disabled mx-auto mb-3" />
          <p className="text-hp-text-muted text-sm">Vui lòng chọn công trình để xem ghi chú.</p>
        </div>
      );
    }
    return <GhiChuModule congTrinhId={selectedCT.id} congTrinhList={[]} title={`GHI CHÚ — ${selectedCT.ten_ct}`} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-hp-text">GHI CHÚ CÔNG VIỆC</h1>
          <p className="text-hp-text-secondary text-sm mt-0.5">Quản lý ghi chú toàn bộ công trình</p>
        </div>
        <div className="flex rounded-hp-md border border-hp-border overflow-hidden">
          <button onClick={() => setMode("all")} className={`flex items-center gap-1.5 px-4 py-2 min-h-10 text-sm font-medium transition-colors ${mode === "all" ? "bg-hp-primary text-white" : "text-hp-text-secondary hover:bg-hp-elevated"}`}>
            <LayoutGrid className="w-4 h-4" /> Tất cả
          </button>
          <button onClick={() => setMode("by_ct")} className={`flex items-center gap-1.5 px-4 py-2 min-h-10 text-sm font-medium transition-colors ${mode === "by_ct" ? "bg-hp-primary text-white" : "text-hp-text-secondary hover:bg-hp-elevated"}`}>
            <List className="w-4 h-4" /> Theo CT
          </button>
        </div>
      </div>

      {mode === "all" && <GhiChuModule congTrinhId={null} congTrinhList={congTrinhList} title="" />}

      {mode === "by_ct" && (
        <div className="space-y-4">
          {!loading && allItems.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Tổng ghi chú" value={globalStats.total} color="bg-hp-nav" />
              <StatCard label="Đang mở" value={globalStats.mo} color="bg-hp-accent" />
              <StatCard label="Hoàn thành" value={globalStats.hoan_thanh} color="bg-hp-success" />
              <StatCard label="Quá hạn" value={globalStats.overdue} color="bg-hp-danger" />
            </div>
          )}
          {loading ? (
            <div className="text-center py-16 text-hp-text-muted">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p className="text-sm">Đang tải...</p>
            </div>
          ) : congTrinhs.length === 0 ? (
            <div className="text-center py-16">
              <StickyNote className="w-12 h-12 text-hp-text-disabled mx-auto mb-3" />
              <p className="text-hp-text-muted text-sm">Không có công trình nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {congTrinhs.map((ct) => (
                <CTGroup key={ct.id} ct={ct} items={itemsByCT[ct.id] || []} isOpen={!!openCTs[ct.id]} onExpand={() => toggleCT(ct.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
