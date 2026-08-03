"use client";

/**
 * Danh sách link ảnh/PDF chứng từ của 1 phiếu — dùng trong cột "Hình ảnh"
 * của bảng danh sách (desktop). Ảnh: mở ngay trong trang (ImageLightbox),
 * không chuyển tab. PDF: mở tab mới bằng trình xem PDF gốc của trình duyệt
 * (ImageLightbox chỉ vẽ được ảnh, không nhúng PDF).
 */
import { useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";

const isPdfUrl = (url: string) => url.toLowerCase().endsWith(".pdf");

export default function AnhLinkList({ urls }: { urls: string[] | undefined }) {
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  if (!urls || urls.length === 0) {
    return <span className="text-hp-text-muted">—</span>;
  }
  return (
    <>
      <div className="flex flex-col gap-0.5">
        {urls.map((url, i) =>
          isPdfUrl(url) ? (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-hp-danger hover:underline text-xs whitespace-nowrap"
            >
              PDF {i + 1}
            </a>
          ) : (
            <button
              key={url}
              onClick={() => setOpenUrl(url)}
              className="text-hp-accent hover:underline text-xs whitespace-nowrap text-left"
            >
              Ảnh {i + 1}
            </button>
          ),
        )}
      </div>
      {openUrl && <ImageLightbox url={openUrl} onClose={() => setOpenUrl(null)} />}
    </>
  );
}
