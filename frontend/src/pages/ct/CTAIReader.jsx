import React, { useState, useRef } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Upload, FileText, Loader, CheckCircle, AlertCircle, Save, X, Plus, Trash2, RefreshCw, Bot, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { docPhieu, docPhieuMulti, createPhieu } from '../../api'

function formatVND(n) {
  const num = n ?? 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' tỷ'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + ' tr'
  return num.toLocaleString('vi-VN')
}
const today = () => new Date().toISOString().slice(0, 10)

// ── Single phieu editor ──────────────────────────────────────
function PhieuEditor({ data, loai, realId, onSaved, onCancel, provider }) {
  const [soPhieu, setSoPhieu] = useState(data.so_phieu || '')
  const [ngay, setNgay] = useState(data.ngay || today())
  const [doiTac, setDoiTac] = useState(data.doi_tac || data.nha_cung_cap || '')
  const [items, setItems] = useState((data.items || data.hang_hoa || []).map(it => ({
    ten_hang: it.ten_hang || it.hang || '',
    dvt: it.dvt || 'cai',
    so_luong: it.so_luong || 0,
    don_gia: it.don_gia || 0,
    thanh_tien: it.thanh_tien || (it.so_luong * it.don_gia) || 0,
  })))
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

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
      setSaveMsg({ type: 'ok', text: `Đã lưu phiếu ${loai} ${soPhieu}!` })
      if (onSaved) setTimeout(() => onSaved(soPhieu), 800)
    } catch (e) {
      setSaveMsg({ type: 'err', text: e.response?.data?.detail || 'Lỗi khi lưu phiếu' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-hp-text-secondary font-medium">Số phiếu</label>
          <input value={soPhieu} onChange={e => setSoPhieu(e.target.value)}
            className="mt-1 w-full min-h-10 bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
        <div>
          <label className="text-xs text-hp-text-secondary font-medium">Ngày</label>
          <input type="date" value={ngay} onChange={e => setNgay(e.target.value)}
            className="mt-1 w-full min-h-10 bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
        <div>
          <label className="text-xs text-hp-text-secondary font-medium">{loai === 'NK' ? 'NCC' : 'Người nhận'}</label>
          <input value={doiTac} onChange={e => setDoiTac(e.target.value)}
            className="mt-1 w-full min-h-10 bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
      </div>

      <div className="border border-hp-border rounded-hp-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-hp-surface">
            <tr>
              <th className="text-left px-3 py-2 text-hp-text-secondary font-medium w-8">#</th>
              <th className="text-left px-3 py-2 text-hp-text-secondary font-medium">Tên hàng</th>
              <th className="text-left px-3 py-2 text-hp-text-secondary font-medium w-20">DVT</th>
              <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-24">SL</th>
              <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-28">Đơn giá</th>
              <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-28">Thành tiền</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-hp-border">
                <td className="px-3 py-1.5 text-hp-text-muted text-xs">{i + 1}</td>
                <td className="px-3 py-1.5">
                  <input value={it.ten_hang} onChange={e => updateItem(i, 'ten_hang', e.target.value)}
                    className="w-full bg-hp-surface border border-hp-border rounded-hp-sm px-2 py-1 text-xs text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </td>
                <td className="px-3 py-1.5">
                  <input value={it.dvt} onChange={e => updateItem(i, 'dvt', e.target.value)}
                    className="w-full bg-hp-surface border border-hp-border rounded-hp-sm px-2 py-1 text-xs text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </td>
                <td className="px-3 py-1.5">
                  <input type="number" value={it.so_luong} onChange={e => updateItem(i, 'so_luong', e.target.value)}
                    className="w-full bg-hp-surface border border-hp-border rounded-hp-sm px-2 py-1 text-xs text-hp-text text-right focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </td>
                <td className="px-3 py-1.5">
                  <input type="number" value={it.don_gia} onChange={e => updateItem(i, 'don_gia', e.target.value)}
                    className="w-full bg-hp-surface border border-hp-border rounded-hp-sm px-2 py-1 text-xs text-hp-text text-right focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </td>
                <td className="px-3 py-1.5 text-right text-xs font-medium text-hp-text">
                  {formatVND(parseFloat(it.thanh_tien) || 0)}
                </td>
                <td className="px-2">
                  <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                    className="p-1 hover:bg-hp-danger/15 text-hp-text-muted hover:text-hp-danger rounded-hp-sm">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t border-hp-border flex justify-between items-center bg-hp-surface">
          <button onClick={() => setItems([...items, { ten_hang: '', dvt: 'cai', so_luong: 0, don_gia: 0, thanh_tien: 0 }])}
            className="text-xs text-hp-accent hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Thêm dòng
          </button>
          <span className="text-sm font-bold text-hp-text">Tổng: {formatVND(tongTien)}</span>
        </div>
      </div>

      {saveMsg && (
        <div className={`p-3 rounded-hp-lg text-sm font-medium ${saveMsg.type === 'ok' ? 'bg-hp-primary/15 text-hp-primary' : 'bg-hp-danger/15 text-hp-danger'}`}>
          {saveMsg.text}
        </div>
      )}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button onClick={onCancel}
            className="min-h-10 px-5 py-2 border border-hp-border rounded-hp-md text-sm text-hp-text-secondary hover:bg-hp-elevated">
            Hủy
          </button>
        )}
        <button onClick={handleSave} disabled={saving}
          className={`min-h-10 px-6 py-2 text-white rounded-hp-md text-sm font-medium disabled:opacity-50 flex items-center gap-2 ${loai === 'NK' ? 'bg-hp-primary hover:bg-hp-primary/90' : 'bg-hp-warning hover:bg-hp-warning/90'}`}>
          {saving
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu...</>
            : <><Save className="w-4 h-4" /> Lưu Phiếu {loai}</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Multi phieu list ─────────────────────────────────────────
function MultiPhieuList({ phieuList, loai, realId, provider }) {
  const [expanded, setExpanded] = useState(null)
  const [savedSet, setSavedSet] = useState(new Set())

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-hp-primary">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold">AI đọc xong — tìm thấy <span className="font-bold">{phieuList.length} phiếu</span></span>
        </div>
        <span className="text-xs text-hp-text-muted">{savedSet.size}/{phieuList.length} đã lưu</span>
      </div>

      {phieuList.map((p, idx) => {
        const isSaved = savedSet.has(idx)
        const isOpen = expanded === idx
        const soP = p.so_phieu || `Phiếu ${idx + 1}`
        return (
          <div key={idx} className={`border rounded-hp-lg overflow-hidden transition-colors ${isSaved ? 'border-hp-primary/40 bg-hp-primary/5' : 'border-hp-border bg-hp-card'}`}>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-hp-elevated/50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : idx)}
            >
              <span className="text-xs font-medium text-hp-text-muted w-6">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-hp-text">{soP}</span>
                {p.ngay && <span className="ml-2 text-xs text-hp-text-secondary">{p.ngay}</span>}
                {p.doi_tac && <span className="ml-2 text-xs text-hp-text-muted truncate">· {p.doi_tac}</span>}
              </div>
              <span className="text-xs text-hp-text-muted">{(p.items || []).length} mặt hàng</span>
              {isSaved && <span className="text-xs font-medium text-hp-primary bg-hp-primary/15 px-2 py-0.5 rounded-full">Đã lưu</span>}
              {isOpen ? <ChevronUp className="w-4 h-4 text-hp-text-muted flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-hp-text-muted flex-shrink-0" />}
            </button>

            {isOpen && !isSaved && (
              <div className="border-t border-hp-border px-4 py-4">
                <PhieuEditor
                  data={p}
                  loai={loai}
                  realId={realId}
                  provider={provider}
                  onSaved={() => {
                    setSavedSet(prev => new Set([...prev, idx]))
                    setExpanded(null)
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────
export default function CTAIReader() {
  const { ctId } = useOutletContext() || {}
  const { id } = useParams()
  const realId = ctId || id

  const [file, setFile] = useState(null)
  const [loai, setLoai] = useState('NK')
  const [provider, setProvider] = useState('gemini')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)      // single phieu
  const [multiResult, setMultiResult] = useState(null) // list phieu
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const isPdf = file?.name?.toLowerCase().endsWith('.pdf')

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (f) { setFile(f); setResult(null); setMultiResult(null); setError(null) }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setResult(null); setMultiResult(null); setError(null) }
  }

  const handleDoc = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null); setMultiResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('provider', provider)
      fd.append('loai', loai)

      if (isPdf) {
        // PDF → đọc nhiều phiếu
        const res = await docPhieuMulti(fd)
        const list = res.data?.phieu_list || []
        if (list.length === 1) {
          setResult(list[0])   // 1 phiếu → dùng form đơn cho gọn
        } else {
          setMultiResult(list)
        }
      } else {
        // Ảnh → đọc 1 phiếu
        const res = await docPhieu(fd)
        setResult(res.data)
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Có lỗi khi đọc phiếu. Thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

  const providerLabel = provider === 'gemini' ? '🆓 Gemini (Free)'
    : provider === 'openai' ? '🤖 ChatGPT'
    : 'Claude Sonnet'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-hp-text">AI ĐỌC PDF</h1>
        <p className="text-hp-text-secondary mt-1 text-sm">Upload PDF hoặc ảnh phiếu kho, AI tự động đọc và điền vào form</p>
      </div>

      {/* Upload + loai */}
      <div className="bg-hp-card rounded-hp-lg border border-hp-border p-5">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="text-xs text-hp-text-secondary font-medium block mb-1">Loại phiếu</label>
            <div className="flex gap-2">
              <button onClick={() => setLoai('NK')}
                className={`min-h-10 px-4 py-2 rounded-hp-md text-sm font-medium transition-colors ${loai === 'NK' ? 'bg-hp-primary text-white' : 'bg-hp-elevated text-hp-text-secondary hover:bg-hp-elevated/80'}`}>
                Nhập kho (NK)
              </button>
              <button onClick={() => setLoai('XK')}
                className={`min-h-10 px-4 py-2 rounded-hp-md text-sm font-medium transition-colors ${loai === 'XK' ? 'bg-hp-warning text-white' : 'bg-hp-elevated text-hp-text-secondary hover:bg-hp-elevated/80'}`}>
                Xuất kho (XK)
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-hp-text-secondary font-medium block mb-1">AI đọc phiếu</label>
            <div className="flex gap-1 p-1 bg-hp-surface rounded-hp-md">
              <button onClick={() => setProvider('gemini')}
                className={"flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'gemini' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                🆓 Gemini
              </button>
              <button onClick={() => setProvider('openai')}
                className={"flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'openai' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                🤖 ChatGPT
              </button>
              <button onClick={() => setProvider('claude')}
                className={"flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (provider === 'claude' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                <Zap className="w-3 h-3 text-hp-accent" /> Claude
              </button>
            </div>
          </div>
        </div>

        <div
          className="border-2 border-dashed border-hp-border rounded-hp-lg p-8 text-center cursor-pointer bg-hp-card hover:border-hp-accent hover:bg-hp-accent/10 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <Upload className="w-10 h-10 text-hp-text-muted mx-auto mb-2" />
          <p className="text-hp-text-secondary font-medium text-sm">Click hoặc kéo thả file vào đây</p>
          <p className="text-hp-text-muted text-xs mt-1">PDF nhiều phiếu hoặc ảnh JPG/PNG</p>
          <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFile} />
        </div>

        {file && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-hp-accent/15 rounded-hp-lg">
            <FileText className="w-4 h-4 text-hp-accent flex-shrink-0" />
            <span className="text-sm text-hp-accent truncate flex-1">{file.name}</span>
            <span className="text-xs text-hp-text-muted">{(file.size / 1024).toFixed(0)} KB</span>
            {isPdf && <span className="text-xs bg-hp-primary/15 text-hp-primary px-2 py-0.5 rounded-full font-medium">PDF · đọc tất cả trang</span>}
            <button onClick={() => { setFile(null); setResult(null); setMultiResult(null) }} className="text-hp-text-muted hover:text-hp-text">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          onClick={handleDoc}
          disabled={!file || loading}
          className="mt-4 w-full min-h-10 py-2.5 bg-hp-primary text-white rounded-hp-lg font-medium text-sm hover:bg-hp-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading
            ? <><Loader className="w-4 h-4 animate-spin" /> AI đang đọc{isPdf ? ' tất cả trang' : ''}...</>
            : <>
                {provider === 'gemini' ? '🆓' : provider === 'openai' ? '🤖' : <Zap className="w-4 h-4" />}
                &nbsp;Đọc phiếu bằng {providerLabel}
                {isPdf && <span className="ml-1 text-xs opacity-80">(PDF)</span>}
              </>
          }
        </button>
        {loading && <p className="text-xs text-hp-text-muted text-center mt-2">Quá trình này mất 10-60 giây{isPdf ? ', đọc toàn bộ file PDF' : ''}</p>}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-hp-danger/15 rounded-hp-lg border border-hp-danger/30">
          <AlertCircle className="w-5 h-5 text-hp-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-hp-danger">{error}</p>
        </div>
      )}

      {/* Kết quả 1 phiếu */}
      {result && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-hp-primary">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">AI đọc xong — kiểm tra và xác nhận trước khi lưu</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-hp-accent/15 text-hp-accent text-xs font-medium rounded-full border border-hp-accent/30">
              {providerLabel}
            </span>
          </div>
          <PhieuEditor
            data={result}
            loai={loai}
            realId={realId}
            provider={provider}
            onSaved={() => { setResult(null); setFile(null) }}
            onCancel={() => { setResult(null); setFile(null) }}
          />
        </div>
      )}

      {/* Kết quả nhiều phiếu */}
      {multiResult && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-5">
          <MultiPhieuList
            phieuList={multiResult}
            loai={loai}
            realId={realId}
            provider={provider}
          />
        </div>
      )}
    </div>
  )
}
