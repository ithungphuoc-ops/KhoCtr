"use client";

/**
 * Bản mobile (thẻ xếp dọc) của bảng "Danh sách hàng hóa" trong modal Tạo/Sửa
 * phiếu nhập/xuất kho — dùng chung cho 4 trang (App Tổng phieu-nhap/phieu-xuat,
 * App Con ct/[id]/nhap-kho/xuat-kho). Bảng gốc dùng cho desktop (`hidden
 * md:block`) không đổi gì; component này chỉ hiện khi `md:hidden`.
 *
 * Mỗi dòng hàng hóa = 1 thẻ: Tên hàng full-width, SL/ĐVT/Đơn giá chia 3 ô
 * nhỏ (`min-h-11` = 44px, đúng chuẩn vùng chạm), nút xoá dòng 44×44px thay
 * cho icon `p-1` quá nhỏ ở bảng gốc.
 */
import { Trash2 } from "lucide-react";
import HangHoaInput from "@/components/HangHoaInput";
import type { HangHoa } from "@/lib/data/hang-hoa";

interface HangHoaCardItem {
  ma_hang?: string;
  ten_hang: string;
  dvt: string;
  so_luong: number | string;
  don_gia: number | string;
  thanh_tien: number | string;
  selected: boolean;
}

export default function HangHoaItemCards<T extends HangHoaCardItem>({
  items,
  hangHoaList,
  isAdmin,
  theme = "blue",
  totalTextClass = "text-hp-accent",
  formatVND,
  onFieldChange,
  onSelectHangHoa,
  onRemove,
}: {
  items: T[];
  hangHoaList: HangHoa[];
  isAdmin: boolean;
  theme?: "blue" | "orange" | "green";
  totalTextClass?: string;
  formatVND: (n: number | string | undefined | null) => string;
  onFieldChange: (index: number, field: "ten_hang" | "so_luong" | "dvt" | "don_gia", value: string) => void;
  onSelectHangHoa: (index: number, hh: HangHoa) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="bg-hp-card border border-hp-border rounded-hp-lg p-3">
          <div className="flex items-start gap-2 mb-2.5">
            <div className="flex-1 min-w-0">
              <HangHoaInput
                value={it.ten_hang}
                onChange={(val) => onFieldChange(i, "ten_hang", val)}
                onSelect={(hh) => onSelectHangHoa(i, hh)}
                hangHoaList={hangHoaList}
                isAdmin={isAdmin}
                theme={theme}
                placeholder="Tên vật tư..."
              />
            </div>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label="Xóa dòng hàng hóa"
                className="min-w-11 min-h-11 flex items-center justify-center flex-shrink-0 text-hp-danger bg-hp-danger/10 hover:bg-hp-danger/20 rounded-hp-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-hp-text-muted font-medium mb-1">SL</label>
              <input
                type="number"
                min="0"
                value={it.so_luong}
                onChange={(e) => onFieldChange(i, "so_luong", e.target.value)}
                className="w-full px-2 min-h-11 bg-hp-surface text-hp-text border border-hp-border rounded-hp-sm text-sm text-right focus:outline-none focus:ring-2 focus:ring-hp-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] text-hp-text-muted font-medium mb-1">ĐVT</label>
              <input
                value={it.dvt}
                onChange={(e) => onFieldChange(i, "dvt", e.target.value)}
                readOnly={!!it.selected}
                className={`w-full px-2 min-h-11 border border-hp-border rounded-hp-sm text-sm focus:outline-none ${it.selected ? "bg-hp-muted/10 text-hp-text-muted" : "bg-hp-surface text-hp-text focus:ring-2 focus:ring-hp-accent"}`}
              />
            </div>
            <div>
              <label className="block text-[10px] text-hp-text-muted font-medium mb-1">Đơn giá</label>
              <input
                type="number"
                min="0"
                value={it.don_gia}
                onChange={(e) => onFieldChange(i, "don_gia", e.target.value)}
                className="w-full px-2 min-h-11 bg-hp-surface text-hp-text border border-hp-border rounded-hp-sm text-sm text-right focus:outline-none focus:ring-2 focus:ring-hp-accent"
              />
            </div>
          </div>
          <div className="flex justify-between items-baseline mt-2.5 pt-2.5 border-t border-hp-border">
            <span className="text-xs text-hp-text-muted">Thành tiền</span>
            <span className={`text-sm font-semibold ${totalTextClass}`}>{formatVND(it.thanh_tien)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
