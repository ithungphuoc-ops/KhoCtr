"use client";

/**
 * Danh sách link ảnh chứng từ của 1 phiếu — dùng trong cột "Hình ảnh" của
 * bảng danh sách (desktop). Mở tab mới khi bấm; xem/tải ảnh dùng tính năng
 * có sẵn của trình duyệt (chuột phải "Save as" trên máy tính) — không cần
 * nút riêng.
 */
export default function AnhLinkList({ urls }: { urls: string[] | undefined }) {
  if (!urls || urls.length === 0) {
    return <span className="text-hp-text-muted">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {urls.map((url, i) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-hp-accent hover:underline text-xs whitespace-nowrap"
        >
          Ảnh {i + 1}
        </a>
      ))}
    </div>
  );
}
