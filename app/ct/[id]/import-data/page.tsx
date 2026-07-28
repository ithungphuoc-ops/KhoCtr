"use client";

// Port từ frontend/src/pages/ct/CTImportData.jsx.
import { useState, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, XCircle, CheckCircle, Loader, AlertTriangle, RotateCcw, Package } from "lucide-react";
import { previewImport, executeImport } from "@/lib/api-client";
import { useCT } from "@/components/ct/CTProvider";

const STEPS = ["upload", "preview", "importing", "done"] as const;
type Step = (typeof STEPS)[number];

interface PreviewResult {
  hang_hoa: number;
  phieu_nk: number;
  dong_nk: number;
  phieu_xk: number;
  dong_xk: number;
}
interface ImportResult {
  hang_hoa: { thanh_cong: number; loi: number };
  nhap_kho: { thanh_cong: number; loi: number };
  xuat_kho: { thanh_cong: number; loi: number };
}

function errDetail(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: string } } };
  return e.response?.data?.detail || fallback;
}

export default function CTImportDataPage() {
  const { congTrinh, ctId } = useCT();
  const router = useRouter();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      setError("Chỉ hỗ trợ file .xlsx hoặc .xls");
      return;
    }
    setFile(f);
    setError("");
  };

  const handlePreview = async () => {
    if (!file) {
      setError("Chưa chọn file");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("cong_trinh_id", ctId);
      const res = await previewImport(fd);
      setPreview(res.data as PreviewResult);
      setStep("preview");
    } catch (e) {
      setError(errDetail(e, "Lỗi đọc file. Kiểm tra lại sheet QLTK."));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setStep("importing");
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("cong_trinh_id", ctId);
      const res = await executeImport(fd);
      setResult(res.data as ImportResult);
      setStep("done");
    } catch (e) {
      setError(errDetail(e, "Lỗi import. Thử lại."));
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-hp-text">IMPORT DỮ LIỆU</h1>
        <p className="text-hp-text-secondary mt-1 text-sm">
          Import hàng loạt từ file Excel (sheet QLTK) vào công trình <span className="font-semibold text-hp-accent">{congTrinh?.ten_ct || `#${ctId}`}</span>.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {(
          [
            { key: "upload" as Step, label: "1. Chọn file" },
            { key: "preview" as Step, label: "2. Kiểm tra" },
            { key: "importing" as Step, label: "3. Đang import" },
            { key: "done" as Step, label: "4. Hoàn tất" },
          ]
        ).map((s, i, arr) => (
          <Fragment key={s.key}>
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${step === s.key ? "bg-hp-accent text-white" : STEPS.indexOf(step) > i ? "bg-hp-success/20 text-hp-success" : "bg-hp-surface text-hp-text-muted"}`}>
              {STEPS.indexOf(step) > i ? "✓ " : ""}
              {s.label}
            </div>
            {i < arr.length - 1 && <div className="flex-1 h-px bg-hp-border" />}
          </Fragment>
        ))}
      </div>

      {step === "upload" && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-hp-text mb-1.5">
              File Excel (sheet QLTK) <span className="text-hp-danger">*</span>
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-hp-lg p-10 text-center cursor-pointer transition-all ${dragging ? "border-hp-accent bg-hp-accent/10" : file ? "border-hp-success bg-hp-success/10" : "border-hp-border hover:border-hp-accent hover:bg-hp-elevated"}`}
            >
              {file ? (
                <div className="space-y-1">
                  <FileSpreadsheet className="w-10 h-10 text-hp-success mx-auto" />
                  <p className="font-medium text-hp-success">{file.name}</p>
                  <p className="text-xs text-hp-text-muted">{(file.size / 1024).toFixed(0)} KB — Click để đổi file</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 text-hp-text-disabled mx-auto" />
                  <p className="text-hp-text-secondary font-medium">Kéo thả file vào đây hoặc click để chọn</p>
                  <p className="text-xs text-hp-text-muted">
                    Hỗ trợ: .xlsx, .xls — Sheet phải có tên <strong>QLTK</strong>
                  </p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          <div className="bg-hp-warning/10 border border-hp-warning/20 rounded-hp-lg p-4 text-sm text-hp-warning space-y-1">
            <p className="font-semibold">Lưu ý trước khi import:</p>
            <p>
              • File phải có sheet tên chính xác là <strong>QLTK</strong>
            </p>
            <p>• Cột A:B = Danh mục, Cột H:L = Nhập kho, Cột N:R = Xuất kho</p>
            <p>• Dữ liệu cũ của công trình sẽ KHÔNG bị xóa, chỉ thêm mới</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-hp-danger text-sm bg-hp-danger/10 p-3 rounded-hp-md">
              <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handlePreview}
            disabled={loading || !file}
            className="w-full py-3 bg-hp-primary text-white rounded-hp-lg font-semibold text-sm hover:bg-hp-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors min-h-10"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> Đang đọc file...
              </>
            ) : (
              "Kiểm tra trước khi import →"
            )}
          </button>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-hp-text text-lg">Kết quả đọc file</h2>
            <p className="text-sm text-hp-text-secondary mt-0.5">
              File: <span className="font-medium">{file?.name}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-hp-accent/15 rounded-hp-lg p-4 text-center">
              <div className="text-3xl font-bold text-hp-accent">{preview.hang_hoa?.toLocaleString()}</div>
              <div className="text-sm text-hp-accent mt-1">Mặt hàng (danh mục)</div>
            </div>
            <div className="bg-hp-primary/15 rounded-hp-lg p-4 text-center">
              <div className="text-3xl font-bold text-hp-primary">{preview.phieu_nk?.toLocaleString()}</div>
              <div className="text-sm text-hp-primary mt-1">Phiếu Nhập kho</div>
              <div className="text-xs text-hp-text-muted mt-0.5">{preview.dong_nk?.toLocaleString()} dòng hàng</div>
            </div>
            <div className="bg-hp-warning/15 rounded-hp-lg p-4 text-center">
              <div className="text-3xl font-bold text-hp-warning">{preview.phieu_xk?.toLocaleString()}</div>
              <div className="text-sm text-hp-warning mt-1">Phiếu Xuất kho</div>
              <div className="text-xs text-hp-text-muted mt-0.5">{preview.dong_xk?.toLocaleString()} dòng hàng</div>
            </div>
          </div>

          <div className="bg-hp-accent/15 border border-hp-accent/20 rounded-hp-lg p-4 text-sm text-hp-accent">
            <AlertTriangle className="w-4 h-4 inline mr-1.5" />
            Quá trình import có thể mất <strong>5–15 phút</strong> tùy theo kích thước file. Không đóng tab này trong khi import.
          </div>

          {error && (
            <div className="flex items-center gap-2 text-hp-danger text-sm bg-hp-danger/10 p-3 rounded-hp-md">
              <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 border border-hp-border text-hp-text-secondary rounded-hp-lg font-medium text-sm hover:bg-hp-elevated flex items-center justify-center gap-2 min-h-10">
              <RotateCcw className="w-4 h-4" /> Chọn lại file
            </button>
            <button onClick={handleImport} className="flex-1 py-3 bg-hp-primary text-white rounded-hp-lg font-semibold text-sm hover:bg-hp-primary/90 flex items-center justify-center gap-2 min-h-10">
              <CheckCircle className="w-4 h-4" /> Xác nhận Import
            </button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-12 text-center space-y-4">
          <Loader className="w-14 h-14 text-hp-accent animate-spin mx-auto" />
          <p className="text-lg font-semibold text-hp-text">Đang import dữ liệu...</p>
          <p className="text-sm text-hp-text-muted">
            Vui lòng chờ, không đóng tab này.
            <br />
            Có thể mất 5–15 phút.
          </p>
        </div>
      )}

      {step === "done" && result && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-6 space-y-5">
          <div className="text-center">
            <CheckCircle className="w-14 h-14 text-hp-success mx-auto mb-3" />
            <h2 className="text-xl font-bold text-hp-text">Import hoàn tất!</h2>
            <p className="text-sm text-hp-text-secondary mt-1">
              Công trình: <span className="font-medium text-hp-accent">{congTrinh?.ten_ct}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-hp-accent/15 rounded-hp-lg p-4 text-center">
              <div className="text-2xl font-bold text-hp-accent">{result.hang_hoa?.thanh_cong}</div>
              <div className="text-xs text-hp-accent mt-1">Mặt hàng thêm mới</div>
              {result.hang_hoa?.loi > 0 && <div className="text-xs text-hp-danger">{result.hang_hoa.loi} lỗi</div>}
            </div>
            <div className="bg-hp-primary/15 rounded-hp-lg p-4 text-center">
              <div className="text-2xl font-bold text-hp-primary">{result.nhap_kho?.thanh_cong}</div>
              <div className="text-xs text-hp-primary mt-1">Phiếu Nhập kho</div>
              {result.nhap_kho?.loi > 0 && <div className="text-xs text-hp-danger">{result.nhap_kho.loi} lỗi</div>}
            </div>
            <div className="bg-hp-warning/15 rounded-hp-lg p-4 text-center">
              <div className="text-2xl font-bold text-hp-warning">{result.xuat_kho?.thanh_cong}</div>
              <div className="text-xs text-hp-warning mt-1">Phiếu Xuất kho</div>
              {result.xuat_kho?.loi > 0 && <div className="text-xs text-hp-danger">{result.xuat_kho.loi} lỗi</div>}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 border border-hp-border text-hp-text-secondary rounded-hp-lg font-medium text-sm hover:bg-hp-elevated flex items-center justify-center gap-2 min-h-10">
              <Upload className="w-4 h-4" /> Import file khác
            </button>
            <button onClick={() => router.push(`/ct/${ctId}/ton-kho`)} className="flex-1 py-3 bg-hp-primary text-white rounded-hp-lg font-semibold text-sm hover:bg-hp-primary/90 flex items-center justify-center gap-2 min-h-10">
              <Package className="w-4 h-4" /> Xem Tồn kho →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
