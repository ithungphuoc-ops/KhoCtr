"use client";

/**
 * Bản "tạm" (staged) của AnhChungTuPhieu — dùng trong modal Tạo phiếu nhập kho
 * khi phiếu CHƯA có id (chưa lưu). File chỉ nằm trong state của component cha,
 * không gọi API nào cả; khi phiếu lưu thành công, cha lấy phieu_id mới rồi tự
 * gọi uploadAnhPhieu() với đúng các file này (xem phieu-nhap/page.tsx,
 * ct/[id]/nhap-kho/page.tsx). Sau khi phiếu đã có id, dùng AnhChungTuPhieu.tsx
 * (upload thật ngay) thay cho component này.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, FileText, X } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";

const MAX_SIZE = 15 * 1024 * 1024;

export default function AnhChungTuStaging({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlMapRef = useRef<Map<File, string>>(new Map());

  useEffect(() => {
    const map = urlMapRef.current;
    for (const f of Array.from(map.keys())) {
      if (!files.includes(f)) {
        URL.revokeObjectURL(map.get(f)!);
        map.delete(f);
      }
    }
  }, [files]);

  useEffect(() => {
    const map = urlMapRef.current;
    return () => {
      map.forEach((url) => URL.revokeObjectURL(url));
      map.clear();
    };
  }, []);

  const urlFor = (file: File) => {
    if (file.type === "application/pdf") return null;
    const map = urlMapRef.current;
    if (!map.has(file)) map.set(file, URL.createObjectURL(file));
    return map.get(file)!;
  };

  const handleFiles = (fileList: FileList | File[]) => {
    const picked = Array.from(fileList).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (picked.length === 0) return;
    const oversized = picked.find((f) => f.size > MAX_SIZE);
    if (oversized) {
      setError(`File "${oversized.name}" vượt quá 15MB`);
      return;
    }
    setError("");
    onChange([...files, ...picked]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = (file: File) => onChange(files.filter((f) => f !== file));

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-hp-text-secondary">Ảnh chứng từ nhập kho — sẽ lưu khi bấm Lưu Phiếu</label>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => {
            const url = urlFor(file);
            return (
              <div key={i} className="relative w-20 h-20 rounded-hp-md overflow-hidden border border-hp-border group">
                {!url ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-hp-surface text-hp-danger" title={file.name}>
                    <FileText className="w-6 h-6" />
                    <span className="text-[10px] font-medium">PDF</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- preview cục bộ từ File, chưa lên server
                  <img src={url} alt={file.name} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreview(url)} />
                )}
                <button
                  onClick={() => handleRemove(file)}
                  title="Bỏ ảnh"
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-hp-danger rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
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
        <Camera className="w-5 h-5 text-hp-text-muted mx-auto mb-1" />
        <p className="text-hp-text-secondary text-xs font-medium">Click hoặc kéo ảnh vào đây</p>
        <p className="text-hp-text-muted text-xs mt-0.5">JPG, PNG, PDF — tối đa 15MB</p>
        <input ref={inputRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>

      {error && <p className="text-hp-danger text-xs bg-hp-danger/10 p-2 rounded-hp-md">{error}</p>}

      {preview && <ImageLightbox url={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
