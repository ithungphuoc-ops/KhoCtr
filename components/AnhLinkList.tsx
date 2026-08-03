"use client";

/**
 * Danh sách link ảnh/PDF chứng từ của 1 phiếu — dùng trong cột "Hình ảnh"
 * của bảng danh sách (desktop). Cả ảnh và PDF đều mở ngay trong trang qua
 * ImageLightbox (không chuyển tab) — lightbox tự nhận diện PDF để nhúng
 * đúng khung xem PDF thay vì thẻ ảnh.
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
        {urls.map((url, i) => (
          <button
            key={url}
            onClick={() => setOpenUrl(url)}
            className={"hover:underline text-xs whitespace-nowrap text-left " + (isPdfUrl(url) ? "text-hp-danger" : "text-hp-accent")}
          >
            {isPdfUrl(url) ? "PDF" : "Ảnh"} {i + 1}
          </button>
        ))}
      </div>
      {openUrl && <ImageLightbox url={openUrl} onClose={() => setOpenUrl(null)} />}
    </>
  );
}
