"use client";

// Port từ frontend/src/components/GhiChu/GhiChuForm.jsx — form tạo/chỉnh sửa ghi chú.
import { useState } from "react";
import { X, Save } from "lucide-react";
import { MAU_MAP, MAU_OPTIONS, UU_TIEN_OPTIONS, TRANG_THAI_OPTIONS } from "./ghiChuConfig";
import type { GhiChu } from "@/lib/data/ghi-chu";
import type { CongTrinh } from "@/lib/data/cong-trinh";

function errDetail(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: string } } };
  return e.response?.data?.detail || fallback;
}

export default function GhiChuForm({
  congTrinhId,
  congTrinhList = [],
  initial,
  onSave,
  onCancel,
}: {
  congTrinhId: number | null;
  congTrinhList?: CongTrinh[];
  initial: GhiChu | null;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    cong_trinh_id: initial?.cong_trinh_id ?? congTrinhId ?? "",
    tieu_de: initial?.tieu_de ?? "",
    noi_dung: initial?.noi_dung ?? "",
    mau: initial?.mau ?? "warning",
    uu_tien: initial?.uu_tien ?? "binh_thuong",
    trang_thai: initial?.trang_thai ?? "mo",
    deadline: initial?.deadline ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tieu_de.trim()) {
      setErr("Tiêu đề không được để trống.");
      return;
    }
    if (!form.cong_trinh_id) {
      setErr("Phải chọn công trình.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const payload = {
        cong_trinh_id: Number(form.cong_trinh_id),
        tieu_de: form.tieu_de.trim(),
        noi_dung: form.noi_dung,
        mau: form.mau,
        uu_tien: form.uu_tien,
        trang_thai: form.trang_thai,
        deadline: form.deadline || null,
      };
      await onSave(payload);
    } catch (ex) {
      setErr(errDetail(ex, "Lưu thất bại. Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  };

  const mauStyle = MAU_MAP[form.mau];

  return (
    <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-hp-elevated rounded-hp-xl shadow-md w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-hp-border">
          <h2 className="font-semibold text-hp-text">{isEdit ? "Chỉnh sửa ghi chú" : "Thêm ghi chú mới"}</h2>
          <button onClick={onCancel} className="p-1 hover:bg-hp-surface rounded-hp-sm text-hp-text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {congTrinhList.length > 0 && !congTrinhId && (
            <div>
              <label className="block text-xs font-medium text-hp-text-secondary mb-1">Công trình *</label>
              <select value={form.cong_trinh_id} onChange={(e) => set("cong_trinh_id", e.target.value)} className="w-full border border-hp-border rounded-hp-md px-3 py-2 min-h-10 text-sm bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent">
                <option value="">-- Chọn công trình --</option>
                {congTrinhList.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.ten_ct}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-hp-text-secondary mb-1">Tiêu đề *</label>
            <input
              value={form.tieu_de}
              onChange={(e) => set("tieu_de", e.target.value)}
              placeholder="Nhập tiêu đề ghi chú..."
              className="w-full border border-hp-border rounded-hp-md px-3 py-2 min-h-10 text-sm bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-hp-text-secondary mb-1">Nội dung</label>
            <textarea
              value={form.noi_dung}
              onChange={(e) => set("noi_dung", e.target.value)}
              placeholder="Mô tả chi tiết..."
              rows={4}
              className="w-full border border-hp-border rounded-hp-md px-3 py-2 text-sm bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-hp-text-secondary mb-1">Màu</label>
              <select value={form.mau} onChange={(e) => set("mau", e.target.value)} className="w-full border border-hp-border rounded-hp-md px-2 py-2 min-h-10 text-xs bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent">
                {MAU_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-hp-text-secondary mb-1">Ưu tiên</label>
              <select value={form.uu_tien} onChange={(e) => set("uu_tien", e.target.value)} className="w-full border border-hp-border rounded-hp-md px-2 py-2 min-h-10 text-xs bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent">
                {UU_TIEN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-hp-text-secondary mb-1">Trạng thái</label>
              <select value={form.trang_thai} onChange={(e) => set("trang_thai", e.target.value)} className="w-full border border-hp-border rounded-hp-md px-2 py-2 min-h-10 text-xs bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent">
                {TRANG_THAI_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-hp-text-secondary mb-1">Deadline</label>
            <div className="flex items-center gap-2">
              <input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} className="flex-1 border border-hp-border rounded-hp-md px-3 py-2 min-h-10 text-sm bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
              {form.deadline && (
                <button type="button" onClick={() => set("deadline", "")} className="text-hp-text-muted hover:text-hp-text-secondary">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className={`rounded-hp-md border-2 p-3 ${mauStyle.bg} ${mauStyle.border}`}>
            <p className="text-xs text-hp-text-muted mb-1">Preview:</p>
            <p className="text-sm font-medium text-hp-text">{form.tieu_de || "(tiêu đề)"}</p>
            {form.noi_dung && <p className="text-xs text-hp-text-secondary mt-1 line-clamp-2">{form.noi_dung}</p>}
          </div>

          {err && <p className="text-sm text-hp-danger bg-hp-danger/10 rounded-hp-sm px-3 py-2">{err}</p>}
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-hp-border">
          <button type="button" onClick={onCancel} className="px-4 py-2 min-h-10 text-sm text-hp-text-secondary hover:text-hp-text hover:bg-hp-surface rounded-hp-md transition-colors">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-5 py-2 min-h-10 bg-hp-primary hover:bg-hp-primary/90 text-white text-sm font-medium rounded-hp-md disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm ghi chú"}
          </button>
        </div>
      </div>
    </div>
  );
}
