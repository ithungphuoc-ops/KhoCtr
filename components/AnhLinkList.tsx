"use client";

/**
 * Danh sách link ảnh chứng từ của 1 phiếu — dùng trong cột "Hình ảnh" của
 * bảng danh sách (desktop). Bấm mở ảnh ngay trong trang (ImageLightbox),
 * không chuyển tab — xem/tải ảnh có nút riêng trong lightbox.
 */
import { useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";

export default function AnhLinkList({ urls }: { urls: string[] | undefined }) {
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  if (!urls || urls.length === 0) {
    return <span className="text-hp-text-muted">—</span>;
  }
  return (
    <>
      <div className="flex flex-col gap-0.5">
        {urls.map((url, i) => (
          <button
            key={url}
            onClick={() => setOpenUrl(url)}
            className="text-hp-accent hover:underline text-xs whitespace-nowrap text-left"
          >
            Ảnh {i + 1}
          </button>
        ))}
      </div>
      {openUrl && <ImageLightbox url={openUrl} onClose={() => setOpenUrl(null)} />}
    </>
  );
}
