"use client";

/**
 * Khu vực "Ảnh chứng từ nhập kho" trong modal Chi tiết phiếu — dùng chung cho
 * cả 2 bản trang (App Tổng phieu-nhap/, App Con ct/[id]/nhap-kho/). Upload
 * qua Route Handler (server resize+nén bằng sharp rồi ghi R2), không gọi
 * R2 trực tiếp từ browser — đúng nguyên tắc bảo mật chung của app (xem
 * lib/r2.ts, app/api/phieu/[id]/anh/route.ts).
 */
import { useRef, useState } from "react";
import { Camera, Loader, X } from "lucide-react";
import { uploadAnhPhieu, deleteAnhPhieu } from "@/lib/api-client";

// Ảnh gốc chụp điện thoại thường 3-8MB — server sẽ tự resize+nén khi lưu,
// không cần chặn gắt ở phía client.
const MAX_SIZE = 15 * 1024 * 1024;

function errDetail(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: string } } };
  return e.response?.data?.detail || fallback;
}

export default function AnhChungTuPhieu({
  phieuId,
  anhUrls,
  onChange,
}: {
  phieuId: number;
  anhUrls: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    const oversized = files.find((f) => f.size > MAX_SIZE);
    if (oversized) {
      setError(`Ảnh "${oversized.name}" vượt quá 15MB`);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const res = await uploadAnhPhieu(phieuId, files);
      onChange(res.data.anh_urls || []);
    } catch (e) {
      setError(errDetail(e, "Lỗi upload ảnh. Thử lại."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (url: string) => {
    setDeletingUrl(url);
    setError("");
    try {
      const res = await deleteAnhPhieu(phieuId, url);
      onChange(res.data.anh_urls || anhUrls.filter((u) => u !== url));
    } catch (e) {
      setError(errDetail(e, "Lỗi xóa ảnh. Thử lại."));
    } finally {
      setDeletingUrl(null);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-hp-text-secondary">Ảnh chứng từ nhập kho</label>

      {anhUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {anhUrls.map((url) => (
            <div key={url} className="relative w-20 h-20 rounded-hp-md overflow-hidden border border-hp-border group">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Firebase Storage động, không dùng next/image */}
              <img src={url} alt="Ảnh chứng từ nhập kho" className="w-full h-full object-cover cursor-pointer" onClick={() => setPreview(url)} />
              <button
                onClick={() => handleDelete(url)}
                disabled={deletingUrl === url}
                title="Xóa ảnh"
                className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-hp-danger rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
              >
                {deletingUrl === url ? <Loader className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={
          "border-2 border-dashed rounded-hp-lg p-4 text-center cursor-pointer transition-colors " +
          (dragging ? "border-hp-accent bg-hp-accent/10" : "border-hp-border hover:border-hp-accent hover:bg-hp-accent/10")
        }
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        {uploading ? (
          <p className="text-hp-text-secondary text-xs flex items-center justify-center gap-2 py-1">
            <Loader className="w-4 h-4 animate-spin" /> Đang upload...
          </p>
        ) : (
          <>
            <Camera className="w-5 h-5 text-hp-text-muted mx-auto mb-1" />
            <p className="text-hp-text-secondary text-xs font-medium">Click hoặc kéo ảnh vào đây</p>
            <p className="text-hp-text-muted text-xs mt-0.5">JPG, PNG — tối đa 15MB/ảnh (tự động nén khi lưu)</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-hp-danger text-xs bg-hp-danger/10 p-2 rounded-hp-md">{error}</p>}

      {preview && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- xem ảnh gốc, không cần tối ưu next/image */}
          <img src={preview} alt="Ảnh chứng từ (xem lớn)" className="max-w-full max-h-full rounded-hp-md" />
        </div>
      )}
    </div>
  );
}
