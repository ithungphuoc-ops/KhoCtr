import React, { useState, useEffect, useRef } from 'react'
import { Upload, Search, RefreshCw, Eye, X, Plus, Trash2, Bot, Loader, FileText, FileDown } from 'lucide-react'
import HangHoaInput from '../components/HangHoaInput'
import { getPhieuList, getChiTietPhieu, createPhieu, docPhieu, getHangHoa, getTonKho } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'
import { useAuth } from '../context/AuthContext'
import { exportPhieuList } from '../utils/exportExcel'

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')
function formatVND(n) {
  const num = n ?? 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' tỷ'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + ' tr'
  return num.toLocaleString('vi-VN')
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const genSoPhieu = () => {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  return `XK-${ymd}-${String(Math.floor(Math.random()*900)+100)}`
}
const emptyItem = () => ({ ma_hang: '', ten_hang: '', dvt: 'cái', so_luong: 1, don_gia: 0, thanh_tien: 0, selected: false })
const normalize = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase()

export default function PhieuXuat() {
  const { selectedCT, ctLoading, congTrinhs, isAdmin, dateFrom, dateTo } = useCongTrinh()
  const { user } = useAuth()
  const isAdminUser = user?.role === 'admin' || isAdmin

  const [phieuList, setPhieuList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPhieu, setSelectedPhieu] = useState(null)
  const [chiTiet, setChiTiet] = useState([])
  const [loadingChiTiet, setLoadingChiTiet] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({ so_phieu: '', ngay: todayStr(), doi_tac: '', ghi_chu: '' })
  const [items, setItems] = useState([emptyItem()])

  // Danh mục hàng hóa cho autocomplete — load sẵn trước khi mở modal
  const [hangHoaList, setHangHoaList] = useState([])

  const loadHangHoa = () => {
    if (selectedCT) {
      getTonKho({ cong_trinh_id: selectedCT.id })
        .then(res => {
          const rows = (res.data?.data || [])
            .filter(tk => (tk.ton_cuoi ?? 0) > 0)
            .map(tk => ({ ten_hang: tk.ten_hang, dvt: tk.dvt || 'cái', ma_hang: '' }))
          setHangHoaList(rows)
        })
        .catch(() =>
          getHangHoa({ limit: 2000, cong_trinh_id: selectedCT.id })
            .then(res => setHangHoaList(res.data?.data || []))
            .catch(() => {})
        )
    } else {
      getHangHoa({ limit: 2000 })
        .then(res => setHangHoaList(res.data?.data || []))
        .catch(() => {})
    }
  }

  useEffect(() => {
    if (ctLoading) return
    loadHangHoa()
  }, [ctLoading, selectedCT])

  // AI mode
  const [createMode, setCreateMode] = useState('manual') // 'manual' | 'ai'
  const [aiFile, setAiFile] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiDragging, setAiDragging] = useState(false)
  const [aiProvider, setAiProvider] = useState('gemini') // 'gemini' | 'claude'
  const aiRef = useRef()

  // Non-admin: luôn dùng CT được gán; Admin: dùng selectedCT (null = tất cả)
  const effectiveCTId = isAdmin ? selectedCT?.id : congTrinhs[0]?.id

  const loadData = () => {
    if (ctLoading) return
    if (!isAdmin && !effectiveCTId) return
    setLoading(true)
    const params = { loai: 'XK', limit: 500 }
    if (effectiveCTId) params.cong_trinh_id = effectiveCTId
    if (dateFrom) params.date_from = dateFrom
    if (dateTo)   params.date_to   = dateTo
    getPhieuList(params)
      .then(res => setPhieuList(res.data?.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [selectedCT, ctLoading, dateFrom, dateTo])

  const openChiTiet = (phieu) => {
    setSelectedPhieu(phieu)
    setLoadingChiTiet(true)
    getChiTietPhieu(phieu.id)
      .then(res => setChiTiet(res.data?.items || []))
      .catch(() => setChiTiet([]))
      .finally(() => setLoadingChiTiet(false))
  }

  const ctMap = Object.fromEntries((congTrinhs || []).map(ct => [ct.id, ct.ten_ct]))

  const filtered = phieuList.filter(p =>
    !search ||
    (p.so_phieu || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.doi_tac || '').toLowerCase().includes(search.toLowerCase())
  )

  const tongTien = filtered.reduce((s, p) => s + (p.tong_tien || 0), 0)

  const openCreate = () => {
    setForm({ so_phieu: genSoPhieu(), ngay: todayStr(), doi_tac: '', ghi_chu: '' })
    setItems([emptyItem()])
    setCreateError('')
    setCreateMode('manual')
    setAiFile(null)
    setAiError('')
    if (hangHoaList.length === 0) loadHangHoa()
    setShowCreate(true)
  }

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: val }
      if (field === 'ten_hang') updated.selected = false  // mở khóa DVT khi gõ tay
      const sl = field === 'so_luong' ? parseFloat(val) || 0 : parseFloat(it.so_luong) || 0
      const dg = field === 'don_gia'  ? parseFloat(val) || 0 : parseFloat(it.don_gia)  || 0
      updated.thanh_tien = sl * dg
      return updated
    }))
  }

  const tongItems = items.reduce((s, it) => s + (it.thanh_tien || 0), 0)

  const handleCreate = async () => {
    if (!selectedCT)           { setCreateError('Chưa chọn công trình'); return }
    if (!form.so_phieu.trim()) { setCreateError('Nhập số phiếu'); return }
    const validItems = items.filter(it => it.ten_hang.trim())
    if (validItems.length === 0) { setCreateError('Thêm ít nhất 1 hàng hóa'); return }
    if (hangHoaList.length > 0) {
      const invalid = validItems.find(it =>
        !hangHoaList.some(h => normalize(h.ten_hang) === normalize(it.ten_hang))
      )
      if (invalid) {
        setCreateError(`"${invalid.ten_hang}" không có trong kho. Vui lòng chọn từ danh sách gợi ý.`)
        return
      }
    }
    setCreating(true)
    setCreateError('')
    try {
      await createPhieu({
        cong_trinh_id: selectedCT.id,
        loai: 'XK',
        so_phieu: form.so_phieu.trim(),
        ngay: form.ngay,
        doi_tac: form.doi_tac.trim(),
        ghi_chu: form.ghi_chu.trim(),
        tong_tien: tongItems,
        user_email: user?.email || '',
        items: validItems.map(it => ({
          ...it,
          so_luong: parseFloat(it.so_luong) || 0,
          don_gia:  parseFloat(it.don_gia)  || 0,
          thanh_tien: it.thanh_tien || 0,
        }))
      })
      setShowCreate(false)
      loadData()
    } catch (e) {
      setCreateError(e.response?.data?.detail || 'Lỗi tạo phiếu. Thử lại.')
    } finally {
      setCreating(false)
    }
  }

  const handleAiRead = async () => {
    if (!aiFile) return
    setAiLoading(true)
    setAiError('')
    try {
      const fd = new FormData()
      fd.append('file', aiFile)
      fd.append('provider', aiProvider)
      const res = await docPhieu(fd)
      const phieuData = res.data?.phieu || res.data || {}
      const aiItems = phieuData.items || phieuData.hang_hoa || []
      setForm(f => ({
        ...f,
        so_phieu: phieuData.so_phieu || genSoPhieu(),
        ngay: phieuData.ngay || todayStr(),
        doi_tac: phieuData.doi_tac || phieuData.ncc || f.doi_tac,
        ghi_chu: f.ghi_chu,
      }))
      if (aiItems.length > 0) {
        setItems(aiItems.map(it => ({
          ten_hang: it.ten_hang || it.ten || '',
          dvt: it.dvt || 'cái',
          so_luong: it.so_luong || 0,
          don_gia: it.don_gia || 0,
          thanh_tien: it.thanh_tien || (it.so_luong || 0) * (it.don_gia || 0),
        })))
      }
      setCreateMode('manual')
    } catch (e) {
      setAiError(e.response?.data?.detail || 'Lỗi đọc phiếu AI. Thử lại.')
    } finally {
      setAiLoading(false)
    }
  }

  const colSpan = isAdminUser ? 7 : 6

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">PHIẾU XUẤT KHO</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isAdminUser ? 'Tất cả phiếu xuất kho từ các công trình' : `Công trình: ${selectedCT?.ten_ct || '...'}`}
          </p>
          {selectedCT
            ? <span className="inline-block mt-1 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">📌 {selectedCT.ten_ct}</span>
            : <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">🏢 Tất cả CT</span>
          }
        </div>
        <div className="flex gap-2">
          {selectedCT && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Tạo phiếu XK
            </button>
          )}
          <button
            onClick={async () => {
              setExporting(true)
              try {
                await exportPhieuList({
                  phieuList: filtered,
                  loai: 'XK',
                  ctName: selectedCT?.ten_ct || '',
                  dateFrom,
                  dateTo,
                  congTrinhs,
                })
              } catch (e) { alert(e.message) }
              finally { setExporting(false) }
            }}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <FileDown className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <Upload className="w-8 h-8 text-orange-500 flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-gray-800">{filtered.length}</div>
            <div className="text-sm text-gray-500">Số phiếu hiển thị</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <Upload className="w-8 h-8 text-blue-400 flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-gray-800">{phieuList.length}</div>
            <div className="text-sm text-gray-500">Tổng phiếu XK</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <Upload className="w-8 h-8 text-teal-500 flex-shrink-0" />
          <div>
            <div className="text-xl font-bold text-gray-800">{formatVND(tongTien)}</div>
            <div className="text-sm text-gray-500">Tổng giá trị</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm số phiếu, người nhận..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300" />
        </div>
        {isAdminUser && <span className="text-xs text-gray-400 italic">Chọn CT ở sidebar để filter</span>}
        <span className="text-xs text-gray-400">{filtered.length} phiếu</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Số phiếu</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Ngày</th>
                {isAdminUser && <th className="text-left px-4 py-3 text-gray-500 font-medium">Công trình</th>}
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Người nhận / Ghi chú</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Tổng tiền</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={colSpan} className="py-10 text-center text-gray-400">Đang tải dữ liệu...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={colSpan} className="py-10 text-center text-gray-400">Không có phiếu xuất kho</td></tr>
                  : filtered.map((p, i) => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-orange-700">{p.so_phieu}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{p.ngay}</td>
                        {isAdminUser && (
                          <td className="px-4 py-3 text-gray-700 text-xs truncate max-w-[160px]">{ctMap[p.cong_trinh_id] || '—'}</td>
                        )}
                        <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[130px]">{p.doi_tac || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-700">{formatVND(p.tong_tien)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => openChiTiet(p)}
                            className="p-1.5 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot className="bg-orange-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={colSpan - 2} className="px-4 py-3 font-bold text-gray-700 text-sm">Tổng cộng ({filtered.length} phiếu)</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-700">{formatVND(tongTien)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal xem chi tiết */}
      {selectedPhieu && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedPhieu(null) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-bold text-orange-600 text-lg">{selectedPhieu.so_phieu}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedPhieu.ngay} &nbsp;·&nbsp; {ctMap[selectedPhieu.cong_trinh_id] || ''}
                  {selectedPhieu.doi_tac && <> &nbsp;·&nbsp; {selectedPhieu.doi_tac}</>}
                </p>
              </div>
              <button onClick={() => setSelectedPhieu(null)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-5">
              {loadingChiTiet
                ? <div className="text-center text-gray-400 py-8">Đang tải...</div>
                : chiTiet.length === 0
                  ? <div className="text-center text-gray-400 py-8">Không có chi tiết</div>
                  : <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-gray-500 font-medium">#</th>
                          <th className="text-left p-2 text-gray-500 font-medium">Tên hàng</th>
                          <th className="text-right p-2 text-gray-500 font-medium">SL</th>
                          <th className="text-left p-2 text-gray-500 font-medium">DVT</th>
                          <th className="text-right p-2 text-gray-500 font-medium">Đơn giá</th>
                          <th className="text-right p-2 text-gray-500 font-medium">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chiTiet.map((item, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="p-2 text-gray-400 text-xs">{i + 1}</td>
                            <td className="p-2 text-gray-800">{item.ten_hang}</td>
                            <td className="p-2 text-right text-gray-700">{fmt(item.so_luong)}</td>
                            <td className="p-2 text-gray-500 text-xs">{item.dvt}</td>
                            <td className="p-2 text-right text-gray-600">{formatVND(item.don_gia)}</td>
                            <td className="p-2 text-right font-medium text-gray-800">{formatVND(item.thanh_tien)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              }
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-between items-center text-sm">
              <span className="text-gray-500">{chiTiet.length} dòng hàng</span>
              <span className="font-bold text-orange-700 text-base">Tổng: {formatVND(selectedPhieu.tong_tien)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo phiếu XK */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Tạo Phiếu Xuất Kho</h3>
                <p className="text-sm text-teal-600 font-medium">📌 {selectedCT?.ten_ct}
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    {hangHoaList.length > 0 ? `${hangHoaList.length} mặt hàng đang có trong kho` : '⚠ Chưa có hàng trong kho'}
                  </span>
                </p>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto flex-1 p-5 space-y-4">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button onClick={() => setCreateMode('manual')}
                  className={"flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors " + (createMode === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  Nhập tay
                </button>
                <button onClick={() => setCreateMode('ai')}
                  className={"flex-1 py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors " + (createMode === 'ai' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  <Bot className="w-3.5 h-3.5" /> Đọc bằng AI
                </button>
              </div>

              {createMode === 'ai' && (
                <div className="space-y-3">
                  {/* Provider toggle */}
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                    <button onClick={() => setAiProvider('gemini')}
                      className={"flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (aiProvider === 'gemini' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                      🆓 Gemini
                    </button>
                    <button onClick={() => setAiProvider('openai')}
                      className={"flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (aiProvider === 'openai' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                      🤖 ChatGPT
                    </button>
                    <button onClick={() => setAiProvider('claude')}
                      className={"flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (aiProvider === 'claude' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                      <Bot className="w-3.5 h-3.5" /> Claude
                    </button>
                  </div>
                  <div
                    className={"border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors " + (aiDragging ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50')}
                    onClick={() => aiRef.current && aiRef.current.click()}
                    onDragOver={e => { e.preventDefault(); setAiDragging(true) }}
                    onDragLeave={() => setAiDragging(false)}
                    onDrop={e => { e.preventDefault(); setAiDragging(false); var f = e.dataTransfer.files[0]; if (f) { setAiFile(f); setAiError(''); } }}
                  >
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm font-medium">Click hoặc kéo file vào đây</p>
                    <p className="text-gray-400 text-xs mt-1">Hỗ trợ: JPG, PNG, PDF</p>
                    <input ref={aiRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf"
                      onChange={e => { var f = e.target.files[0]; if (f) { setAiFile(f); setAiError(''); } }} />
                  </div>
                  {aiFile && (
                    <div className="flex items-center gap-2 p-2.5 bg-orange-50 rounded-lg">
                      <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="text-xs text-orange-700 truncate flex-1">{aiFile.name}</span>
                      <span className="text-xs text-orange-400">{(aiFile.size/1024).toFixed(0)} KB</span>
                      <button onClick={() => { setAiFile(null); if (aiRef.current) aiRef.current.value = ''; }} className="text-orange-300 hover:text-orange-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {aiError && <p className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">{aiError}</p>}
                  <button onClick={handleAiRead} disabled={!aiFile || aiLoading}
                    className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-medium text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
                    {aiLoading ? <><Loader className="w-4 h-4 animate-spin" /> AI đang đọc...</> : <><Bot className="w-4 h-4" /> Đọc và điền form tự động</>}
                  </button>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs text-gray-400">Powered by</span>
                    {aiProvider === 'gemini'
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">🆓 Gemini 1.5 Flash</span>
                      : aiProvider === 'openai'
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100">🤖 ChatGPT gpt-4o-mini</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-600 text-xs font-medium rounded-full border border-purple-100"><Bot className="w-3 h-3" /> Claude Sonnet</span>
                    }
                  </div>
                </div>
              )}

              {createMode === 'manual' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Số phiếu *</label>
                      <input value={form.so_phieu} onChange={e => setForm(f => ({...f, so_phieu: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400" placeholder="XK-20260702-001" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ngày *</label>
                      <input type="date" value={form.ngay} onChange={e => setForm(f => ({...f, ngay: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Người nhận</label>
                      <input value={form.doi_tac} onChange={e => setForm(f => ({...f, doi_tac: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400" placeholder="Tên người nhận..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
                      <input value={form.ghi_chu} onChange={e => setForm(f => ({...f, ghi_chu: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400" placeholder="Ghi chú thêm..." />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">Danh sách hàng hóa *</label>
                      <button onClick={() => setItems(prev => [...prev, emptyItem()])}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium">
                        <Plus className="w-3 h-3" /> Thêm dòng
                      </button>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-center px-3 py-2 text-gray-500 font-medium w-8">#</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">Tên hàng *</th>
                            <th className="text-center px-2 py-2 text-gray-500 font-medium w-16">SL</th>
                            <th className="text-center px-2 py-2 text-gray-500 font-medium w-16">DVT</th>
                            <th className="text-center px-2 py-2 text-gray-500 font-medium w-24">Đơn giá</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium w-24">Thành tiền</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-3 py-1.5 text-gray-400 text-center">{i + 1}</td>
                              <td className="px-1 py-1">
                                <HangHoaInput
                                  value={it.ten_hang}
                                  onChange={(val) => updateItem(i, 'ten_hang', val)}
                                  onSelect={(hh) => setItems(prev => prev.map((r, j) => j !== i ? r : { ...r, ma_hang: hh.ma_hang || '', ten_hang: hh.ten_hang, dvt: hh.dvt || r.dvt, selected: true }))}
                                  hangHoaList={hangHoaList}
                                  isAdmin={isAdminUser}
                                  theme="orange"
                                  placeholder="Tên vật tư..."
                                />
                              </td>
                              <td className="px-1 py-1"><input type="number" value={it.so_luong} min="0" onChange={e => updateItem(i, 'so_luong', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:border-orange-300" /></td>
                              <td className="px-1 py-1"><input value={it.dvt} onChange={e => updateItem(i, 'dvt', e.target.value)} readOnly={!!it.selected} className={`w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none ${it.selected ? 'bg-gray-50 text-gray-500 cursor-default' : 'focus:border-orange-300'}`} /></td>
                              <td className="px-1 py-1"><input type="number" value={it.don_gia} min="0" onChange={e => updateItem(i, 'don_gia', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:border-orange-300" /></td>
                              <td className="px-3 py-1.5 text-right font-semibold text-orange-600">{formatVND(it.thanh_tien)}</td>
                              <td className="px-1 py-1 text-center">
                                {items.length > 1 && (
                                  <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
              <div>
                {createError && <p className="text-red-500 text-xs mb-1">{createError}</p>}
                {createMode === 'manual' && <p className="text-base font-bold text-orange-700">Tổng: {formatVND(tongItems)}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Hủy</button>
                {createMode === 'manual' && (
                  <button onClick={handleCreate} disabled={creating} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {creating ? 'Đang lưu...' : 'Lưu Phiếu XK'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
