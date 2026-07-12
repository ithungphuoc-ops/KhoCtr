import React, { useState, useRef } from 'react'
import { useOutletContext, useParams, useNavigate } from 'react-router-dom'
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle,
  Loader, AlertTriangle, RotateCcw, Package
} from 'lucide-react'
import { api } from '../../api'

const STEPS = ['upload', 'preview', 'importing', 'done']

export default function CTImportData() {
  const { congTrinh, ctId } = useOutletContext() || {}
  const { id } = useParams()
  const navigate = useNavigate()
  const realId = ctId || id

  const [step, setStep]       = useState('upload')
  const [file, setFile]       = useState(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      setError('Chỉ hỗ trợ file .xlsx hoặc .xls')
      return
    }
    setFile(f); setError('')
  }

  const handlePreview = async () => {
    if (!file) { setError('Chưa chọn file'); return }
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('cong_trinh_id', realId)
      const res = await api.post('/import/preview/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000,
      })
      setPreview(res.data); setStep('preview')
    } catch (e) {
      setError(e.response?.data?.detail || 'Lỗi đọc file. Kiểm tra lại sheet QLTK.')
    } finally { setLoading(false) }
  }

  const handleImport = async () => {
    setStep('importing'); setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('cong_trinh_id', realId)
      const res = await api.post('/import/execute/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 600000,
      })
      setResult(res.data); setStep('done')
    } catch (e) {
      setError(e.response?.data?.detail || 'Lỗi import. Thử lại.')
      setStep('preview')
    } finally { setLoading(false) }
  }

  const reset = () => {
    setStep('upload'); setFile(null); setPreview(null); setResult(null); setError('')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-hp-text">IMPORT DỮ LIỆU</h1>
        <p className="text-hp-text-secondary mt-1 text-sm">
          Import hàng loạt từ file Excel (sheet QLTK) vào công trình{' '}
          <span className="font-semibold text-hp-accent">{congTrinh?.ten_ct || `#${realId}`}</span>.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[
          { key: 'upload',    label: '1. Chọn file' },
          { key: 'preview',   label: '2. Kiểm tra' },
          { key: 'importing', label: '3. Đang import' },
          { key: 'done',      label: '4. Hoàn tất' },
        ].map((s, i, arr) => (
          <React.Fragment key={s.key}>
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              step === s.key
                ? 'bg-hp-accent text-white'
                : STEPS.indexOf(step) > i
                  ? 'bg-hp-primary/20 text-hp-primary'
                  : 'bg-hp-surface text-hp-text-muted'
            }`}>
              {STEPS.indexOf(step) > i ? '✓ ' : ''}{s.label}
            </div>
            {i < arr.length - 1 && <div className="flex-1 h-px bg-hp-border" />}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-hp-text mb-1.5">File Excel (sheet QLTK) <span className="text-hp-danger">*</span></label>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-hp-lg p-10 text-center cursor-pointer transition-all ${
                dragging ? 'border-hp-accent bg-hp-accent/10'
                : file   ? 'border-hp-primary bg-hp-primary/10'
                : 'border-hp-border hover:border-hp-accent hover:bg-hp-elevated'
              }`}
            >
              {file ? (
                <div className="space-y-1">
                  <FileSpreadsheet className="w-10 h-10 text-hp-primary mx-auto" />
                  <p className="font-medium text-hp-primary">{file.name}</p>
                  <p className="text-xs text-hp-text-muted">{(file.size / 1024).toFixed(0)} KB — Click để đổi file</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 text-hp-text-disabled mx-auto" />
                  <p className="text-hp-text-secondary font-medium">Kéo thả file vào đây hoặc click để chọn</p>
                  <p className="text-xs text-hp-text-muted">Hỗ trợ: .xlsx, .xls — Sheet phải có tên <strong>QLTK</strong></p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
          </div>

          <div className="bg-hp-warning/10 border border-hp-warning/20 rounded-hp-lg p-4 text-sm text-hp-warning space-y-1">
            <p className="font-semibold">Lưu ý trước khi import:</p>
            <p>• File phải có sheet tên chính xác là <strong>QLTK</strong></p>
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
            {loading
              ? <><Loader className="w-4 h-4 animate-spin" /> Đang đọc file...</>
              : 'Kiểm tra trước khi import →'}
          </button>
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 'preview' && preview && (
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
            Quá trình import có thể mất <strong>5–15 phút</strong> tùy theo kích thước file.
            Không đóng tab này trong khi import.
          </div>

          {error && (
            <div className="flex items-center gap-2 text-hp-danger text-sm bg-hp-danger/10 p-3 rounded-hp-md">
              <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset}
              className="flex-1 py-3 border border-hp-border text-hp-text-secondary rounded-hp-lg font-medium text-sm hover:bg-hp-elevated flex items-center justify-center gap-2 min-h-10">
              <RotateCcw className="w-4 h-4" /> Chọn lại file
            </button>
            <button onClick={handleImport}
              className="flex-1 py-3 bg-hp-primary text-white rounded-hp-lg font-semibold text-sm hover:bg-hp-primary/90 flex items-center justify-center gap-2 min-h-10">
              <CheckCircle className="w-4 h-4" /> Xác nhận Import
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Importing */}
      {step === 'importing' && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-12 text-center space-y-4">
          <Loader className="w-14 h-14 text-hp-accent animate-spin mx-auto" />
          <p className="text-lg font-semibold text-hp-text">Đang import dữ liệu...</p>
          <p className="text-sm text-hp-text-muted">
            Vui lòng chờ, không đóng tab này.<br />
            Có thể mất 5–15 phút.
          </p>
        </div>
      )}

      {/* STEP 4: Done */}
      {step === 'done' && result && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-6 space-y-5">
          <div className="text-center">
            <CheckCircle className="w-14 h-14 text-hp-primary mx-auto mb-3" />
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
            <button onClick={reset}
              className="flex-1 py-3 border border-hp-border text-hp-text-secondary rounded-hp-lg font-medium text-sm hover:bg-hp-elevated flex items-center justify-center gap-2 min-h-10">
              <Upload className="w-4 h-4" /> Import file khác
            </button>
            <button onClick={() => navigate(`/ct/${realId}/ton-kho`)}
              className="flex-1 py-3 bg-hp-primary text-white rounded-hp-lg font-semibold text-sm hover:bg-hp-primary/90 flex items-center justify-center gap-2 min-h-10">
              <Package className="w-4 h-4" /> Xem Tồn kho →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
