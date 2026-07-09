import React, { useState, useEffect, useRef } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Download, Search, RefreshCw, Eye, Plus, X, Trash2, FileDown, Bot, Loader } from 'lucide-react'
import { getPhieuList, getChiTietPhieu, createPhieu, getHangHoa, docPhieu, matchItems } from '../../api'
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
      // Bước 1: AI đọc PDF
      const fd = new FormData()
      fd.append('file', file)
      fd.append('loai', 'NK')
      fd.append('provider', aiProvider)
      if (realId) fd.append('cong_trinh_id', realId)
      const res = await docPhieu(fd)
      const data = res.data
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
          <h1 className="text-2xl font-bold text-gray-800">PHIẾU NHẬP KHO</h1>
          <p className="text-gray-500 mt-1 text-sm">{phieuList.length} phiếu nhập</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-sm disabled:opacity-50">
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
            className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm disabled:opacity-50">
            <FileDown className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? '...' : 'Excel'}
          </button>
          {/* AI provider toggle nhỏ */}
          <select
            value={aiProvider}
            onChange={e => setAiProvider(e.target.value)}
            className="px-2 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white focus:outline-none">
            <option value="gemini">🆓 Gemini</option>
            <option value="openai">🤖 ChatGPT</option>
            <option value="claude">⚡ Claude</option>
          </select>
          <button
            onClick={() => aiFileRef.current?.click()}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
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
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Tạo phiếu NK
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={`p-3 rounded-xl text-sm font-medium ${saveMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {saveMsg.text}
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm số phiếu, NCC..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-300" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Số phiếu</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Ngày</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">NCC</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Tổng tiền</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium">CT</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={6} className="py-8 text-center text-gray-400">Đang tải...</td></tr>
              : filtered.length === 0
                ? <tr><td colSpan={6} className="py-8 text-center text-gray-400">Chưa có phiếu nhập kho</td></tr>
                : filtered.map((p, i) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-green-700">{p.so_phieu}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.ngay}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[120px]">{p.doi_tac || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatVND(p.tong_tien)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openChiTiet(p)}
                          className="p-1.5 hover:bg-green-50 text-gray-400 hover:text-green-600 rounded-lg">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
            }
          </tbody>
          {!loading && filtered.length > 0 && (
            <tfoot className="bg-green-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-2 font-bold text-gray-700 text-sm">Tổng ({filtered.length} phiếu)</td>
                <td className="px-4 py-2 text-right font-bold text-green-700">
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
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedPhieu(null) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-bold text-green-700">{selectedPhieu.so_phieu}</h3>
                <p className="text-xs text-gray-500">{selectedPhieu.ngay}{selectedPhieu.doi_tac ? ` · ${selectedPhieu.doi_tac}` : ''}</p>
              </div>
              <button onClick={() => setSelectedPhieu(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-auto flex-1 p-5">
              {loadingCT
                ? <div className="text-center py-8 text-gray-400">Đang tải...</div>
                : <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2 text-gray-500">#</th>
                        <th className="text-left p-2 text-gray-500">Tên hàng</th>
                        <th className="text-right p-2 text-gray-500">SL</th>
                        <th className="text-left p-2 text-gray-500">ĐVT</th>
                        <th className="text-right p-2 text-gray-500">Đơn giá</th>
                        <th className="text-right p-2 text-gray-500">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chiTiet.map((it, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="p-2 text-gray-400">{i+1}</td>
                          <td className="p-2 text-gray-800">{it.ten_hang}</td>
                          <td className="p-2 text-right">{fmt(it.so_luong)}</td>
                          <td className="p-2 text-gray-500 text-xs">{it.dvt}</td>
                          <td className="p-2 text-right text-gray-600">{formatVND(it.don_gia)}</td>
                          <td className="p-2 text-right font-medium">{formatVND(it.thanh_tien)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-between text-sm">
              <span className="text-gray-500">{chiTiet.length} dòng</span>
              <span className="font-bold text-green-700">Tổng: {formatVND(selectedPhieu.tong_tien)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal tao phieu */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-4">
            <div className="flex items-center justify-between p-5 border-b bg-green-50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Tạo phiếu nhập kho mới</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {hangHoaList.length > 0 ? `${hangHoaList.length} mặt hàng trong danh mục` : '⚠ Danh mục chưa tải'}
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Form header */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Số phiếu *</label>
                  <input value={form.so_phieu} onChange={e => setForm({...form, so_phieu: e.target.value})}
                    placeholder="VD: NK-001"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Ngày *</label>
                  <input type="date" value={form.ngay} onChange={e => setForm({...form, ngay: e.target.value})}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">NCC / Đối tác</label>
                  <input value={form.doi_tac} onChange={e => setForm({...form, doi_tac: e.target.value})}
                    placeholder="Tên nhà cung cấp"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Ghi chú</label>
                  <input value={form.ghi_chu} onChange={e => setForm({...form, ghi_chu: e.target.value})}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
                </div>
              </div>

              {/* Items table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">#</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Tên hàng hóa</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium w-20">ĐVT</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium w-24">Số lượng</th>
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
                            className={`w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none ${it.selected ? 'bg-gray-50 text-gray-500 cursor-default' : 'focus:border-green-300'}`} />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" value={it.so_luong} onChange={e => updateItem(i, 'so_luong', e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-green-300" />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" value={it.don_gia} onChange={e => updateItem(i, 'don_gia', e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-green-300" />
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs font-medium text-gray-700">
                          {it.thanh_tien ? formatVND(parseFloat(it.thanh_tien)) : '—'}
                        </td>
                        <td className="px-2">
                          <button onClick={() => removeItem(i)} disabled={items.length === 1}
                            className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded disabled:opacity-30">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                  <button onClick={addItem} className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Thêm dòng
                  </button>
                  <span className="text-sm font-bold text-gray-700">Tổng: {formatVND(tongTien)}</span>
                </div>
              </div>

              {saveMsg && (
                <div className={`p-3 rounded-xl text-sm ${saveMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {saveMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Hủy
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
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
