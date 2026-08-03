"use client";

/**
 * Popup xem ảnh lớn ngay trong trang (không chuyển tab) + nút tải xuống.
 * Dùng chung cho cột "Hình ảnh" (AnhLinkList) và khu vực upload (AnhChungTuPhieu).
 * Ảnh phục vụ qua /api/files/... (cùng domain app) nên thuộc tính `download`
 * trên <a> hoạt động đúng, không cần fetch/blob thủ công.
 */
import { Download, X } from "lucide-react";

export default function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-6" onClick={onClose}>
      <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh động từ R2, không dùng next/image */}
        <img src={url} alt="Ảnh chứng từ (xem lớn)" className="max-w-full max-h-[85vh] rounded-hp-md" />
        <div className="absolute top-2 right-2 flex gap-2">
          <a
            href={url}
            download
            title="Tải ảnh xuống"
            className="p-2 bg-black/60 hover:bg-hp-accent rounded-full text-white transition-colors"
          >
            <Download className="w-4 h-4" />
          </a>
          <button onClick={onClose} title="Đóng" className="p-2 bg-black/60 hover:bg-hp-danger rounded-full text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
