"use client";

// Port từ frontend/src/components/BatchPhieuPopup.jsx — Xác nhận nhiều phiếu cùng lúc sau khi AI đọc.
import { Fragment, useEffect, useState } from "react";
import { X, CheckCircle, ChevronDown, ChevronRight, Loader, PlusCircle, Check } from "lucide-react";
import { createHangHoa } from "@/lib/api-client";

const TAB_COLOR: Record<string, string> = {
  green: "text-hp-success",
  yellow: "text-hp-warning",
  red: "text-hp-danger",
};

export interface BatchItemRaw {
  ten_hang?: string;
  dvt?: string;
  so_luong?: number;
  don_gia?: number;
  thanh_tien?: number;
  _match?: { ten_chuan?: string; ten_ai_raw?: string };
}

export interface MatchResult {
  green: BatchItemRaw[];
  yellow: BatchItemRaw[];
  red: BatchItemRaw[];
}

export interface BatchPhieuHeader {
  so_phieu: string;
  ngay: string;
  doi_tac: string;
  ghi_chu: string;
}

export interface BatchPhieuInput {
  header: BatchPhieuHeader;
  matchResult: MatchResult;
}

interface EditableBatchItem {
  ten_hang: string;
  dvt: string;
  so_luong: number;
  don_gia: number;
  thanh_tien: number;
  _tab: "green" | "yellow" | "red";
}

interface LocalPhieu {
  header: BatchPhieuHeader;
  items: EditableBatchItem[];
}

export interface SavedBatchPhieu {
  header: BatchPhieuHeader;
  items: EditableBatchItem[];
}

function flattenMatch(matchResult: MatchResult | undefined): EditableBatchItem[] {
  if (!matchResult) return [];
  const toItem = (it: BatchItemRaw, tab: "green" | "yellow" | "red"): EditableBatchItem => ({
    ten_hang: it._match?.ten_chuan || it.ten_hang || it._match?.ten_ai_raw || "",
    dvt: it.dvt || "cái",
    so_luong: it.so_luong ?? 0,
    don_gia: it.don_gia ?? 0,
    thanh_tien: it.thanh_tien ?? (it.so_luong || 0) * (it.don_gia || 0),
    _tab: tab,
  });
  return [
    ...(matchResult.green || []).map((it) => toItem(it, "green")),
    ...(matchResult.yellow || []).map((it) => toItem(it, "yellow")),
    ...(matchResult.red || []).map((it) => toItem(it, "red")),
  ];
}

const fmt = (n?: number) => (n ?? 0).toLocaleString("vi-VN");

export function BatchPhieuPopup({
  isOpen,
  onClose,
  phieus,
  onSaveAll,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  phieus: BatchPhieuInput[];
  onSaveAll: (local: SavedBatchPhieu[]) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState<LocalPhieu[]>(() => (phieus || []).map((p) => ({ header: { ...p.header }, items: flattenMatch(p.matchResult) })));
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));
  const [creatingItem, setCreatingItem] = useState<{ pIdx: number; iIdx: number } | null>(null);
  const [createForm, setCreateForm] = useState({ ma_hang: "", ten_hang: "", dvt: "", nhom: "" });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  useEffect(() => {
    if (!phieus?.length) return;
    setLocal((phieus || []).map((p) => ({ header: { ...p.header }, items: flattenMatch(p.matchResult) })));
    setExpanded(new Set([0]));
  }, [phieus]);

  if (!isOpen) return null;

  const openCreate = (pIdx: number, iIdx: number) => {
    const it = local[pIdx].items[iIdx];
    setCreatingItem({ pIdx, iIdx });
    setCreateForm({ ma_hang: "", ten_hang: it.ten_hang || "", dvt: it.dvt || "cái", nhom: "" });
    setCreateErr(null);
  };

  const handleCreateHangHoa = async () => {
    if (!createForm.ma_hang.trim() || !createForm.ten_hang.trim()) {
      setCreateErr("Mã hàng và Tên hàng là bắt buộc");
      return;
    }
    setCreating(true);
    setCreateErr(null);
    try {
      await createHangHoa({
        ma_hang: createForm.ma_hang.trim().toUpperCase(),
        ten_hang: createForm.ten_hang.trim(),
        dvt: createForm.dvt.trim() || "cái",
        nhom: createForm.nhom.trim() || "",
      });
      const { pIdx, iIdx } = creatingItem!;
      setLocal((prev) =>
        prev.map((p, pi) =>
          pi !== pIdx
            ? p
            : {
                ...p,
                items: p.items.map((it, ii) => (ii !== iIdx ? it : { ...it, ten_hang: createForm.ten_hang.trim(), dvt: createForm.dvt.trim() || it.dvt, _tab: "green" as const })),
              },
        ),
      );
      setCreatingItem(null);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setCreateErr(err.response?.data?.detail || err.message || "Lỗi tạo mặt hàng");
    } finally {
      setCreating(false);
    }
  };

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const updateHeader = (pIdx: number, field: keyof BatchPhieuHeader, val: string) =>
    setLocal((prev) => prev.map((p, i) => (i === pIdx ? { ...p, header: { ...p.header, [field]: val } } : p)));

  const updateItem = (pIdx: number, iIdx: number, field: "ten_hang" | "dvt" | "so_luong" | "don_gia", val: string) => {
    setLocal((prev) =>
      prev.map((p, i) => {
        if (i !== pIdx) return p;
        const items = p.items.map((it, j) => {
          if (j !== iIdx) return it;
          const updated = { ...it, [field]: field === "ten_hang" || field === "dvt" ? val : parseFloat(val) || 0 } as EditableBatchItem;
          if (field === "so_luong" || field === "don_gia") {
            const sl = field === "so_luong" ? parseFloat(val) || 0 : it.so_luong;
            const dg = field === "don_gia" ? parseFloat(val) || 0 : it.don_gia;
            updated.thanh_tien = sl * dg;
          }
          return updated;
        });
        return { ...p, items };
      }),
    );
  };

  const removeItem = (pIdx: number, iIdx: number) => setLocal((prev) => prev.map((p, i) => (i !== pIdx ? p : { ...p, items: p.items.filter((_, j) => j !== iIdx) })));

  const totalPhieu = local.length;
  const totalItems = local.reduce((s, p) => s + p.items.length, 0);
  const redCount = local.reduce((s, p) => s + p.items.filter((it) => it._tab === "red").length, 0);

  return (
    <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-hp-elevated border border-hp-border rounded-hp-xl shadow-md w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-hp-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-hp-lg bg-hp-primary/15 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-hp-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-hp-text">Xác nhận {totalPhieu} phiếu từ AI</h2>
              <p className="text-xs text-hp-text-muted mt-0.5">
                {totalItems} dòng hàng
                {redCount > 0 && <span className="ml-2 text-hp-danger">{redCount} dòng chưa khớp — kiểm tra trước khi lưu</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-hp-md hover:bg-hp-card text-hp-text-muted hover:text-hp-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {local.map((p, pIdx) => {
            const isOpen = expanded.has(pIdx);
            const gCnt = p.items.filter((it) => it._tab === "green").length;
            const yCnt = p.items.filter((it) => it._tab === "yellow").length;
            const rCnt = p.items.filter((it) => it._tab === "red").length;
            const tongTien = p.items.reduce((s, it) => s + (it.thanh_tien || 0), 0);

            return (
              <div key={pIdx} className="border border-hp-border rounded-hp-lg overflow-hidden">
                <button onClick={() => toggleExpand(pIdx)} className="w-full flex items-center gap-3 px-4 py-3 bg-hp-card hover:bg-hp-elevated text-left">
                  <span className="text-hp-text-muted">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
                  <span className="font-semibold text-hp-primary text-sm w-24 shrink-0">{p.header.so_phieu || <span className="text-hp-danger">Chưa có số phiếu</span>}</span>
                  <span className="text-xs text-hp-text-secondary w-24 shrink-0">{p.header.ngay || ""}</span>
                  <span className="text-xs text-hp-text-secondary flex-1 truncate">{p.header.doi_tac || "—"}</span>
                  <div className="flex gap-1.5 shrink-0">
                    {gCnt > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-hp-success/15 text-hp-success">{gCnt} ✓</span>}
                    {yCnt > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-hp-warning/15 text-hp-warning">{yCnt} ?</span>}
                    {rCnt > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-hp-danger/15 text-hp-danger">{rCnt} mới</span>}
                  </div>
                  <span className="text-sm font-bold text-hp-primary ml-2 shrink-0">{(tongTien / 1_000_000).toFixed(1)}tr</span>
                </button>

                {isOpen && (
                  <div className="border-t border-hp-border p-4 space-y-3 bg-hp-elevated">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(
                        [
                          { field: "so_phieu" as const, label: "Số phiếu *", placeholder: "NK-001" },
                          { field: "ngay" as const, label: "Ngày", type: "date" },
                          { field: "doi_tac" as const, label: "NCC", placeholder: "Nhà cung cấp" },
                          { field: "ghi_chu" as const, label: "Ghi chú", placeholder: "—" },
                        ]
                      ).map(({ field, label, placeholder, type }) => (
                        <div key={field}>
                          <label className="text-xs text-hp-text-muted">{label}</label>
                          <input
                            type={type || "text"}
                            value={p.header[field] || ""}
                            onChange={(e) => updateHeader(pIdx, field, e.target.value)}
                            placeholder={placeholder}
                            className="mt-1 w-full border border-hp-border rounded-hp-sm px-2 py-1.5 text-xs bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-accent"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[520px]">
                        <thead>
                          <tr className="text-hp-text-muted uppercase">
                            <th className="text-left py-1 w-5">#</th>
                            <th className="text-left py-1">Tên hàng</th>
                            <th className="text-right py-1 w-20">SL</th>
                            <th className="text-left py-1 w-14">DVT</th>
                            <th className="text-right py-1 w-24">Đơn giá</th>
                            <th className="text-right py-1 w-24">Thành tiền</th>
                            <th className="w-5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((it, iIdx) => (
                            <Fragment key={iIdx}>
                              <tr className="border-t border-hp-border hover:bg-hp-card">
                                <td className="py-1 text-hp-text-muted">{iIdx + 1}</td>
                                <td className="py-1 pr-2">
                                  <input
                                    value={it.ten_hang}
                                    onChange={(e) => updateItem(pIdx, iIdx, "ten_hang", e.target.value)}
                                    className={`w-full border border-hp-border rounded px-2 py-0.5 bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-accent ${TAB_COLOR[it._tab]}`}
                                  />
                                </td>
                                <td className="py-1 pr-1">
                                  <input type="number" value={it.so_luong} onChange={(e) => updateItem(pIdx, iIdx, "so_luong", e.target.value)} className="w-full border border-hp-border rounded px-1 py-0.5 text-right bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-accent" />
                                </td>
                                <td className="py-1 pr-1">
                                  <input value={it.dvt} onChange={(e) => updateItem(pIdx, iIdx, "dvt", e.target.value)} className="w-full border border-hp-border rounded px-1 py-0.5 bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-accent" />
                                </td>
                                <td className="py-1 pr-1">
                                  <input type="number" value={it.don_gia} onChange={(e) => updateItem(pIdx, iIdx, "don_gia", e.target.value)} className="w-full border border-hp-border rounded px-1 py-0.5 text-right bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-accent" />
                                </td>
                                <td className="py-1 pr-1 text-right font-medium text-hp-text-secondary">{fmt(it.thanh_tien)}</td>
                                <td className="py-1">
                                  <div className="flex items-center gap-0.5">
                                    {it._tab === "red" && (
                                      <button onClick={() => openCreate(pIdx, iIdx)} title="Tạo vào danh mục" className="text-hp-text-disabled hover:text-hp-primary p-0.5 rounded">
                                        <PlusCircle className="w-3 h-3" />
                                      </button>
                                    )}
                                    <button onClick={() => removeItem(pIdx, iIdx)} className="text-hp-text-disabled hover:text-hp-danger p-0.5 rounded">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {creatingItem?.pIdx === pIdx && creatingItem?.iIdx === iIdx && (
                                <tr className="bg-hp-primary/5 border-t border-hp-primary/20">
                                  <td colSpan={7} className="px-3 py-2">
                                    <div className="flex flex-col gap-1.5">
                                      <p className="text-xs font-medium text-hp-primary">Tạo mặt hàng vào danh mục</p>
                                      <div className="flex gap-2 flex-wrap items-end">
                                        {(
                                          [
                                            { key: "ma_hang" as const, label: "Mã hàng *", w: "w-24", ph: "MM-001" },
                                            { key: "ten_hang" as const, label: "Tên hàng *", w: "flex-1 min-w-32", ph: "Tên chuẩn" },
                                            { key: "dvt" as const, label: "DVT", w: "w-16", ph: "cái" },
                                            { key: "nhom" as const, label: "Nhóm", w: "w-24", ph: "Thiết bị" },
                                          ]
                                        ).map(({ key, label, w, ph }) => (
                                          <div key={key} className={`flex flex-col gap-0.5 ${w}`}>
                                            <label className="text-xs text-hp-text-muted">{label}</label>
                                            <input
                                              value={createForm[key]}
                                              onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                                              placeholder={ph}
                                              className="border border-hp-border rounded px-2 py-0.5 text-xs bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-primary"
                                            />
                                          </div>
                                        ))}
                                        <div className="flex gap-1">
                                          <button onClick={handleCreateHangHoa} disabled={creating} className="px-3 py-1 bg-hp-primary text-white rounded text-xs font-medium hover:bg-hp-primary/90 disabled:opacity-50 flex items-center gap-1 min-h-[26px]">
                                            {creating ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Lưu
                                          </button>
                                          <button
                                            onClick={() => {
                                              setCreatingItem(null);
                                              setCreateErr(null);
                                            }}
                                            className="px-3 py-1 border border-hp-border rounded text-xs text-hp-text-secondary hover:bg-hp-card min-h-[26px]"
                                          >
                                            Bỏ
                                          </button>
                                        </div>
                                      </div>
                                      {createErr && <p className="text-xs text-hp-danger">{createErr}</p>}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-hp-border">
                            <td colSpan={5} className="py-1 font-medium text-hp-text-secondary">
                              Tổng tiền
                            </td>
                            <td className="py-1 text-right font-bold text-hp-primary">{fmt(tongTien)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-hp-border bg-hp-card rounded-b-hp-xl">
          <div className="text-xs text-hp-text-muted">
            <span className="font-medium text-hp-text">{totalPhieu}</span> phiếu · <span className="font-medium text-hp-text">{totalItems}</span> dòng hàng
            {redCount > 0 && <span className="ml-2 text-hp-danger">· {redCount} dòng đỏ cần kiểm tra</span>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 min-h-10 border border-hp-border rounded-hp-md text-sm text-hp-text-secondary hover:bg-hp-elevated">
              Hủy
            </button>
            <button onClick={() => onSaveAll(local)} disabled={saving} className="px-6 min-h-10 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50 flex items-center gap-2">
              {saving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" /> Đang lưu...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Lưu {totalPhieu} phiếu
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
