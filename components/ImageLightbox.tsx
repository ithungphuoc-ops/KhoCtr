"use client";

/**
 * Popup xem ảnh/PDF lớn ngay trong trang (không chuyển tab) + nút tải xuống.
 * Dùng chung cho cột "Hình ảnh" (AnhLinkList) và khu vực upload (AnhChungTuPhieu).
 * File phục vụ qua /api/files/... (cùng domain app) nên thuộc tính `download`
 * trên <a> hoạt động đúng, không cần fetch/blob thủ công.
 *
 * PDF nhúng bằng <iframe> — trình duyệt tự hiển thị khung xem PDF gốc (có
 * zoom/cuộn trang sẵn) ngay trong popup, không cần thư viện dựng hình PDF
 * nào cả (khác hẳn việc "nén PDF" — đây chỉ là hiển thị, không xử lý file).
 */
import { Download, X } from "lucide-react";

const isPdfUrl = (url: string) => url.toLowerCase().endsWith(".pdf");

export default function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const isPdf = isPdfUrl(url);

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-6" onClick={onClose}>
      <div className={"relative " + (isPdf ? "w-[90vw] h-[85vh] max-w-4xl" : "max-w-full max-h-full")} onClick={(e) => e.stopPropagation()}>
        {isPdf ? (
          <iframe src={url} title="Xem PDF chứng từ" className="w-full h-full rounded-hp-md bg-white" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh động từ R2, không dùng next/image
          <img src={url} alt="Ảnh chứng từ (xem lớn)" className="max-w-full max-h-[85vh] rounded-hp-md" />
        )}
        <div className="absolute top-2 right-2 flex gap-2">
          <a
            href={url}
            download
            title="Tải xuống"
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
