import React, { useState, useRef } from 'react'
import { Upload, FileText, Loader, CheckCircle, AlertCircle, Save, X, Bot, Zap } from 'lucide-react'
import { docPhieu, createPhieu } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')
function formatVND(n) {
  const num = n ?? 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' tỷ'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + ' tr'
  return num.toLocaleString('vi-VN')
}

export default function AIReader() {
  const { congTrinhs, selectedCT } = useCongTrinh()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [savedOk, setSavedOk] = useState(false)
  const [congTrinhId, setCongTrinhId] = useState(selectedCT?.id || '')
  const fileRef = useRef()

  const [provider, setProvider] = useState('gemini') // 'gemini' | 'claude'

  // Drag & drop
  const [dragging, setDragging] = useState(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setResult(null); setError(null); setSavedOk(false) }
  }

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (f) { setFile(f); setResult(null); setError(null); setSavedOk(false) }
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSavedOk(false)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('provider', provider)
      const res = await docPhieu(fd)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Có lỗi khi đọc phiếu. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!result || !congTrinhId) return
    setSaving(true)
    try {
      const phieuData = result.phieu || result
      const items = phieuData.items || phieuData.hang_hoa || []
      const tong_tien = items.reduce((s, it) => s + (it.thanh_tien || (it.so_luong || 0) * (it.don_gia || 0)), 0)
      await createPhieu({
        cong_trinh_id: parseInt(congTrinhId),
        loai: phieuData.loai || 'NK',
        so_phieu: phieuData.so_phieu || `AI-${Date.now()}`,
        ngay: phieuData.ngay || new Date().toISOString().split('T')[0],
        doi_tac: phieuData.doi_tac || phieuData.ncc || '',
        ghi_chu: 'Nhập bằng AI Reader',
        tong_tien,
        items: items.map(it => ({
          ten_hang: it.ten_hang || it.ten || '',
          dvt: it.dvt || 'cái',
          so_luong: it.so_luong || 0,
          don_gia: it.don_gia || 0,
          thanh_tien: it.thanh_tien || (it.so_luong || 0) * (it.don_gia || 0),
          ghi_chu: it.ghi_chu || '',
        }))
      })
      setSavedOk(true)
    } catch (e) {
      setError(e.response?.data?.detail || 'Lỗi lưu phiếu. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    setSavedOk(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const phieuData = result?.phieu || result || {}
  const items = phieuData?.items || phieuData?.hang_hoa || []
  const tong_tien = items.reduce((s, it) => s + (it.thanh_tien || (it.so_luong || 0) * (it.don_gia || 0)), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-hp-text">AI READER — NHẬP LIỆU TỰ ĐỘNG</h1>
        <p className="text-hp-text-secondary mt-1 text-sm">Upload ảnh hoặc PDF phiếu NK/XK, AI đọc và trích xuất thông tin tự động</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Upload card */}
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-6 space-y-4">
          <h3 className="font-semibold text-hp-text">1. Upload phiếu</h3>

          {/* Chọn AI provider */}
          <div>
            <label className="text-xs text-hp-text-secondary font-medium mb-1.5 block">AI đọc phiếu</label>
            <div className="flex gap-1 p-1 bg-hp-surface rounded-hp-md">
              <button onClick={() => setProvider('gemini')}
                className={"flex-1 py-2 px-2 rounded-hp-sm text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'gemini' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                🆓 Gemini
              </button>
              <button onClick={() => setProvider('openai')}
                className={"flex-1 py-2 px-2 rounded-hp-sm text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'openai' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                🤖 ChatGPT
              </button>
              <button onClick={() => setProvider('claude')}
                className={"flex-1 py-2 px-2 rounded-hp-sm text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'claude' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                <Zap className="w-3.5 h-3.5 text-hp-accent" /> Claude
              </button>
            </div>
            <p className="text-xs text-hp-text-muted mt-1">
              {provider === 'gemini' ? '🆓 Miễn phí · Tốc độ nhanh' : provider === 'openai' ? '🤖 ChatGPT · Cần OpenAI key' : '⚡ Chính xác cao · Phù hợp chữ viết tay'}
            </p>
          </div>

          {/* Chọn công trình */}
          <div>
            <label className="text-xs text-hp-text-secondary font-medium mb-1.5 block">Công trình *</label>
            <select
              value={congTrinhId}
              onChange={e => setCongTrinhId(e.target.value)}
              className="w-full min-h-10 bg-hp-card border border-hp-border rounded-hp-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent text-hp-text"
            >
              <option value="">-- Chọn công trình --</option>
              {congTrinhs.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.ten_ct}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-hp-lg p-8 text-center cursor-pointer transition-colors
              ${dragging ? 'border-hp-accent bg-hp-accent/10' : 'border-hp-border bg-hp-card hover:border-hp-accent hover:bg-hp-accent/10'}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-10 h-10 text-hp-text-muted mx-auto mb-3" />
            <p className="text-hp-text-secondary font-medium text-sm">Click hoặc kéo file vào đây</p>
            <p className="text-hp-text-muted text-xs mt-1">Hỗ trợ: JPG, PNG, PDF</p>
            <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFile} />
          </div>

          {/* File info */}
          {file && (
            <div className="flex items-center gap-3 p-3 bg-hp-accent/15 rounded-hp-lg">
              <FileText className="w-5 h-5 text-hp-accent flex-shrink-0" />
              <span className="text-sm text-hp-accent truncate flex-1">{file.name}</span>
              <span className="text-xs text-hp-text-muted">{(file.size / 1024).toFixed(0)} KB</span>
              <button onClick={reset} className="p-0.5 hover:bg-hp-accent/25 rounded text-hp-accent">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || loading || !congTrinhId}
            className="w-full min-h-10 py-2.5 bg-hp-primary text-white rounded-hp-lg font-medium text-sm hover:bg-hp-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {loading
              ? <><Loader className="w-4 h-4 animate-spin" /> AI đang đọc phiếu...</>
              : provider === 'gemini'
                ? <>🆓 Đọc phiếu bằng Gemini</>
                : provider === 'openai'
                ? <>🤖 Đọc phiếu bằng ChatGPT</>
                : <><Bot className="w-4 h-4" /> Đọc phiếu bằng Claude</>
            }
          </button>

          {!congTrinhId && (
            <p className="text-xs text-hp-warning text-center">Vui lòng chọn công trình trước khi đọc phiếu</p>
          )}
        </div>

        {/* Result card */}
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-6 space-y-4">
          <h3 className="font-semibold text-hp-text">2. Kết quả đọc phiếu</h3>

          {!result && !error && !loading && (
            <div className="flex flex-col items-center justify-center h-56 text-hp-text-muted">
              <Bot className="w-14 h-14 mb-3 text-hp-text-disabled" />
              <p className="text-sm">Upload phiếu để AI đọc tự động</p>
              <p className="text-xs mt-1 text-hp-text-disabled">Hỗ trợ: ảnh chụp, scan PDF</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-56 text-hp-text-secondary">
              <Loader className="w-12 h-12 mb-3 text-hp-accent animate-spin" />
              <p className="text-sm font-medium">AI đang phân tích phiếu...</p>
              <p className="text-xs text-hp-text-muted mt-1">Có thể mất 30–60 giây</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-hp-danger/15 rounded-hp-lg border border-hp-danger/30">
              <AlertCircle className="w-5 h-5 text-hp-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-hp-danger">Đọc phiếu thất bại</p>
                <p className="text-xs text-hp-danger mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {savedOk && (
            <div className="flex items-center gap-3 p-4 bg-hp-primary/15 rounded-hp-lg border border-hp-primary/30">
              <CheckCircle className="w-5 h-5 text-hp-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-hp-primary">Lưu phiếu thành công!</p>
                <p className="text-xs text-hp-primary mt-0.5">Phiếu đã được lưu vào hệ thống</p>
              </div>
            </div>
          )}

          {result && !savedOk && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-hp-primary">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Đọc phiếu thành công!</span>
              </div>

              {/* Info phiếu */}
              <div className="bg-hp-surface rounded-hp-lg p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-hp-text-muted">Số phiếu:</span>
                  <span className="ml-1 font-semibold text-hp-text">{phieuData.so_phieu || '—'}</span>
                </div>
                <div>
                  <span className="text-hp-text-muted">Ngày:</span>
                  <span className="ml-1 font-semibold text-hp-text">{phieuData.ngay || '—'}</span>
                </div>
                <div>
                  <span className="text-hp-text-muted">Loại:</span>
                  <span className={`ml-1 font-semibold ${(phieuData.loai || 'NK') === 'NK' ? 'text-hp-primary' : 'text-hp-warning'}`}>
                    {(phieuData.loai || 'NK') === 'NK' ? 'Nhập kho' : 'Xuất kho'}
                  </span>
                </div>
                <div>
                  <span className="text-hp-text-muted">NCC:</span>
                  <span className="ml-1 font-semibold text-hp-text">{phieuData.doi_tac || phieuData.ncc || '—'}</span>
                </div>
              </div>

              {/* Bảng hàng hóa */}
              {items.length > 0 && (
                <div className="overflow-auto max-h-44 rounded-hp-lg border border-hp-border">
                  <table className="w-full text-xs">
                    <thead className="bg-hp-surface sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-hp-text-muted">#</th>
                        <th className="text-left p-2 text-hp-text-muted">Tên hàng</th>
                        <th className="text-right p-2 text-hp-text-muted">SL</th>
                        <th className="text-left p-2 text-hp-text-muted">DVT</th>
                        <th className="text-right p-2 text-hp-text-muted">Đơn giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} className="border-t border-hp-border hover:bg-hp-elevated">
                          <td className="p-2 text-hp-text-muted">{i + 1}</td>
                          <td className="p-2 text-hp-text">{it.ten_hang || it.ten}</td>
                          <td className="p-2 text-right text-hp-text">{fmt(it.so_luong)}</td>
                          <td className="p-2 text-hp-text-muted">{it.dvt}</td>
                          <td className="p-2 text-right text-hp-text-secondary">{formatVND(it.don_gia)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-hp-text-muted">{items.length} dòng hàng · Tổng: <strong className="text-hp-text">{formatVND(tong_tien)}</strong></span>
                <button
                  onClick={handleSave}
                  disabled={saving || !congTrinhId}
                  className="flex items-center gap-2 px-4 py-2 min-h-10 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <><Loader className="w-4 h-4 animate-spin" /> Đang lưu...</> : <><Save className="w-4 h-4" /> Xác nhận lưu phiếu</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hướng dẫn */}
      <div className="bg-hp-accent/10 rounded-hp-lg p-5 border border-hp-accent/30">
        <h4 className="font-semibold text-hp-accent mb-3 text-sm">Hướng dẫn sử dụng AI Reader</h4>
        <div className="grid grid-cols-4 gap-4 text-xs text-hp-text-secondary">
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-hp-accent text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
            <span>Chọn AI: <b>Gemini</b> (miễn phí), <b>ChatGPT</b> (cần key), hoặc <b>Claude</b> (chính xác cao nhất)</span>
          </div>
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-hp-accent text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
            <span>Chọn công trình cần nhập phiếu vào</span>
          </div>
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-hp-accent text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
            <span>Upload ảnh chụp hoặc file PDF phiếu nhập / xuất kho</span>
          </div>
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-hp-accent text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">4</span>
            <span>Kiểm tra kết quả AI đọc, sau đó nhấn "Xác nhận lưu phiếu"</span>
          </div>
        </div>
      </div>
    </div>
  )
}
