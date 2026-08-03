"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, RefreshCw, RotateCcw, AlertTriangle, Building2 } from "lucide-react";
import { getPhieuTrash, restorePhieu, purgePhieuVinhVien } from "@/lib/api-client";
import { useCongTrinh } from "@/components/CongTrinhProvider";
import { useAuth } from "@/components/SessionProvider";
import { CardList, CardListItem, CardListRow } from "@/components/ui/CardListItem";
import type { Phieu } from "@/lib/data/phieu";

const RETENTION_DAYS = 30;

function formatVND(n: number | undefined | null) {
  return (n ?? 0).toLocaleString("vi-VN");
}

function daysLeft(deletedAt?: string | null): number {
  if (!deletedAt) return 0;
  const elapsedMs = Date.now() - new Date(deletedAt).getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(0, RETENTION_DAYS - elapsedDays);
}

export default function ThungRacPage() {
  const { congTrinhs } = useCongTrinh();
  const { user } = useAuth();
  const isAdmin = user.role === "admin";

  const [rows, setRows] = useState<Phieu[]>([]);
  const [loading, setLoading] = useState(true);
  const [loai, setLoai] = useState<"" | "NK" | "XK">("");
  const [congTrinhId, setCongTrinhId] = useState<number | "">("");
  const [confirmPurge, setConfirmPurge] = useState<Phieu | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const ctMap = Object.fromEntries(congTrinhs.map((c) => [c.id, c.ten_ct]));

  const loadData = useCallback(() => {
    setLoading(true);
    getPhieuTrash({ loai: loai || undefined, cong_trinh_id: congTrinhId || undefined })
      .then((res) => setRows(((res.data as { data?: Phieu[] })?.data || []) as Phieu[]))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [loai, congTrinhId]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const handleRestore = async (p: Phieu) => {
    setBusyId(p.id);
    setMsg(null);
    try {
      await restorePhieu(p.id);
      setMsg({ type: "ok", text: `Đã khôi phục phiếu ${p.so_phieu}.` });
      loadData();
    } catch {
      setMsg({ type: "err", text: "Khôi phục thất bại. Thử lại." });
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async () => {
    if (!confirmPurge) return;
    setBusyId(confirmPurge.id);
    setMsg(null);
    try {
      await purgePhieuVinhVien(confirmPurge.id);
      setMsg({ type: "ok", text: `Đã xóa vĩnh viễn phiếu ${confirmPurge.so_phieu}.` });
      setConfirmPurge(null);
      loadData();
    } catch {
      setMsg({ type: "err", text: "Xóa vĩnh viễn thất bại. Thử lại." });
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-hp-text-secondary">
        <Trash2 className="w-12 h-12 mx-auto mb-3 text-hp-border" />
        <p className="font-medium">Chức năng dành riêng cho Admin.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-hp-danger/15 rounded-hp-lg flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-hp-danger" />
          </div>
          <div>
            <h1 className="text-base font-bold text-hp-text">Thùng rác</h1>
            <p className="text-xs text-hp-text-muted">Phiếu đã xóa — tự động xóa vĩnh viễn sau {RETENTION_DAYS} ngày nếu không khôi phục</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 text-xs text-hp-text-secondary hover:text-hp-text px-3 min-h-10 rounded-hp-lg hover:bg-hp-elevated transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={loai}
          onChange={(e) => setLoai(e.target.value as "" | "NK" | "XK")}
          className="px-3 min-h-10 bg-hp-card text-hp-text border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent"
        >
          <option value="">Tất cả loại</option>
          <option value="NK">Nhập kho</option>
          <option value="XK">Xuất kho</option>
        </select>
        <select
          value={congTrinhId}
          onChange={(e) => setCongTrinhId(e.target.value ? Number(e.target.value) : "")}
          className="px-3 min-h-10 bg-hp-card text-hp-text border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent"
        >
          <option value="">Tất cả công trình</option>
          {congTrinhs.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.ten_ct}
            </option>
          ))}
        </select>
      </div>

      {msg && (
        <div className={`p-3 rounded-hp-lg text-sm ${msg.type === "ok" ? "bg-hp-success/15 text-hp-success" : "bg-hp-danger/15 text-hp-danger"}`}>{msg.text}</div>
      )}

      <div className="hidden md:block border border-hp-border rounded-hp-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-hp-surface">
            <tr>
              <th className="text-left px-3 py-2 text-hp-text-secondary font-medium">Số phiếu</th>
              <th className="text-left px-3 py-2 text-hp-text-secondary font-medium">Loại</th>
              <th className="text-left px-3 py-2 text-hp-text-secondary font-medium">Công trình</th>
              <th className="text-left px-3 py-2 text-hp-text-secondary font-medium">Ngày</th>
              <th className="text-left px-3 py-2 text-hp-text-secondary font-medium">Người xóa</th>
              <th className="text-right px-3 py-2 text-hp-text-secondary font-medium">Tổng tiền</th>
              <th className="text-center px-3 py-2 text-hp-text-secondary font-medium">Còn lại</th>
              <th className="text-center px-3 py-2 text-hp-text-secondary font-medium">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-hp-text-muted">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-hp-text-muted">
                  Thùng rác trống
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-t border-hp-border">
                  <td className="px-3 py-2 font-mono font-medium text-hp-text">{p.so_phieu}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.loai === "NK" ? "bg-hp-accent/15 text-hp-accent" : "bg-hp-warning/15 text-hp-warning"}`}>
                      {p.loai === "NK" ? "Nhập" : "Xuất"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-hp-text-secondary text-xs">{ctMap[p.cong_trinh_id] || "—"}</td>
                  <td className="px-3 py-2 text-hp-text-secondary text-xs">{p.ngay}</td>
                  <td className="px-3 py-2 text-hp-text-secondary text-xs">{p.deleted_by || "—"}</td>
                  <td className="px-3 py-2 text-right font-medium text-hp-text">{formatVND(p.tong_tien)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs text-hp-warning font-medium">{daysLeft(p.deleted_at)} ngày</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleRestore(p)}
                        disabled={busyId === p.id}
                        title="Khôi phục"
                        className="flex items-center gap-1 px-2 min-h-9 text-xs text-hp-success bg-hp-success/10 hover:bg-hp-success/20 rounded-hp-md disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                      </button>
                      <button
                        onClick={() => setConfirmPurge(p)}
                        disabled={busyId === p.id}
                        title="Xóa vĩnh viễn"
                        className="flex items-center gap-1 px-2 min-h-9 text-xs text-hp-danger bg-hp-danger/10 hover:bg-hp-danger/20 rounded-hp-md disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa vĩnh viễn
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <CardList loading={loading} empty={rows.length === 0} emptyMessage="Thùng rác trống">
          {rows.map((p) => (
            <CardListItem key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-hp-text">{p.so_phieu}</div>
                  <div className="flex items-center gap-1 text-xs text-hp-text-muted mt-0.5">
                    <Building2 className="w-3 h-3" /> {ctMap[p.cong_trinh_id] || "—"}
                  </div>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${p.loai === "NK" ? "bg-hp-accent/15 text-hp-accent" : "bg-hp-warning/15 text-hp-warning"}`}>
                  {p.loai === "NK" ? "Nhập" : "Xuất"}
                </span>
              </div>
              <CardListRow label="Ngày" value={p.ngay} />
              <CardListRow label="Người xóa" value={p.deleted_by || "—"} />
              <CardListRow label="Tổng tiền" value={formatVND(p.tong_tien)} />
              <CardListRow label="Còn lại" value={`${daysLeft(p.deleted_at)} ngày`} valueClassName="text-hp-warning" />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleRestore(p)}
                  disabled={busyId === p.id}
                  className="flex-1 flex items-center justify-center gap-1 min-h-10 text-sm text-hp-success bg-hp-success/10 hover:bg-hp-success/20 rounded-hp-md disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" /> Khôi phục
                </button>
                <button
                  onClick={() => setConfirmPurge(p)}
                  disabled={busyId === p.id}
                  className="flex-1 flex items-center justify-center gap-1 min-h-10 text-sm text-hp-danger bg-hp-danger/10 hover:bg-hp-danger/20 rounded-hp-md disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Xóa vĩnh viễn
                </button>
              </div>
            </CardListItem>
          ))}
        </CardList>
      </div>

      {confirmPurge && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-md w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-hp-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-hp-text">Xóa vĩnh viễn phiếu {confirmPurge.so_phieu}?</h3>
                <p className="text-sm text-hp-text-secondary mt-1">
                  Không thể khôi phục sau khi xóa — bao gồm cả ảnh/PDF chứng từ kèm theo (nếu có).
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmPurge(null)} className="px-4 min-h-10 border border-hp-border text-hp-text-secondary rounded-hp-md text-sm hover:bg-hp-elevated">
                Hủy
              </button>
              <button
                onClick={handlePurge}
                disabled={busyId === confirmPurge.id}
                className="px-4 min-h-10 bg-hp-danger hover:bg-hp-danger/90 text-white rounded-hp-md text-sm font-medium disabled:opacity-50"
              >
                {busyId === confirmPurge.id ? "Đang xóa..." : "Xóa vĩnh viễn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
