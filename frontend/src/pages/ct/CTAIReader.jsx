import React, { useState, useRef } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Upload, FileText, Loader, CheckCircle, AlertCircle, Save, X, Plus, Trash2, RefreshCw, Bot, Zap } from 'lucide-react'
import { docPhieu, createPhieu } from '../../api'

function formatVND(n) {
  const num = n ?? 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' tỷ'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + ' tr'
  return num.toLocaleString('vi-VN')
}
const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')
const today = () => new Date().toISOString().slice(0, 10)

export default function CTAIReader() {
  const { ctId } = useOutletContext() || {}
  const { id } = useParams()
  const realId = ctId || id

  const [file, setFile] = useState(null)
  const [loai, setLoai] = useState('NK')
  const [provider, setProvider] = useState('gemini') // 'gemini' | 'claude'
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  // Editing state
  const [soPhieu, setSoPhieu] = useState('')
  const [ngay, setNgay] = useState(today())
  const [doiTac, setDoiTac] = useState('')
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (f) { setFile(f); setResult(null); setError(null); setSaveMsg(null) }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setResult(null); setError(null); setSaveMsg(null) }
  }

  const handleDoc = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null); setSaveMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('provider', provider)
      const res = await docPhieu(fd)
      const data = res.data
      setResult(data)
      // Pre-fill form
      setSoPhieu(data.so_phieu || '')
      setNgay(data.ngay || today())
      setDoiTac(data.doi_tac || data.nha_cung_cap || '')
      setItems((data.items || data.hang_hoa || []).map(it => ({
        ten_hang: it.ten_hang || it.hang || '',
        dvt: it.dvt || 'cai',
        so_luong: it.so_luong || 0,
        don_gia: it.don_gia || 0,
        thanh_tien: it.thanh_tien || (it.so_luong * it.don_gia) || 0,
      })))
    } catch (e) {
      setError(e.response?.data?.detail || 'Có lỗi khi đọc phiếu. Thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

  const updateItem = (i, field, val) => {
    const next = [...items]
    next[i] = { ...next[i], [field]: val }
    if (field === 'so_luong' || field === 'don_gia') {
      const sl = parseFloat(field === 'so_luong' ? val : next[i].so_luong)
      const dg = parseFloat(field === 'don_gia' ? val : next[i].don_gia)
      next[i].thanh_tien = (!isNaN(sl) && !isNaN(dg)) ? sl * dg : 0
    }
    setItems(next)
  }

  const tongTien = items.reduce((s, it) => s + (parseFloat(it.thanh_tien) || 0), 0)

  const handleSave = async () => {
    if (!soPhieu) { setSaveMsg({ type: 'err', text: 'Vui lòng nhập số phiếu' }); return }
    const validItems = items.filter(it => it.ten_hang && parseFloat(it.so_luong) > 0)
    if (validItems.length === 0) { setSaveMsg({ type: 'err', text: 'Cần ít nhất 1 dòng hàng' }); return }
    setSaving(true); setSaveMsg(null)
    try {
      await createPhieu({
        cong_trinh_id: parseInt(realId),
        loai,
        so_phieu: soPhieu,
        ngay,
        doi_tac: doiTac,
        tong_tien: tongTien,
        items: validItems.map(it => ({
          ten_hang: it.ten_hang,
          dvt: it.dvt || 'cai',
          so_luong: parseFloat(it.so_luong) || 0,
          don_gia: parseFloat(it.don_gia) || 0,
          thanh_tien: parseFloat(it.thanh_tien) || 0,
        }))
      })
      setSaveMsg({ type: 'ok', text: `Đã lưu phiếu ${loai} thành công!` })
      setFile(null); setResult(null)
      setSoPhieu(''); setNgay(today()); setDoiTac(''); setItems([])
    } catch (e) {
      setSaveMsg({ type: 'err', text: e.response?.data?.detail || 'Lỗi khi lưu phiếu' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">AI ĐỌC PDF</h1>
        <p className="text-gray-500 mt-1 text-sm">Upload PDF hoặc ảnh phiếu kho, AI tự động đọc và điền vào form</p>
      </div>

      {/* Upload + loai */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Loại phiếu</label>
            <div className="flex gap-2">
              <button onClick={() => setLoai('NK')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${loai === 'NK' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Nhập kho (NK)
              </button>
              <button onClick={() => setLoai('XK')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${loai === 'XK' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Xuất kho (XK)
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">AI đọc phiếu</label>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              <button onClick={() => setProvider('gemini')}
                className={"flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'gemini' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                🆓 Gemini
              </button>
              <button onClick={() => setProvider('openai')}
                className={"flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'openai' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                🤖 ChatGPT
              </button>
              <button onClick={() => setProvider('claude')}
                className={"flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'claude' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                <Zap className="w-3 h-3 text-purple-500" /> Claude
              </button>
            </div>
          </div>
        </div>

        <div
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-600 font-medium text-sm">Click hoặc kéo thả file vào đây</p>
          <p className="text-gray-400 text-xs mt-1">Hỗ trợ: JPG, PNG, PDF</p>
          <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFile} />
        </div>

        {file && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-teal-50 rounded-xl">
            <FileText className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span className="text-sm text-teal-700 truncate flex-1">{file.name}</span>
            <span className="text-xs text-teal-400">{(file.size / 1024).toFixed(0)} KB</span>
            <button onClick={() => { setFile(null); setResult(null) }} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          onClick={handleDoc}
          disabled={!file || loading}
          className="mt-4 w-full py-2.5 bg-teal-500 text-white rounded-xl font-medium text-sm hover:bg-teal-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading
            ? <><Loader className="w-4 h-4 animate-spin" /> AI đang đọc phiếu...</>
            : provider === 'gemini'
              ? '🆓 Đọc phiếu bằng Gemini (Free)'
              : provider === 'openai'
              ? '🤖 Đọc phiếu bằng ChatGPT'
              : <><Zap className="w-4 h-4" /> Đọc phiếu bằng Claude</>
          }
        </button>
        {loading && <p className="text-xs text-gray-400 text-center mt-2">Quá trình này mất 10-60 giây</p>}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Ket qua - cho sua truoc khi luu */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">AI đọc xong — kiểm tra và xác nhận trước khi lưu</span>
            </div>
            {provider === 'gemini'
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">🆓 Gemini Free</span>
              : provider === 'openai'
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100">🤖 ChatGPT gpt-4o-mini</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-600 text-xs font-medium rounded-full border border-purple-100"><Zap className="w-3 h-3" /> Claude Sonnet</span>
            }
          </div>

          {/* Header phieu */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Số phiếu</label>
              <input value={soPhieu} onChange={e => setSoPhieu(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Ngày</label>
              <input type="date" value={ngay} onChange={e => setNgay(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">{loai === 'NK' ? 'NCC' : 'Người nhận'}</label>
              <input value={doiTac} onChange={e => setDoiTac(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
          </div>

          {/* Items */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">#</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Tên hàng</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium w-20">DVT</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium w-24">SL</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium w-28">Đơn giá</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium w-28">Thành tiền</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-400 text-xs">{i+1}</td>
                    <td className="px-3 py-1.5">
                      <input value={it.ten_hang} onChange={e => updateItem(i, 'ten_hang', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-300" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input value={it.dvt} onChange={e => updateItem(i, 'dvt', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-300" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="number" value={it.so_luong} onChange={e => updateItem(i, 'so_luong', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-teal-300" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="number" value={it.don_gia} onChange={e => updateItem(i, 'don_gia', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-teal-300" />
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-medium text-gray-700">
                      {formatVND(parseFloat(it.thanh_tien) || 0)}
                    </td>
                    <td className="px-2">
                      <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                        className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50">
              <button onClick={() => setItems([...items, { ten_hang: '', dvt: 'cai', so_luong: 0, don_gia: 0, thanh_tien: 0 }])}
                className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Thêm dòng
              </button>
              <span className="text-sm font-bold text-gray-700">Tổng: {formatVND(tongTien)}</span>
            </div>
          </div>

          {saveMsg && (
            <div className={`p-3 rounded-xl text-sm font-medium ${saveMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {saveMsg.text}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={() => { setResult(null); setFile(null) }}
              className="px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Hủy
            </button>
            <button onClick={handleSave} disabled={saving}
              className={`px-6 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 ${loai === 'NK' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
              {saving
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu...</>
                : <><Save className="w-4 h-4" /> Lưu Phiếu {loai}</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
