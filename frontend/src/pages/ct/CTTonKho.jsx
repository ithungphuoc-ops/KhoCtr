import React, { useState, useEffect } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Package, Search, RefreshCw, AlertCircle, CheckCircle, Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { getTonKho, getHangHoa, themHangTonKho, dieuChinhTonKho, xoaHangTonKho } from '../../api'
import { useAuth } from '../../context/AuthContext'

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')
// CRUD ton kho: them hang (phieu TD), dieu chinh (phieu DC), xoa hang

export default function CTTonKho() {
  const { ctId } = useOutletContext() || {}
  const { id } = useParams()
  const realId = ctId || id
  const { user } = useAuth()

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterNhom, setFilterNhom] = useState('')
  const [showCanhBao, setShowCanhBao] = useState(false)

  // Modal state
  const [modal, setModal] = useState(null)   // { type: 'them' | 'sua' | 'xoa', row? }
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [form, setForm] = useState({})
  const [hangHoaList, setHangHoaList] = useState([])

  const loadData = () => {
    setLoading(true)
    getTonKho({ cong_trinh_id: realId })
      .then(res => setData(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [realId])

  useEffect(() => {
    getHangHoa({ limit: 2000 })
      .then(res => setHangHoaList(res.data?.data || []))
      .catch(() => {})
  }, [])

  const nhomList = [...new Set(data.map(r => r.nhom).filter(Boolean))].sort()

  const filtered = data.filter(r => {
    const matchSearch = !search || (r.ten_hang || '').toLowerCase().includes(search.toLowerCase())
    const matchNhom = !filterNhom || r.nhom === filterNhom
    const matchCB = !showCanhBao || (r.ton_cuoi ?? 0) <= 0
    return matchSearch && matchNhom && matchCB
  })

  const hetHang = data.filter(r => (r.ton_cuoi ?? 0) <= 0)
  const conHang = data.filter(r => (r.ton_cuoi ?? 0) > 0)

  // ── Modal handlers ─────────────────────────────────────────
  const openThem = () => {
    setForm({ ten_hang: '', dvt: 'cái', so_luong: '', don_gia: '', ghi_chu: '' })
    setModalError('')
    setModal({ type: 'them' })
  }
  const openSua = (row) => {
    setForm({ ton_moi: row.ton_cuoi ?? 0, ghi_chu: '' })
    setModalError('')
    setModal({ type: 'sua', row })
  }
  const openXoa = (row) => {
    setModalError('')
    setModal({ type: 'xoa', row })
  }
  const closeModal = () => { if (!saving) setModal(null) }

  const handleSave = async () => {
    setSaving(true)
    setModalError('')
    try {
      if (modal.type === 'them') {
        if (!form.ten_hang.trim()) throw new Error('Nhập tên hàng')
        const sl = parseFloat(form.so_luong)
        if (!sl || sl <= 0) throw new Error('Số lượng phải lớn hơn 0')
        await themHangTonKho({
          cong_trinh_id: Number(realId),
          ten_hang: form.ten_hang.trim(),
          dvt: form.dvt || 'cái',
          so_luong: sl,
          don_gia: parseFloat(form.don_gia) || 0,
          ghi_chu: form.ghi_chu || '',
          user_email: user?.email || '',
        })
      } else if (modal.type === 'sua') {
        const tonMoi = parseFloat(form.ton_moi)
        if (isNaN(tonMoi) || tonMoi < 0) throw new Error('Tồn mới không hợp lệ')
        await dieuChinhTonKho({
          cong_trinh_id: Number(realId),
          ten_hang: modal.row.ten_hang,
          dvt: modal.row.dvt || 'cái',
          ton_hien_tai: modal.row.ton_cuoi ?? 0,
          ton_moi: tonMoi,
          ghi_chu: form.ghi_chu || '',
          user_email: user?.email || '',
        })
      } else if (modal.type === 'xoa') {
        await xoaHangTonKho({
          ten_hang: modal.row.ten_hang,
          cong_trinh_id: Number(realId),
          user_email: user?.email || '',
        })
      }
      setModal(null)
      loadData()
    } catch (e) {
      setModalError(e.response?.data?.detail || e.message || 'Lỗi. Thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent focus:border-hp-accent min-h-10'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">TỒN KHO</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">Tồn kho của công trình này</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openThem}
            className="flex items-center gap-2 px-4 py-2 bg-hp-primary hover:bg-hp-primary/90 text-white rounded-hp-md text-sm font-medium min-h-10">
            <Plus className="w-4 h-4" />
            Thêm hàng
          </button>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-hp-primary/15 hover:bg-hp-primary/25 text-hp-primary rounded-hp-md text-sm font-medium disabled:opacity-50 min-h-10">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <Package className="w-8 h-8 text-hp-accent flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-text">{fmt(data.length)}</div>
            <div className="text-sm text-hp-text-secondary">Tổng mặt hàng</div>
          </div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-hp-primary flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-text">{fmt(conHang.length)}</div>
            <div className="text-sm text-hp-text-secondary">Còn hàng</div>
          </div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3 cursor-pointer hover:border-hp-danger transition-colors"
          onClick={() => setShowCanhBao(!showCanhBao)}>
          <AlertCircle className="w-8 h-8 text-hp-danger flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-danger">{fmt(hetHang.length)}</div>
            <div className="text-sm text-hp-text-secondary">Hết hàng</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên hàng hóa..."
            className="w-full pl-9 pr-4 py-2 bg-hp-surface border border-hp-border rounded-hp-md text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent focus:border-hp-accent min-h-10" />
        </div>
        <select value={filterNhom} onChange={e => setFilterNhom(e.target.value)}
          className="bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent min-h-10">
          <option value="">Tất cả nhóm</option>
          {nhomList.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-hp-text-secondary cursor-pointer select-none">
          <input type="checkbox" checked={showCanhBao} onChange={e => setShowCanhBao(e.target.checked)} className="w-4 h-4 rounded" />
          Chỉ hiện hết hàng
        </label>
        <span className="text-xs text-hp-text-muted">{filtered.length} dòng</span>
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-hp-lg border border-hp-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-hp-surface border-b border-hp-border">
              <tr>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">#</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Tên hàng hóa</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Nhóm</th>
                <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tổng nhập</th>
                <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tổng xuất</th>
                <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tồn cuối</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">ĐVT</th>
                <th className="text-center px-4 py-3 text-hp-text-secondary font-medium">TT</th>
                <th className="text-center px-4 py-3 text-hp-text-secondary font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hp-border">
              {loading
                ? <tr><td colSpan={9} className="py-10 text-center text-hp-text-muted">Đang tải...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={9} className="py-10 text-center text-hp-text-muted">Không có dữ liệu</td></tr>
                  : filtered.map((r, i) => {
                      const het = (r.ton_cuoi ?? 0) <= 0
                      return (
                        <tr key={i} className={`hover:bg-hp-elevated transition-colors ${het ? 'bg-hp-danger/5' : ''}`}>
                          <td className="px-4 py-2.5 text-hp-text-muted text-xs">{i+1}</td>
                          <td className="px-4 py-2.5 text-hp-text font-medium">{r.ten_hang}</td>
                          <td className="px-4 py-2.5 text-hp-text-secondary text-xs">{r.nhom || '—'}</td>
                          <td className="px-4 py-2.5 text-right text-hp-primary">{fmt(r.tong_nhap)}</td>
                          <td className="px-4 py-2.5 text-right text-hp-warning">{fmt(r.tong_xuat)}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${het ? 'text-hp-danger' : 'text-hp-accent'}`}>
                            {fmt(r.ton_cuoi)}
                          </td>
                          <td className="px-4 py-2.5 text-hp-text-secondary text-xs">{r.dvt || '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${het ? 'bg-hp-danger/20 text-hp-danger' : 'bg-hp-primary/20 text-hp-primary'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${het ? 'bg-hp-danger' : 'bg-hp-primary'}`} />
                              {het ? 'Hết' : 'Còn'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center whitespace-nowrap">
                            <button onClick={() => openSua(r)} title="Điều chỉnh tồn"
                              className="p-1.5 text-hp-accent hover:bg-hp-accent/10 rounded-hp-md transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => openXoa(r)} title="Xóa hàng khỏi tồn kho"
                              className="p-1.5 text-hp-danger hover:bg-hp-danger/10 rounded-hp-md transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-hp-elevated rounded-hp-xl shadow-md w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-hp-text text-lg">
                {modal.type === 'them' && 'Thêm hàng vào kho'}
                {modal.type === 'sua' && 'Điều chỉnh tồn kho'}
                {modal.type === 'xoa' && 'Xóa hàng khỏi tồn kho'}
              </h3>
              <button onClick={closeModal} className="p-1 text-hp-text-muted hover:text-hp-text"><X className="w-5 h-5" /></button>
            </div>

            {modal.type === 'them' && (
              <div className="space-y-3">
                <div className="text-xs text-hp-text-secondary">
                  Hệ thống sẽ tạo phiếu nhập "TD-..." để giữ dấu vết.
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary">Tên hàng *</label>
                  <input list="ct-dm-hang-hoa" value={form.ten_hang}
                    onChange={e => setForm(f => ({ ...f, ten_hang: e.target.value }))}
                    placeholder="Gõ vài chữ để chọn từ danh mục..." className={inputCls} autoFocus />
                  <datalist id="ct-dm-hang-hoa">
                    {hangHoaList.map((h, i) => <option key={i} value={h.ten_hang} />)}
                  </datalist>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-hp-text-secondary">ĐVT</label>
                    <input value={form.dvt} onChange={e => setForm(f => ({ ...f, dvt: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-hp-text-secondary">Số lượng *</label>
                    <input type="number" min="0" value={form.so_luong}
                      onChange={e => setForm(f => ({ ...f, so_luong: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-hp-text-secondary">Đơn giá</label>
                    <input type="number" min="0" value={form.don_gia}
                      onChange={e => setForm(f => ({ ...f, don_gia: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary">Ghi chú</label>
                  <input value={form.ghi_chu} onChange={e => setForm(f => ({ ...f, ghi_chu: e.target.value }))} className={inputCls} />
                </div>
              </div>
            )}

            {modal.type === 'sua' && (
              <div className="space-y-3">
                <div className="bg-hp-surface rounded-hp-lg p-3 text-sm">
                  <div className="font-medium text-hp-text">{modal.row.ten_hang}</div>
                  <div className="text-xs text-hp-text-secondary mt-0.5">
                    Tồn hiện tại: <b className="text-hp-accent">{fmt(modal.row.ton_cuoi)}</b> {modal.row.dvt || ''}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary">Tồn mới *</label>
                  <input type="number" min="0" value={form.ton_moi}
                    onChange={e => setForm(f => ({ ...f, ton_moi: e.target.value }))} className={inputCls} autoFocus />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary">Lý do điều chỉnh</label>
                  <input value={form.ghi_chu} placeholder="VD: kiểm kê thực tế, nhập sai số lượng..."
                    onChange={e => setForm(f => ({ ...f, ghi_chu: e.target.value }))} className={inputCls} />
                </div>
                <p className="text-xs text-hp-text-muted">
                  Hệ thống sẽ tự tạo phiếu điều chỉnh "DC-..." (nhập nếu tăng, xuất nếu giảm) — lịch sử được giữ nguyên.
                </p>
              </div>
            )}

            {modal.type === 'xoa' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-hp-danger/10 border border-hp-danger/20 rounded-hp-lg p-3">
                  <AlertTriangle className="w-5 h-5 text-hp-danger flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-hp-text">
                    Xóa <b>{modal.row.ten_hang}</b> sẽ xóa <b>toàn bộ dòng nhập/xuất</b> của hàng này trong công trình và không khôi phục được.
                    <div className="text-xs text-hp-text-secondary mt-1">
                      Chỉ dùng khi tạo nhầm tên hàng. Nếu chỉ muốn đưa tồn về 0, hãy dùng nút Điều chỉnh.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {modalError && <div className="mt-3 text-sm text-hp-danger bg-hp-danger/10 rounded-hp-md px-3 py-2">{modalError}</div>}

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeModal} disabled={saving}
                className="px-4 py-2 text-sm text-hp-text-secondary hover:bg-hp-surface rounded-hp-md transition-colors min-h-10">Hủy</button>
              <button onClick={handleSave} disabled={saving}
                className={`px-4 py-2 text-sm font-medium text-white rounded-hp-md transition-colors disabled:opacity-50 min-h-10 ${
                  modal.type === 'xoa' ? 'bg-hp-danger hover:bg-hp-danger/90' : 'bg-hp-primary hover:bg-hp-primary/90'
                }`}>
                {saving ? 'Đang lưu...' : modal.type === 'xoa' ? 'Xóa vĩnh viễn' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
