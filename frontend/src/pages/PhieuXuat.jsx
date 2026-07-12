import React, { useState, useEffect, useRef } from 'react'
import { Upload, Search, RefreshCw, Eye, X, Plus, Trash2, Pencil, Bot, Loader, FileText, FileDown, AlertTriangle } from 'lucide-react'
import HangHoaInput from '../components/HangHoaInput'
import { getPhieuList, getChiTietPhieu, createPhieu, updatePhieu, deletePhieu, docPhieu, docPhieuMulti, getHangHoa, getTonKho } from '../api'
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

  // Create / Edit modal
  const [showCreate, setShowCreate] = useState(false)
  const [editingPhieu, setEditingPhieu] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({ so_phieu: '', ngay: todayStr(), doi_tac: '', ghi_chu: '' })
  const [items, setItems] = useState([emptyItem()])

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  // Batch mode (PDF nhiều phiếu)
  const [batchList, setBatchList] = useState([])
  const [batchIdx, setBatchIdx] = useState(-1)

  const fillFormFromPhieu = (data) => {
    setForm(f => ({
      ...f,
      so_phieu: data.so_phieu || '',
      ngay:     data.ngay || todayStr(),
      doi_tac:  data.doi_tac || data.nha_cung_cap || f.doi_tac,
      ghi_chu:  f.ghi_chu,
    }))
    const aiItems = (data.items || data.hang_hoa || [])
    if (aiItems.length > 0) {
      setItems(aiItems.map(it => ({
        ten_hang:   it.ten_hang || it.hang || '',
        dvt:        it.dvt || 'cái',
        so_luong:   it.so_luong || 0,
        don_gia:    it.don_gia || 0,
        thanh_tien: it.thanh_tien || (it.so_luong || 0) * (it.don_gia || 0),
        selected:   false,
      })))
    }
  }

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

  const openEdit = async (phieu) => {
    setLoadingEdit(true)
    try {
      const res = await getChiTietPhieu(phieu.id)
      const ct = res.data?.items || []
      setForm({ so_phieu: phieu.so_phieu, ngay: phieu.ngay, doi_tac: phieu.doi_tac || '', ghi_chu: phieu.ghi_chu || '' })
      setItems(ct.length > 0 ? ct.map(i => ({ ...i, selected: true })) : [emptyItem()])
      setEditingPhieu(phieu)
      setCreateError('')
      setCreateMode('manual')
      if (hangHoaList.length === 0) loadHangHoa()
      setShowCreate(true)
    } catch {
      alert('Không tải được chi tiết phiếu')
    } finally {
      setLoadingEdit(false)
    }
  }

  const handleUpdate = async () => {
    if (!form.so_phieu.trim()) { setCreateError('Nhập số phiếu'); return }
    const validItems = items.filter(it => it.ten_hang.trim())
    if (validItems.length === 0) { setCreateError('Thêm ít nhất 1 hàng hóa'); return }
    setCreating(true)
    setCreateError('')
    try {
      await updatePhieu(editingPhieu.id, {
        loai: 'XK',
        so_phieu: form.so_phieu.trim(),
        ngay: form.ngay,
        doi_tac: form.doi_tac.trim(),
        ghi_chu: form.ghi_chu.trim(),
        tong_tien: tongItems,
        cong_trinh_id: editingPhieu.cong_trinh_id,
        user_email: user?.email || '',
        items: validItems.map(it => ({
          ...it,
          so_luong: parseFloat(it.so_luong) || 0,
          don_gia:  parseFloat(it.don_gia)  || 0,
          thanh_tien: it.thanh_tien || 0,
        }))
      })
      setShowCreate(false)
      setEditingPhieu(null)
      loadData()
    } catch (e) {
      setCreateError(e.response?.data?.detail || 'Lỗi cập nhật phiếu. Thử lại.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await deletePhieu(confirmDelete.id, user?.email || '')
      setConfirmDelete(null)
      loadData()
    } catch {
      alert('Lỗi xóa phiếu. Thử lại.')
    } finally {
      setDeleting(false)
    }
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
      if (batchList.length > 0 && batchIdx < batchList.length - 1) {
        const nextIdx = batchIdx + 1
        setBatchIdx(nextIdx)
        fillFormFromPhieu(batchList[nextIdx])
        setCreateError('')
        loadData()
      } else {
        setBatchList([])
        setBatchIdx(-1)
        setShowCreate(false)
        loadData()
      }
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
    setBatchList([])
    setBatchIdx(-1)
    try {
      const fd = new FormData()
      fd.append('file', aiFile)
      fd.append('loai', 'XK')
      fd.append('provider', aiProvider)
      if (effectiveCTId) fd.append('cong_trinh_id', effectiveCTId)

      const isPdf = aiFile.name.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        const res = await docPhieuMulti(fd)
        const list = res.data?.phieu_list || []
        if (list.length === 0) { setAiError('AI không tìm thấy phiếu nào trong file.'); return }
        setBatchList(list)
        setBatchIdx(0)
        fillFormFromPhieu(list[0])
      } else {
        const res = await docPhieu(fd)
        fillFormFromPhieu(res.data?.phieu || res.data || {})
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
          <h1 className="text-2xl font-bold text-hp-text">PHIẾU XUẤT KHO</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">
            {isAdminUser ? 'Tất cả phiếu xuất kho từ các công trình' : `Công trình: ${selectedCT?.ten_ct || '...'}`}
          </p>
          {selectedCT
            ? <span className="inline-block mt-1 px-2 py-0.5 bg-hp-primary/15 text-hp-primary text-xs rounded-full">📌 {selectedCT.ten_ct}</span>
            : <span className="inline-block mt-1 px-2 py-0.5 bg-hp-accent/15 text-hp-accent text-xs rounded-full">🏢 Tất cả CT</span>
          }
        </div>
        <div className="flex gap-2">
          {selectedCT && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 min-h-10 bg-hp-warning hover:bg-hp-warning/90 text-white rounded-hp-md text-sm font-medium transition-colors shadow-sm">
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
            className="flex items-center gap-2 px-4 py-2 min-h-10 bg-hp-primary/15 hover:bg-hp-primary/25 text-hp-primary rounded-hp-md text-sm font-medium transition-colors disabled:opacity-50">
            <FileDown className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 min-h-10 bg-hp-warning/15 hover:bg-hp-warning/25 text-hp-warning rounded-hp-md text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <Upload className="w-8 h-8 text-hp-warning flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-text">{filtered.length}</div>
            <div className="text-sm text-hp-text-secondary">Số phiếu hiển thị</div>
          </div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <Upload className="w-8 h-8 text-hp-accent flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-text">{phieuList.length}</div>
            <div className="text-sm text-hp-text-secondary">Tổng phiếu XK</div>
          </div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <Upload className="w-8 h-8 text-hp-primary flex-shrink-0" />
          <div>
            <div className="text-xl font-bold text-hp-text">{formatVND(tongTien)}</div>
            <div className="text-sm text-hp-text-secondary">Tổng giá trị</div>
          </div>
        </div>
      </div>

      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm số phiếu, người nhận..."
            className="w-full pl-9 pr-4 py-2 min-h-10 bg-hp-surface text-hp-text border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
        {isAdminUser && <span className="text-xs text-hp-text-muted italic">Chọn CT ở sidebar để filter</span>}
        <span className="text-xs text-hp-text-muted">{filtered.length} phiếu</span>
      </div>

      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-hp-surface border-b border-hp-border">
              <tr>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">#</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Số phiếu</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Ngày</th>
                {isAdminUser && <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Công trình</th>}
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Người nhận / Ghi chú</th>
                <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tổng tiền</th>
                <th className="text-center px-4 py-3 text-hp-text-secondary font-medium">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={colSpan} className="py-10 text-center text-hp-text-muted">Đang tải dữ liệu...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={colSpan} className="py-10 text-center text-hp-text-muted">Không có phiếu xuất kho</td></tr>
                  : filtered.map((p, i) => (
                      <tr key={p.id} className="border-b border-hp-border hover:bg-hp-elevated transition-colors">
                        <td className="px-4 py-3 text-hp-text-muted text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-hp-warning">{p.so_phieu}</td>
                        <td className="px-4 py-3 text-hp-text-secondary text-xs">{p.ngay}</td>
                        {isAdminUser && (
                          <td className="px-4 py-3 text-hp-text text-xs truncate max-w-[160px]">{ctMap[p.cong_trinh_id] || '—'}</td>
                        )}
                        <td className="px-4 py-3 text-hp-text-secondary text-xs truncate max-w-[130px]">{p.doi_tac || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-hp-warning">{formatVND(p.tong_tien)}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button onClick={() => openChiTiet(p)} title="Xem chi tiết"
                            className="p-1.5 hover:bg-hp-accent/10 text-hp-text-muted hover:text-hp-accent rounded-hp-md transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(p)} disabled={loadingEdit} title="Sửa phiếu"
                            className="p-1.5 hover:bg-hp-warning/10 text-hp-text-muted hover:text-hp-warning rounded-hp-md transition-colors disabled:opacity-40">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmDelete(p)} title="Xóa phiếu"
                            className="p-1.5 hover:bg-hp-danger/10 text-hp-text-muted hover:text-hp-danger rounded-hp-md transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot className="bg-hp-warning/10 border-t-2 border-hp-border">
                <tr>
                  <td colSpan={colSpan - 2} className="px-4 py-3 font-bold text-hp-text text-sm">Tổng cộng ({filtered.length} phiếu)</td>
                  <td className="px-4 py-3 text-right font-bold text-hp-warning">{formatVND(tongTien)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal xem chi tiết */}
      {selectedPhieu && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedPhieu(null) }}>
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-md w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-hp-border">
              <div>
                <h3 className="font-bold text-hp-warning text-lg">{selectedPhieu.so_phieu}</h3>
                <p className="text-sm text-hp-text-secondary mt-0.5">
                  {selectedPhieu.ngay} &nbsp;·&nbsp; {ctMap[selectedPhieu.cong_trinh_id] || ''}
                  {selectedPhieu.doi_tac && <> &nbsp;·&nbsp; {selectedPhieu.doi_tac}</>}
                </p>
              </div>
              <button onClick={() => setSelectedPhieu(null)} className="p-1 hover:bg-hp-muted/20 rounded-hp-md text-hp-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-5">
              {loadingChiTiet
                ? <div className="text-center text-hp-text-muted py-8">Đang tải...</div>
                : chiTiet.length === 0
                  ? <div className="text-center text-hp-text-muted py-8">Không có chi tiết</div>
                  : <table className="w-full text-sm">
                      <thead className="bg-hp-surface sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-hp-text-secondary font-medium">#</th>
                          <th className="text-left p-2 text-hp-text-secondary font-medium">Tên hàng</th>
                          <th className="text-right p-2 text-hp-text-secondary font-medium">SL</th>
                          <th className="text-left p-2 text-hp-text-secondary font-medium">DVT</th>
                          <th className="text-right p-2 text-hp-text-secondary font-medium">Đơn giá</th>
                          <th className="text-right p-2 text-hp-text-secondary font-medium">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chiTiet.map((item, i) => (
                          <tr key={i} className="border-b border-hp-border">
                            <td className="p-2 text-hp-text-muted text-xs">{i + 1}</td>
                            <td className="p-2 text-hp-text">{item.ten_hang}</td>
                            <td className="p-2 text-right text-hp-text">{fmt(item.so_luong)}</td>
                            <td className="p-2 text-hp-text-secondary text-xs">{item.dvt}</td>
                            <td className="p-2 text-right text-hp-text-secondary">{formatVND(item.don_gia)}</td>
                            <td className="p-2 text-right font-medium text-hp-text">{formatVND(item.thanh_tien)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              }
            </div>
            <div className="p-4 border-t border-hp-border bg-hp-surface flex justify-between items-center text-sm">
              <span className="text-hp-text-secondary">{chiTiet.length} dòng hàng</span>
              <span className="font-bold text-hp-warning text-base">Tổng: {formatVND(selectedPhieu.tong_tien)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo phiếu XK */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-md w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-hp-border">
              <div>
                <h3 className="font-bold text-hp-text text-lg">{editingPhieu ? `Sửa Phiếu XK — ${editingPhieu.so_phieu}` : 'Tạo Phiếu Xuất Kho'}</h3>
                <p className="text-sm text-hp-primary font-medium">📌 {editingPhieu ? ctMap[editingPhieu.cong_trinh_id] || editingPhieu.so_phieu : selectedCT?.ten_ct}
                  <span className="ml-2 text-xs text-hp-text-muted font-normal">
                    {hangHoaList.length > 0 ? `${hangHoaList.length} mặt hàng đang có trong kho` : '⚠ Chưa có hàng trong kho'}
                  </span>
                </p>
              </div>
              <button onClick={() => { setShowCreate(false); setEditingPhieu(null) }} className="p-1 hover:bg-hp-muted/20 rounded-hp-md text-hp-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto flex-1 p-5 space-y-4">
              {/* Batch progress indicator */}
              {batchList.length > 1 && createMode === 'manual' && (
                <div className="flex items-center gap-2 p-2.5 bg-hp-warning/10 border border-hp-warning/30 rounded-hp-md text-xs">
                  <Bot className="w-3.5 h-3.5 text-hp-warning flex-shrink-0" />
                  <span className="text-hp-warning font-medium">AI đọc được {batchList.length} phiếu — đang xử lý phiếu {batchIdx + 1}/{batchList.length}</span>
                  <div className="flex-1 h-1.5 bg-hp-border rounded-full overflow-hidden ml-1">
                    <div className="h-full bg-hp-warning rounded-full transition-all" style={{ width: `${((batchIdx + 1) / batchList.length) * 100}%` }} />
                  </div>
                </div>
              )}

              {!editingPhieu && (
                <div className="flex gap-1 p-1 bg-hp-surface rounded-hp-md">
                  <button onClick={() => setCreateMode('manual')}
                    className={"flex-1 py-1.5 px-3 rounded-hp-sm text-xs font-medium transition-colors " + (createMode === 'manual' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                    Nhập tay
                  </button>
                  <button onClick={() => setCreateMode('ai')}
                    className={"flex-1 py-1.5 px-3 rounded-hp-sm text-xs font-medium flex items-center justify-center gap-1.5 transition-colors " + (createMode === 'ai' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                    <Bot className="w-3.5 h-3.5" /> Đọc bằng AI
                  </button>
                </div>
              )}

              {!editingPhieu && createMode === 'ai' && (
                <div className="space-y-3">
                  {/* Provider toggle */}
                  <div className="flex gap-1 p-1 bg-hp-surface rounded-hp-md">
                    <button onClick={() => setAiProvider('gemini')}
                      className={"flex-1 py-1.5 px-2 rounded-hp-sm text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (aiProvider === 'gemini' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                      🆓 Gemini
                    </button>
                    <button onClick={() => setAiProvider('openai')}
                      className={"flex-1 py-1.5 px-2 rounded-hp-sm text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (aiProvider === 'openai' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                      🤖 ChatGPT
                    </button>
                    <button onClick={() => setAiProvider('claude')}
                      className={"flex-1 py-1.5 px-2 rounded-hp-sm text-xs font-medium transition-colors flex items-center justify-center gap-1 " + (aiProvider === 'claude' ? 'bg-hp-elevated text-hp-text shadow-sm' : 'text-hp-text-secondary hover:text-hp-text')}>
                      <Bot className="w-3.5 h-3.5" /> Claude
                    </button>
                  </div>
                  <div
                    className={"border-2 border-dashed rounded-hp-lg p-6 text-center cursor-pointer transition-colors " + (aiDragging ? 'border-hp-warning bg-hp-warning/10' : 'border-hp-border hover:border-hp-warning hover:bg-hp-warning/10')}
                    onClick={() => aiRef.current && aiRef.current.click()}
                    onDragOver={e => { e.preventDefault(); setAiDragging(true) }}
                    onDragLeave={() => setAiDragging(false)}
                    onDrop={e => { e.preventDefault(); setAiDragging(false); var f = e.dataTransfer.files[0]; if (f) { setAiFile(f); setAiError(''); } }}
                  >
                    <Upload className="w-8 h-8 text-hp-text-muted mx-auto mb-2" />
                    <p className="text-hp-text-secondary text-sm font-medium">Click hoặc kéo file vào đây</p>
                    <p className="text-hp-text-muted text-xs mt-1">Hỗ trợ: JPG, PNG, PDF</p>
                    <input ref={aiRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf"
                      onChange={e => { var f = e.target.files[0]; if (f) { setAiFile(f); setAiError(''); } }} />
                  </div>
                  {aiFile && (
                    <div className="flex items-center gap-2 p-2.5 bg-hp-warning/15 rounded-hp-md">
                      <FileText className="w-4 h-4 text-hp-warning flex-shrink-0" />
                      <span className="text-xs text-hp-warning truncate flex-1">{aiFile.name}</span>
                      <span className="text-xs text-hp-text-muted">{(aiFile.size/1024).toFixed(0)} KB</span>
                      <button onClick={() => { setAiFile(null); if (aiRef.current) aiRef.current.value = ''; }} className="text-hp-text-muted hover:text-hp-warning">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {aiError && <p className="text-hp-danger text-xs bg-hp-danger/10 p-2 rounded-hp-md">{aiError}</p>}
                  <button onClick={handleAiRead} disabled={!aiFile || aiLoading}
                    className="w-full py-2.5 min-h-10 bg-hp-warning text-white rounded-hp-lg font-medium text-sm hover:bg-hp-warning/90 disabled:opacity-50 flex items-center justify-center gap-2">
                    {aiLoading ? <><Loader className="w-4 h-4 animate-spin" /> AI đang đọc...</> : <><Bot className="w-4 h-4" /> Đọc và điền form tự động</>}
                  </button>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs text-hp-text-muted">Powered by</span>
                    {aiProvider === 'gemini'
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-hp-primary/15 text-hp-primary text-xs font-medium rounded-full border border-hp-primary/30">🆓 Gemini 1.5 Flash</span>
                      : aiProvider === 'openai'
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-hp-primary/15 text-hp-primary text-xs font-medium rounded-full border border-hp-primary/30">🤖 ChatGPT gpt-4o-mini</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-hp-accent/15 text-hp-accent text-xs font-medium rounded-full border border-hp-accent/30"><Bot className="w-3 h-3" /> Claude Sonnet</span>
                    }
                  </div>
                </div>
              )}

              {(createMode === 'manual' || editingPhieu) && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-hp-text-secondary mb-1">Số phiếu *</label>
                      <input value={form.so_phieu} onChange={e => setForm(f => ({...f, so_phieu: e.target.value}))}
                        className="w-full px-3 py-2 min-h-10 bg-hp-surface text-hp-text border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent" placeholder="XK-20260702-001" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-hp-text-secondary mb-1">Ngày *</label>
                      <input type="date" value={form.ngay} onChange={e => setForm(f => ({...f, ngay: e.target.value}))}
                        className="w-full px-3 py-2 min-h-10 bg-hp-surface text-hp-text border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-hp-text-secondary mb-1">Người nhận</label>
                      <input value={form.doi_tac} onChange={e => setForm(f => ({...f, doi_tac: e.target.value}))}
                        className="w-full px-3 py-2 min-h-10 bg-hp-surface text-hp-text border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent" placeholder="Tên người nhận..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-hp-text-secondary mb-1">Ghi chú</label>
                      <input value={form.ghi_chu} onChange={e => setForm(f => ({...f, ghi_chu: e.target.value}))}
                        className="w-full px-3 py-2 min-h-10 bg-hp-surface text-hp-text border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent" placeholder="Ghi chú thêm..." />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-hp-text-secondary">Danh sách hàng hóa *</label>
                      <button onClick={() => setItems(prev => [...prev, emptyItem()])}
                        className="flex items-center gap-1 text-xs text-hp-warning hover:text-hp-warning/80 font-medium">
                        <Plus className="w-3 h-3" /> Thêm dòng
                      </button>
                    </div>
                    <div className="border border-hp-border rounded-hp-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-hp-surface">
                          <tr>
                            <th className="text-center px-3 py-2 text-hp-text-secondary font-medium w-8">#</th>
                            <th className="text-left px-3 py-2 text-hp-text-secondary font-medium">Tên hàng *</th>
                            <th className="text-center px-2 py-2 text-hp-text-secondary font-medium w-16">SL</th>
                            <th className="text-center px-2 py-2 text-hp-text-secondary font-medium w-16">DVT</th>
                            <th className="text-center px-2 py-2 text-hp-text-secondary font-medium w-24">Đơn giá</th>
                            <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-24">Thành tiền</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, i) => (
                            <tr key={i} className="border-t border-hp-border">
                              <td className="px-3 py-1.5 text-hp-text-muted text-center">{i + 1}</td>
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
                              <td className="px-1 py-1"><input type="number" value={it.so_luong} min="0" onChange={e => updateItem(i, 'so_luong', e.target.value)} className="w-full px-2 py-1.5 bg-hp-surface text-hp-text border border-hp-border rounded-hp-sm text-xs text-right focus:outline-none focus:ring-2 focus:ring-hp-accent" /></td>
                              <td className="px-1 py-1"><input value={it.dvt} onChange={e => updateItem(i, 'dvt', e.target.value)} readOnly={!!it.selected} className={`w-full px-2 py-1.5 border border-hp-border rounded-hp-sm text-xs focus:outline-none ${it.selected ? 'bg-hp-muted/10 text-hp-text-muted cursor-default' : 'bg-hp-surface text-hp-text focus:ring-2 focus:ring-hp-accent'}`} /></td>
                              <td className="px-1 py-1"><input type="number" value={it.don_gia} min="0" onChange={e => updateItem(i, 'don_gia', e.target.value)} className="w-full px-2 py-1.5 bg-hp-surface text-hp-text border border-hp-border rounded-hp-sm text-xs text-right focus:outline-none focus:ring-2 focus:ring-hp-accent" /></td>
                              <td className="px-3 py-1.5 text-right font-semibold text-hp-warning">{formatVND(it.thanh_tien)}</td>
                              <td className="px-1 py-1 text-center">
                                {items.length > 1 && (
                                  <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="p-1 text-hp-danger hover:bg-hp-danger/10 rounded-hp-sm"><Trash2 className="w-3 h-3" /></button>
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

            <div className="p-4 border-t border-hp-border bg-hp-surface flex items-center justify-between">
              <div>
                {createError && <p className="text-hp-danger text-xs mb-1">{createError}</p>}
                {createMode === 'manual' && <p className="text-base font-bold text-hp-warning">Tổng: {formatVND(tongItems)}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowCreate(false); setEditingPhieu(null) }} className="px-4 py-2 min-h-10 border border-hp-border text-hp-text-secondary rounded-hp-md text-sm hover:bg-hp-elevated">Hủy</button>
                {(createMode === 'manual' || editingPhieu) && (
                  <button onClick={editingPhieu ? handleUpdate : handleCreate} disabled={creating}
                    className="px-5 py-2 min-h-10 bg-hp-warning hover:bg-hp-warning/90 text-white rounded-hp-md text-sm font-medium disabled:opacity-50">
                    {creating ? 'Đang lưu...' : editingPhieu ? 'Cập nhật' : batchList.length > 1 ? `Lưu & Tiếp (${batchIdx + 1}/${batchList.length})` : 'Lưu Phiếu XK'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-md w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-hp-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-hp-text">Xóa phiếu xuất kho?</h3>
                <p className="text-sm text-hp-text-secondary mt-1">
                  Phiếu <b className="text-hp-danger">{confirmDelete.so_phieu}</b> ngày {confirmDelete.ngay} và toàn bộ chi tiết sẽ bị xóa vĩnh viễn.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="px-4 py-2 min-h-10 text-sm text-hp-text-secondary hover:bg-hp-muted/20 rounded-hp-md">Hủy</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 min-h-10 text-sm font-medium text-white bg-hp-danger hover:bg-hp-danger/90 rounded-hp-md disabled:opacity-50">
                {deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
