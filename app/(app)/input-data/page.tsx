"use client";

// Port từ frontend/src/pages/ImportData.jsx.
import { useState, useRef, Fragment } from "react";
import Link from "next/link";
import { Upload, FileSpreadsheet, XCircle, CheckCircle, Loader, AlertTriangle, RotateCcw } from "lucide-react";
import { previewImport, executeImport } from "@/lib/api-client";
import { useCongTrinh } from "@/components/CongTrinhProvider";
import { useAuth } from "@/components/SessionProvider";

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

export default function ImportDataPage() {
  const { congTrinhs, selectedCT } = useCongTrinh();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [ctId, setCtId] = useState(selectedCT ? String(selectedCT.id) : "");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ctName = congTrinhs.find((c) => c.id === Number(ctId))?.ten_ct || "";

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
    if (!ctId) {
      setError("Chưa chọn công trình");
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

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-hp-text">IMPORT DỮ LIỆU</h1>
        <div className="bg-hp-card rounded-hp-xl border border-hp-border p-16 text-center text-hp-text-muted">Chỉ admin mới truy cập được trang này.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-hp-text">IMPORT DỮ LIỆU HÀNG LOẠT</h1>
        <p className="text-hp-text-secondary mt-1 text-sm">Import toàn bộ dữ liệu từ file Excel (sheet QLTK) vào một công trình. Dùng khi cần setup nhanh công trình mới hoặc cập nhật hàng loạt.</p>
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
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${step === s.key ? "bg-hp-accent text-white" : STEPS.indexOf(step) > i ? "bg-hp-success/20 text-hp-success" : "bg-hp-elevated text-hp-text-muted"}`}>
              {STEPS.indexOf(step) > i ? "✓ " : ""}
              {s.label}
            </div>
            {i < arr.length - 1 && <div className="flex-1 h-px bg-hp-border" />}
          </Fragment>
        ))}
      </div>

      {step === "upload" && (
        <div className="bg-hp-card rounded-hp-xl border border-hp-border p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-hp-text mb-1.5">
              Công trình đích <span className="text-hp-danger">*</span>
            </label>
            <select value={ctId} onChange={(e) => setCtId(e.target.value)} className="w-full border border-hp-border rounded-hp-lg px-3 py-2 text-sm bg-hp-elevated text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent">
              <option value="">-- Chọn công trình --</option>
              {congTrinhs.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.ten_ct}
                </option>
              ))}
            </select>
          </div>

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
              className={`border-2 border-dashed rounded-hp-xl p-10 text-center cursor-pointer transition-all ${dragging ? "border-hp-accent bg-hp-accent/10" : file ? "border-hp-success bg-hp-success/10" : "border-hp-border hover:border-hp-accent hover:bg-hp-elevated"}`}
            >
              {file ? (
                <div className="space-y-1">
                  <FileSpreadsheet className="w-10 h-10 text-hp-success mx-auto" />
                  <p className="font-medium text-hp-success">{file.name}</p>
                  <p className="text-xs text-hp-text-muted">{(file.size / 1024).toFixed(0)} KB — Click để đổi file</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 text-hp-text-muted mx-auto" />
                  <p className="text-hp-text-secondary font-medium">Kéo thả file vào đây hoặc click để chọn</p>
                  <p className="text-xs text-hp-text-muted">
                    Hỗ trợ: .xlsx, .xls — Sheet phải có tên <strong>QLTK</strong>
                  </p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          <div className="bg-hp-warning/10 border border-hp-warning/30 rounded-hp-xl p-4 text-sm text-hp-warning space-y-1">
            <p className="font-semibold">Lưu ý trước khi import:</p>
            <p>
              • File phải có sheet tên chính xác là <strong>QLTK</strong>
            </p>
            <p>• Cột A:B = Danh mục, Cột H:L = Nhập kho, Cột N:R = Xuất kho</p>
            <p>• Dữ liệu cũ của công trình sẽ KHÔNG bị xóa, chỉ thêm mới</p>
            <p>
              • Việc nhập/xuất hàng ngày làm trong <strong>App Con</strong> của công trình
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-hp-danger text-sm bg-hp-danger/10 p-3 rounded-hp-lg">
              <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handlePreview}
            disabled={loading || !file || !ctId}
            className="w-full py-3 bg-hp-primary text-white rounded-hp-xl font-semibold text-sm hover:bg-hp-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
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
        <div className="bg-hp-card rounded-hp-xl border border-hp-border p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-hp-text text-lg">Kết quả đọc file</h2>
            <p className="text-sm text-hp-text-secondary mt-0.5">
              Công trình: <span className="font-medium text-hp-accent">{ctName}</span> · File: <span className="font-medium">{file?.name}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-hp-elevated rounded-hp-xl p-4 text-center">
              <div className="text-3xl font-bold text-hp-accent">{preview.hang_hoa?.toLocaleString()}</div>
              <div className="text-sm text-hp-accent mt-1">Mặt hàng (danh mục)</div>
            </div>
            <div className="bg-hp-primary/10 rounded-hp-xl p-4 text-center">
              <div className="text-3xl font-bold text-hp-primary">{preview.phieu_nk?.toLocaleString()}</div>
              <div className="text-sm text-hp-primary mt-1">Phiếu Nhập kho</div>
              <div className="text-xs text-hp-text-muted mt-0.5">{preview.dong_nk?.toLocaleString()} dòng hàng</div>
            </div>
            <div className="bg-hp-warning/10 rounded-hp-xl p-4 text-center">
              <div className="text-3xl font-bold text-hp-warning">{preview.phieu_xk?.toLocaleString()}</div>
              <div className="text-sm text-hp-warning mt-1">Phiếu Xuất kho</div>
              <div className="text-xs text-hp-text-muted mt-0.5">{preview.dong_xk?.toLocaleString()} dòng hàng</div>
            </div>
          </div>

          <div className="bg-hp-accent/15 border border-hp-accent/30 rounded-hp-xl p-4 text-sm text-hp-accent">
            <AlertTriangle className="w-4 h-4 inline mr-1.5" />
            Quá trình import có thể mất <strong>5–15 phút</strong> tùy theo kích thước file. Không đóng tab này trong khi import.
          </div>

          {error && (
            <div className="flex items-center gap-2 text-hp-danger text-sm bg-hp-danger/10 p-3 rounded-hp-lg">
              <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 border border-hp-border text-hp-text-secondary rounded-hp-xl font-medium text-sm hover:bg-hp-elevated flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Chọn lại file
            </button>
            <button onClick={handleImport} className="flex-1 py-3 bg-hp-primary text-white rounded-hp-xl font-semibold text-sm hover:bg-hp-primary/90 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> Xác nhận Import
            </button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="bg-hp-card rounded-hp-xl border border-hp-border p-12 text-center space-y-4">
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
        <div className="bg-hp-card rounded-hp-xl border border-hp-border p-6 space-y-5">
          <div className="text-center">
            <CheckCircle className="w-14 h-14 text-hp-success mx-auto mb-3" />
            <h2 className="text-xl font-bold text-hp-text">Import hoàn tất!</h2>
            <p className="text-sm text-hp-text-secondary mt-1">
              Công trình: <span className="font-medium text-hp-accent">{ctName}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-hp-elevated rounded-hp-xl p-4 text-center">
              <div className="text-2xl font-bold text-hp-accent">{result.hang_hoa?.thanh_cong}</div>
              <div className="text-xs text-hp-accent mt-1">Mặt hàng thêm mới</div>
              {result.hang_hoa?.loi > 0 && <div className="text-xs text-hp-danger">{result.hang_hoa.loi} lỗi</div>}
            </div>
            <div className="bg-hp-primary/10 rounded-hp-xl p-4 text-center">
              <div className="text-2xl font-bold text-hp-primary">{result.nhap_kho?.thanh_cong}</div>
              <div className="text-xs text-hp-primary mt-1">Phiếu Nhập kho</div>
              {result.nhap_kho?.loi > 0 && <div className="text-xs text-hp-danger">{result.nhap_kho.loi} lỗi</div>}
            </div>
            <div className="bg-hp-warning/10 rounded-hp-xl p-4 text-center">
              <div className="text-2xl font-bold text-hp-warning">{result.xuat_kho?.thanh_cong}</div>
              <div className="text-xs text-hp-warning mt-1">Phiếu Xuất kho</div>
              {result.xuat_kho?.loi > 0 && <div className="text-xs text-hp-danger">{result.xuat_kho.loi} lỗi</div>}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 border border-hp-border text-hp-text-secondary rounded-hp-xl font-medium text-sm hover:bg-hp-elevated flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> Import file khác
            </button>
            <Link href="/" className="flex-1 py-3 bg-hp-primary text-white rounded-hp-xl font-semibold text-sm hover:bg-hp-primary/90 flex items-center justify-center gap-2 text-center">
              Xem Báo cáo tổng hợp →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
