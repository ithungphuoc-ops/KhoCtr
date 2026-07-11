import React, { useState, useEffect, useRef } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Download, Search, RefreshCw, Eye, Plus, X, Trash2, FileDown, Bot, Loader } from 'lucide-react'
import { getPhieuList, getChiTietPhieu, createPhieu, getHangHoa, docPhieu, docPhieuMulti, matchItems } from '../../api'
import HangHoaInput from '../../components/HangHoaInput'
import HangHoaMatchPopup from '../../components/HangHoaMatchPopup'
import { exportPhieuList } from '../../utils/exportExcel'
import { useAuth } from '../../context/AuthContext'

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')
function formatVND(n) {
  const num = n ?? 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' tỷ'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + ' tr'
  return num.toLocaleString('vi-VN')
}
const today = () => new Date().toISOString().slice(0, 10)

const emptyItem = () => ({ ma_hang: '', ten_hang: '', dvt: 'cái', so_luong: '', don_gia: '', thanh_tien: '', selected: false })
const normalize = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase()

export default function CTNhapKho() {
  const { ctId } = useOutletContext() || {}
  const { id } = useParams()
  const realId = ctId || id
  const { user } = useAuth()

  const [phieuList, setPhieuList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPhieu, setSelectedPhieu] = useState(null)
  const [chiTiet, setChiTiet] = useState([])
  const [loadingCT, setLoadingCT] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Form tao moi
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ so_phieu: '', ngay: today(), doi_tac: '', ghi_chu: '' })
  const [items, setItems] = useState([emptyItem()])
  const [hangHoaList, setHangHoaList] = useState([])
  const [saveMsg, setSaveMsg] = useState(null)

  const loadData = () => {
    setLoading(true)
    getPhieuList({ loai: 'NK', cong_trinh_id: realId, limit: 500 })
      .then(res => setPhieuList(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadHangHoa = () =>
    getHangHoa({ limit: 2000, ...(realId ? { cong_trinh_id: parseInt(realId) } : {}) })
      .then(res => setHangHoaList(res.data?.data || []))
      .catch(() => {})

  // AI states
  const [aiLoading, setAiLoading]         = useState(false)
  const [aiProvider, setAiProvider]       = useState('gemini')
  const [showMatchPopup, setShowMatchPopup] = useState(false)
  const [matchResult, setMatchResult]     = useState(null)
  const [aiMeta, setAiMeta]               = useState({})
  const aiFileRef = useRef()

  const handleAiRead = async (file) => {
    if (!file) return
    setAiLoading(true)
    const t0 = Date.now()
    try {
      // Bước 1: AI đọc PDF (multi cho PDF, single cho ảnh)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('loai', 'NK')
      fd.append('provider', aiProvider)
      if (realId) fd.append('cong_trinh_id', realId)

      const isPdf = file.name.toLowerCase().endsWith('.pdf')
      let data
      if (isPdf) {
        const res = await docPhieuMulti(fd)
        const list = res.data?.phieu_list || []
        // Lấy phiếu đầu tiên để điền form; các phiếu còn lại bỏ qua ở đây
        // (dùng trang AI Reader nếu cần nhập batch)
        data = list[0] || {}
      } else {
        const res = await docPhieu(fd)
        data = res.data
      }

      const rawItems = (data.items || data.hang_hoa || []).map(it => ({
        ten_hang:   it.ten_hang || it.hang || '',
        dvt:        it.dvt || 'cái',
        so_luong:   it.so_luong || 0,
        don_gia:    it.don_gia || 0,
        thanh_tien: it.thanh_tien || (it.so_luong * it.don_gia) || 0,
      }))

      // Pre-fill header từ AI (sẽ hoàn thiện sau khi popup confirm)
      setForm(f => ({
        ...f,
        so_phieu: data.so_phieu || f.so_phieu,
        ngay:     data.ngay || f.ngay,
        doi_tac:  data.doi_tac || data.nha_cung_cap || f.doi_tac,
      }))

      // Bước 2: Phân loại items qua fuzzy match
      const processingMs = Date.now() - t0
      const matchRes = await matchItems({
        cong_trinh_id:     parseInt(realId),
        loai_phieu:        'nhap',
        file_name:         file.name,
        items:             rawItems,
        ai_provider:       aiProvider,
        processing_time_ms: processingMs,
      })
      setMatchResult(matchRes.data)
      setAiMeta({
        fileName:         file.name,
        aiProvider,
        aiModel:          '',
        processingTimeMs: processingMs,
      })
      setShowMatchPopup(true)
      if (hangHoaList.length === 0) loadHangHoa()
    } catch (e) {
      alert(e.response?.data?.detail || 'Lỗi AI đọc phiếu. Vui lòng thử lại.')
    } finally {
      setAiLoading(false)
      if (aiFileRef.current) aiFileRef.current.value = ''
    }
  }

  useEffect(() => {
    loadData()
    loadHangHoa()
  }, [realId])

  const openChiTiet = (phieu) => {
    setSelectedPhieu(phieu)
    setLoadingCT(true)
    getChiTietPhieu(phieu.id)
      .then(res => setChiTiet(res.data?.items || []))
      .catch(() => setChiTiet([]))
      .finally(() => setLoadingCT(false))
  }

  const filtered = phieuList.filter(p =>
    !search ||
    (p.so_phieu || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.doi_tac || '').toLowerCase().includes(search.toLowerCase())
  )

  // Items logic
  const updateItem = (i, field, val) => {
    const next = [...items]
    next[i] = { ...next[i], [field]: val }
    if (field === 'ten_hang') next[i].selected = false  // mở khóa DVT khi gõ tay
    // Tự tính thành tiền
    if (field === 'so_luong' || field === 'don_gia') {
      const sl = field === 'so_luong' ? parseFloat(val) : parseFloat(next[i].so_luong)
      const dg = field === 'don_gia' ? parseFloat(val) : parseFloat(next[i].don_gia)
      next[i].thanh_tien = (!isNaN(sl) && !isNaN(dg)) ? sl * dg : ''
    }
    setItems(next)
  }

  const addItem = () => setItems([...items, emptyItem()])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))

  const tongTien = items.reduce((s, it) => s + (parseFloat(it.thanh_tien) || 0), 0)


  const handleSave = async () => {
    if (!form.so_phieu || !form.ngay) { setSaveMsg({ type: 'err', text: 'Vui lòng nhập số phiếu và ngày' }); return }
    const validItems = items.filter(it => it.ten_hang && parseFloat(it.so_luong) > 0)
    if (validItems.length === 0) { setSaveMsg({ type: 'err', text: 'Cần ít nhất 1 dòng hàng hợp lệ' }); return }
    if (hangHoaList.length > 0) {
      const invalid = validItems.find(it =>
        !hangHoaList.some(h => normalize(h.ten_hang) === normalize(it.ten_hang))
      )
      if (invalid) {
        setSaveMsg({ type: 'err', text: `"${invalid.ten_hang}" không có trong danh mục. Vui lòng chọn từ danh sách gợi ý.` })
        return
      }
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      await createPhieu({
        cong_trinh_id: parseInt(realId),
        loai: 'NK',
        so_phieu: form.so_phieu,
        ngay: form.ngay,
        doi_tac: form.doi_tac,
        ghi_chu: form.ghi_chu,
        tong_tien: tongTien,
        user_email: user?.email || '',
        items: validItems.map(it => ({
          ten_hang: it.ten_hang,
          dvt: it.dvt || 'cái',
          so_luong: parseFloat(it.so_luong) || 0,
          don_gia: parseFloat(it.don_gia) || 0,
          thanh_tien: parseFloat(it.thanh_tien) || 0,
        }))
      })
      setSaveMsg({ type: 'ok', text: 'Lưu phiếu thành công!' })
      setForm({ so_phieu: '', ngay: today(), doi_tac: '', ghi_chu: '' })
      setItems([emptyItem()])
      setShowForm(false)
      loadData()
    } catch (e) {
      setSaveMsg({ type: 'err', text: e.response?.data?.detail || 'Lỗi khi lưu phiếu' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">PHIẾU NHẬP KHO</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">{phieuList.length} phiếu nhập</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-hp-surface hover:bg-hp-elevated text-hp-text-secondary rounded-lg text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={async () => {
              setExporting(true)
              try {
                await exportPhieuList({ phieuList: filtered, loai: 'NK' })
              } catch (e) { alert(e.message) }
              finally { setExporting(false) }
            }}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-hp-primary/15 hover:bg-hp-primary/25 text-hp-primary rounded-lg text-sm disabled:opacity-50">
            <FileDown className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? '...' : 'Excel'}
          </button>
          {/* AI provider toggle nhỏ */}
          <select
            value={aiProvider}
            onChange={e => setAiProvider(e.target.value)}
            className="px-2 py-2 border border-hp-border rounded-lg text-xs text-hp-text-secondary bg-hp-card focus:outline-none">
            <option value="gemini">🆓 Gemini</option>
            <option value="openai">🤖 ChatGPT</option>
            <option value="claude">⚡ Claude</option>
          </select>
          <button
            onClick={() => aiFileRef.current?.click()}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-hp-accent hover:bg-hp-accent/90 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {aiLoading
              ? <><Loader className="w-4 h-4 animate-spin" /> AI đang đọc...</>
              : <><Bot className="w-4 h-4" /> AI đọc PDF</>
            }
          </button>
          <input
            ref={aiFileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
            onChange={e => handleAiRead(e.target.files?.[0])}
          />
          <button onClick={() => { if (hangHoaList.length === 0) loadHangHoa(); setShowForm(true); setSaveMsg(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-hp-primary hover:bg-hp-primary/90 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Tạo phiếu NK
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={`p-3 rounded-xl text-sm font-medium ${saveMsg.type === 'ok' ? 'bg-hp-primary/15 text-hp-primary' : 'bg-hp-danger/15 text-hp-danger'}`}>
          {saveMsg.text}
        </div>
      )}

      {/* Filter */}
      <div className="bg-hp-card rounded-xl border border-hp-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm số phiếu, NCC..."
            className="w-full pl-9 pr-4 py-2 border border-hp-border rounded-lg text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-xl border border-hp-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-hp-surface border-b border-hp-border">
            <tr>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">#</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Số phiếu</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Ngày</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">NCC</th>
              <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tổng tiền</th>
              <th className="text-center px-4 py-3 text-hp-text-secondary font-medium">CT</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={6} className="py-8 text-center text-hp-text-muted">Đang tải...</td></tr>
              : filtered.length === 0
                ? <tr><td colSpan={6} className="py-8 text-center text-hp-text-muted">Chưa có phiếu nhập kho</td></tr>
                : filtered.map((p, i) => (
                    <tr key={p.id} className="border-b border-hp-border hover:bg-hp-elevated">
                      <td className="px-4 py-3 text-hp-text-muted text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-hp-primary">{p.so_phieu}</td>
                      <td className="px-4 py-3 text-hp-text-secondary text-xs">{p.ngay}</td>
                      <td className="px-4 py-3 text-hp-text-secondary text-xs truncate max-w-[120px]">{p.doi_tac || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-hp-primary">{formatVND(p.tong_tien)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openChiTiet(p)}
                          className="p-1.5 hover:bg-hp-primary/10 text-hp-text-muted hover:text-hp-primary rounded-lg">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
            }
          </tbody>
          {!loading && filtered.length > 0 && (
            <tfoot className="bg-hp-primary/10 border-t-2 border-hp-border">
              <tr>
                <td colSpan={4} className="px-4 py-2 font-bold text-hp-text text-sm">Tổng ({filtered.length} phiếu)</td>
                <td className="px-4 py-2 text-right font-bold text-hp-primary">
                  {formatVND(filtered.reduce((s, p) => s + (p.tong_tien || 0), 0))}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Modal chi tiet */}
      {selectedPhieu && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedPhieu(null) }}>
          <div className="bg-hp-elevated rounded-xl shadow-md w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-hp-border">
              <div>
                <h3 className="font-bold text-hp-primary">{selectedPhieu.so_phieu}</h3>
                <p className="text-xs text-hp-text-secondary">{selectedPhieu.ngay}{selectedPhieu.doi_tac ? ` · ${selectedPhieu.doi_tac}` : ''}</p>
              </div>
              <button onClick={() => setSelectedPhieu(null)} className="p-1 hover:bg-hp-elevated rounded-lg"><X className="w-5 h-5 text-hp-text-muted" /></button>
            </div>
            <div className="overflow-auto flex-1 p-5">
              {loadingCT
                ? <div className="text-center py-8 text-hp-text-muted">Đang tải...</div>
                : <table className="w-full text-sm">
                    <thead className="bg-hp-surface">
                      <tr>
                        <th className="text-left p-2 text-hp-text-secondary">#</th>
                        <th className="text-left p-2 text-hp-text-secondary">Tên hàng</th>
                        <th className="text-right p-2 text-hp-text-secondary">SL</th>
                        <th className="text-left p-2 text-hp-text-secondary">ĐVT</th>
                        <th className="text-right p-2 text-hp-text-secondary">Đơn giá</th>
                        <th className="text-right p-2 text-hp-text-secondary">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chiTiet.map((it, i) => (
                        <tr key={i} className="border-b border-hp-border">
                          <td className="p-2 text-hp-text-muted">{i+1}</td>
                          <td className="p-2 text-hp-text">{it.ten_hang}</td>
                          <td className="p-2 text-right">{fmt(it.so_luong)}</td>
                          <td className="p-2 text-hp-text-secondary text-xs">{it.dvt}</td>
                          <td className="p-2 text-right text-hp-text-secondary">{formatVND(it.don_gia)}</td>
                          <td className="p-2 text-right font-medium">{formatVND(it.thanh_tien)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
            <div className="p-4 border-t border-hp-border bg-hp-surface flex justify-between text-sm">
              <span className="text-hp-text-secondary">{chiTiet.length} dòng</span>
              <span className="font-bold text-hp-primary">Tổng: {formatVND(selectedPhieu.tong_tien)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal tao phieu */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-hp-elevated rounded-xl shadow-md w-full max-w-4xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-hp-border bg-hp-surface rounded-t-xl">
              <div>
                <h3 className="font-bold text-hp-text text-lg">Tạo phiếu nhập kho mới</h3>
                <p className="text-xs text-hp-text-secondary mt-0.5">
                  {hangHoaList.length > 0 ? `${hangHoaList.length} mặt hàng trong danh mục` : '⚠ Danh mục chưa tải'}
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-hp-card rounded-lg"><X className="w-5 h-5 text-hp-text-muted" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Form header */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-hp-text-secondary font-medium">Số phiếu *</label>
                  <input value={form.so_phieu} onChange={e => setForm({...form, so_phieu: e.target.value})}
                    placeholder="VD: NK-001"
                    className="mt-1 w-full border border-hp-border rounded-lg px-3 py-2 text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary font-medium">Ngày *</label>
                  <input type="date" value={form.ngay} onChange={e => setForm({...form, ngay: e.target.value})}
                    className="mt-1 w-full border border-hp-border rounded-lg px-3 py-2 text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary font-medium">NCC / Đối tác</label>
                  <input value={form.doi_tac} onChange={e => setForm({...form, doi_tac: e.target.value})}
                    placeholder="Tên nhà cung cấp"
                    className="mt-1 w-full border border-hp-border rounded-lg px-3 py-2 text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary font-medium">Ghi chú</label>
                  <input value={form.ghi_chu} onChange={e => setForm({...form, ghi_chu: e.target.value})}
                    className="mt-1 w-full border border-hp-border rounded-lg px-3 py-2 text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
              </div>

              {/* Items table */}
              <div className="border border-hp-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-hp-surface">
                    <tr>
                      <th className="text-left px-3 py-2 text-hp-text-secondary font-medium w-8">#</th>
                      <th className="text-left px-3 py-2 text-hp-text-secondary font-medium">Tên hàng hóa</th>
                      <th className="text-left px-3 py-2 text-hp-text-secondary font-medium w-20">ĐVT</th>
                      <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-24">Số lượng</th>
                      <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-28">Đơn giá</th>
                      <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-28">Thành tiền</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t border-hp-border hover:bg-hp-elevated">
                        <td className="px-3 py-1.5 text-hp-text-muted text-xs">{i+1}</td>
                        <td className="px-3 py-1.5">
                          <HangHoaInput
                            value={it.ten_hang}
                            onChange={(val) => updateItem(i, 'ten_hang', val)}
                            onSelect={(hh) => {
                              const next = [...items]
                              next[i] = { ...next[i], ma_hang: hh.ma_hang || '', ten_hang: hh.ten_hang, dvt: hh.dvt || 'cái', selected: true }
                              setItems(next)
                            }}
                            hangHoaList={hangHoaList}
                            theme="green"
                            placeholder="Tên hàng..."
                            isAdmin={user?.role === 'admin'}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input value={it.dvt} onChange={e => updateItem(i, 'dvt', e.target.value)}
                            readOnly={!!it.selected}
                            className={`w-full border border-hp-border rounded px-2 py-1 text-xs bg-hp-card text-hp-text focus:outline-none ${it.selected ? 'bg-hp-surface text-hp-text-secondary cursor-default' : 'focus:ring-2 focus:ring-hp-accent'}`} />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" value={it.so_luong} onChange={e => updateItem(i, 'so_luong', e.target.value)}
                            placeholder="0"
                            className="w-full border border-hp-border rounded px-2 py-1 text-xs text-right bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" value={it.don_gia} onChange={e => updateItem(i, 'don_gia', e.target.value)}
                            placeholder="0"
                            className="w-full border border-hp-border rounded px-2 py-1 text-xs text-right bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs font-medium text-hp-text">
                          {it.thanh_tien ? formatVND(parseFloat(it.thanh_tien)) : '—'}
                        </td>
                        <td className="px-2">
                          <button onClick={() => removeItem(i)} disabled={items.length === 1}
                            className="p-1 hover:bg-hp-danger/10 text-hp-text-disabled hover:text-hp-danger rounded disabled:opacity-30">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t border-hp-border flex justify-between items-center bg-hp-surface">
                  <button onClick={addItem} className="text-xs text-hp-accent hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Thêm dòng
                  </button>
                  <span className="text-sm font-bold text-hp-text">Tổng: {formatVND(tongTien)}</span>
                </div>
              </div>

              {saveMsg && (
                <div className={`p-3 rounded-xl text-sm ${saveMsg.type === 'ok' ? 'bg-hp-primary/15 text-hp-primary' : 'bg-hp-danger/15 text-hp-danger'}`}>
                  {saveMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2 border border-hp-border rounded-lg text-sm text-hp-text-secondary hover:bg-hp-elevated">
                  Hủy
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-2 bg-hp-primary hover:bg-hp-primary/90 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                  {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu...</> : 'Lưu phiếu NK'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Fuzzy Match Popup */}
      <HangHoaMatchPopup
        isOpen={showMatchPopup}
        onClose={() => setShowMatchPopup(false)}
        matchResult={matchResult}
        congTrinhId={parseInt(realId)}
        loaiPhieu="nhap"
        fileName={aiMeta.fileName || ''}
        aiProvider={aiMeta.aiProvider || aiProvider}
        aiModel={aiMeta.aiModel || ''}
        processingTimeMs={aiMeta.processingTimeMs || 0}
        onConfirm={(confirmedItems) => {
          setShowMatchPopup(false)
          setItems(confirmedItems.map(it => ({
            ma_hang:    '',
            ten_hang:   it.ten_hang,
            dvt:        it.dvt || 'cái',
            so_luong:   it.so_luong || '',
            don_gia:    it.don_gia || '',
            thanh_tien: it.thanh_tien || '',
            selected:   false,
          })))
          setShowForm(true)
          setSaveMsg(null)
        }}
      />
    </div>
  )
}
