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
        <h1 className="text-2xl font-bold text-gray-800">AI READER — NHẬP LIỆU TỰ ĐỘNG</h1>
        <p className="text-gray-500 mt-1 text-sm">Upload ảnh hoặc PDF phiếu NK/XK, AI đọc và trích xuất thông tin tự động</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Upload card */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">1. Upload phiếu</h3>

          {/* Chọn AI provider */}
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1.5 block">AI đọc phiếu</label>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              <button onClick={() => setProvider('gemini')}
                className={"flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'gemini' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                🆓 Gemini
              </button>
              <button onClick={() => setProvider('openai')}
                className={"flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'openai' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                🤖 ChatGPT
              </button>
              <button onClick={() => setProvider('claude')}
                className={"flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'claude' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                <Zap className="w-3.5 h-3.5 text-purple-500" /> Claude
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {provider === 'gemini' ? '🆓 Miễn phí · Tốc độ nhanh' : provider === 'openai' ? '🤖 ChatGPT · Cần OpenAI key' : '⚡ Chính xác cao · Phù hợp chữ viết tay'}
            </p>
          </div>

          {/* Chọn công trình */}
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1.5 block">Công trình *</label>
            <select
              value={congTrinhId}
              onChange={e => setCongTrinhId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-300 text-gray-700"
            >
              <option value="">-- Chọn công trình --</option>
              {congTrinhs.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.ten_ct}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium text-sm">Click hoặc kéo file vào đây</p>
            <p className="text-gray-400 text-xs mt-1">Hỗ trợ: JPG, PNG, PDF</p>
            <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFile} />
          </div>

          {/* File info */}
          {file && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <span className="text-sm text-blue-700 truncate flex-1">{file.name}</span>
              <span className="text-xs text-blue-400">{(file.size / 1024).toFixed(0)} KB</span>
              <button onClick={reset} className="p-0.5 hover:bg-blue-100 rounded text-blue-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || loading || !congTrinhId}
            className="w-full py-2.5 bg-blue-500 text-white rounded-xl font-medium text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
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
            <p className="text-xs text-amber-600 text-center">Vui lòng chọn công trình trước khi đọc phiếu</p>
          )}
        </div>

        {/* Result card */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">2. Kết quả đọc phiếu</h3>

          {!result && !error && !loading && (
            <div className="flex flex-col items-center justify-center h-56 text-gray-400">
              <Bot className="w-14 h-14 mb-3 text-gray-200" />
              <p className="text-sm">Upload phiếu để AI đọc tự động</p>
              <p className="text-xs mt-1 text-gray-300">Hỗ trợ: ảnh chụp, scan PDF</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-56 text-gray-500">
              <Loader className="w-12 h-12 mb-3 text-blue-400 animate-spin" />
              <p className="text-sm font-medium">AI đang phân tích phiếu...</p>
              <p className="text-xs text-gray-400 mt-1">Có thể mất 30–60 giây</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Đọc phiếu thất bại</p>
                <p className="text-xs text-red-500 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {savedOk && (
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">Lưu phiếu thành công!</p>
                <p className="text-xs text-green-500 mt-0.5">Phiếu đã được lưu vào hệ thống</p>
              </div>
            </div>
          )}

          {result && !savedOk && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Đọc phiếu thành công!</span>
              </div>

              {/* Info phiếu */}
              <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Số phiếu:</span>
                  <span className="ml-1 font-semibold text-gray-700">{phieuData.so_phieu || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Ngày:</span>
                  <span className="ml-1 font-semibold text-gray-700">{phieuData.ngay || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Loại:</span>
                  <span className={`ml-1 font-semibold ${(phieuData.loai || 'NK') === 'NK' ? 'text-green-600' : 'text-orange-600'}`}>
                    {(phieuData.loai || 'NK') === 'NK' ? 'Nhập kho' : 'Xuất kho'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">NCC:</span>
                  <span className="ml-1 font-semibold text-gray-700">{phieuData.doi_tac || phieuData.ncc || '—'}</span>
                </div>
              </div>

              {/* Bảng hàng hóa */}
              {items.length > 0 && (
                <div className="overflow-auto max-h-44 rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-gray-400">#</th>
                        <th className="text-left p-2 text-gray-400">Tên hàng</th>
                        <th className="text-right p-2 text-gray-400">SL</th>
                        <th className="text-left p-2 text-gray-400">DVT</th>
                        <th className="text-right p-2 text-gray-400">Đơn giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="p-2 text-gray-400">{i + 1}</td>
                          <td className="p-2 text-gray-700">{it.ten_hang || it.ten}</td>
                          <td className="p-2 text-right text-gray-700">{fmt(it.so_luong)}</td>
                          <td className="p-2 text-gray-400">{it.dvt}</td>
                          <td className="p-2 text-right text-gray-600">{formatVND(it.don_gia)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-gray-400">{items.length} dòng hàng · Tổng: <strong className="text-gray-700">{formatVND(tong_tien)}</strong></span>
                <button
                  onClick={handleSave}
                  disabled={saving || !congTrinhId}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? <><Loader className="w-4 h-4 animate-spin" /> Đang lưu...</> : <><Save className="w-4 h-4" /> Xác nhận lưu phiếu</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hướng dẫn */}
      <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
        <h4 className="font-semibold text-blue-800 mb-3 text-sm">Hướng dẫn sử dụng AI Reader</h4>
        <div className="grid grid-cols-4 gap-4 text-xs text-blue-700">
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-[10px]">1</span>
            <span>Chọn AI: <b>Gemini</b> (miễn phí), <b>ChatGPT</b> (cần key), hoặc <b>Claude</b> (chính xác cao nhất)</span>
          </div>
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-[10px]">2</span>
            <span>Chọn công trình cần nhập phiếu vào</span>
          </div>
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-[10px]">3</span>
            <span>Upload ảnh chụp hoặc file PDF phiếu nhập / xuất kho</span>
          </div>
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-[10px]">4</span>
            <span>Kiểm tra kết quả AI đọc, sau đó nhấn "Xác nhận lưu phiếu"</span>
          </div>
        </div>
      </div>
    </div>
  )
}
