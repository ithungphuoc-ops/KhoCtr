import React, { useState, useEffect } from 'react'
import { Box, Search, RefreshCw, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { getHangHoa, createHangHoa, updateHangHoa, deleteHangHoa } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'

export default function DanhMuc() {
  const { selectedCT, ctLoading, congTrinhs } = useCongTrinh()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterNhom, setFilterNhom] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({ ma_hang: '', ten_hang: '', dvt: '', nhom: '' })

  // Edit modal
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({ ten_hang: '', dvt: '', nhom: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editMsg, setEditMsg] = useState(null)

  const loadData = () => {
    if (ctLoading) return
    setLoading(true)
    const params = { limit: 2000 }
    if (selectedCT) params.cong_trinh_id = selectedCT.id
    getHangHoa(params)
      .then(res => setData(res.data?.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [selectedCT, ctLoading])

  const nhomList = [...new Set(data.map(r => r.nhom).filter(Boolean))].sort()
  const ctMap = Object.fromEntries((congTrinhs || []).map(ct => [ct.id, ct.ten_ct]))

  const filtered = data.filter(r => {
    const matchSearch = !search ||
      (r.ten_hang || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.ma_hang || '').toLowerCase().includes(search.toLowerCase())
    const matchNhom = !filterNhom || r.nhom === filterNhom
    return matchSearch && matchNhom
  })

  const openCreate = () => {
    setForm({ ma_hang: '', ten_hang: '', dvt: '', nhom: '' })
    setCreateError('')
    setShowCreate(true)
  }

  const handleCreate = async () => {
    if (!form.ten_hang.trim()) { setCreateError('Nhập tên hàng hóa'); return }
    if (!selectedCT) { setCreateError('Chưa chọn công trình'); return }
    setCreating(true); setCreateError('')
    try {
      await createHangHoa({
        ma_hang: form.ma_hang.trim() || undefined,
        ten_hang: form.ten_hang.trim(),
        dvt: form.dvt.trim() || 'cái',
        nhom: form.nhom.trim() || undefined,
        cong_trinh_id: selectedCT.id,
      })
      setShowCreate(false)
      loadData()
    } catch (e) {
      setCreateError(e.response?.data?.detail || 'Lỗi tạo hàng hóa. Thử lại.')
    } finally { setCreating(false) }
  }

  const openEdit = (r) => {
    setEditItem(r)
    setEditForm({ ten_hang: r.ten_hang || '', dvt: r.dvt || '', nhom: r.nhom || '' })
    setEditMsg(null)
  }

  const handleEditSave = async () => {
    if (!editForm.ten_hang.trim()) { setEditMsg({ err: true, text: 'Nhập tên hàng hóa' }); return }
    setEditSaving(true); setEditMsg(null)
    try {
      await updateHangHoa(editItem.ma_hang, editForm)
      setData(d => d.map(r => r.ma_hang === editItem.ma_hang ? { ...r, ...editForm } : r))
      setEditMsg({ err: false, text: 'Đã cập nhật!' })
      setTimeout(() => { setEditItem(null); setEditMsg(null) }, 800)
    } catch (e) {
      setEditMsg({ err: true, text: e.response?.data?.detail || 'Lỗi cập nhật' })
    } finally { setEditSaving(false) }
  }

  const handleDelete = async (ma, ten) => {
    if (!window.confirm(`Xóa "${ten}"?`)) return
    try {
      await deleteHangHoa(ma)
      setData(d => d.filter(r => r.ma_hang !== ma))
    } catch (e) {
      alert('Lỗi xóa: ' + (e.response?.data?.detail || e.message))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">VẬT TƯ - HÀNG HÓA</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">
            {loading ? 'Đang tải...' : `${data.length} mã hàng hóa trong hệ thống`}
          </p>
          {selectedCT
            ? <span className="inline-block mt-1 px-2 py-0.5 bg-hp-primary/15 text-hp-primary text-xs rounded-full">📌 {selectedCT.ten_ct}</span>
            : <span className="inline-block mt-1 px-2 py-0.5 bg-hp-accent/15 text-hp-accent text-xs rounded-full">🏢 Tất cả CT</span>
          }
        </div>
        <div className="flex gap-2">
          {selectedCT && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 min-h-10 bg-hp-primary hover:bg-hp-primary/90 text-white rounded-hp-md text-sm font-medium transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Tạo hàng hóa
            </button>
          )}
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 min-h-10 bg-hp-accent/15 hover:bg-hp-accent/25 text-hp-accent rounded-hp-md text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <Box className="w-8 h-8 text-hp-accent flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-text">{data.length}</div>
            <div className="text-sm text-hp-text-secondary">Tổng mã hàng</div>
          </div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <Box className="w-8 h-8 text-hp-warning flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-text">{nhomList.length}</div>
            <div className="text-sm text-hp-text-secondary">Nhóm hàng hóa</div>
          </div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <Box className="w-8 h-8 text-hp-primary flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-text">{filtered.length}</div>
            <div className="text-sm text-hp-text-secondary">Kết quả lọc</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên hàng, mã hàng..."
            className="w-full pl-9 pr-4 py-2 min-h-10 bg-hp-surface border border-hp-border rounded-hp-md text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
        <select value={filterNhom} onChange={e => setFilterNhom(e.target.value)}
          className="bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 min-h-10 text-sm text-hp-text-secondary focus:outline-none focus:ring-2 focus:ring-hp-accent">
          <option value="">Tất cả nhóm</option>
          {nhomList.map(nhom => (
            <option key={nhom} value={nhom}>{nhom}</option>
          ))}
        </select>
        <span className="text-xs text-hp-text-muted italic">Chọn CT ở sidebar để filter</span>
        <span className="text-xs text-hp-text-muted">{filtered.length} dòng</span>
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-hp-surface border-b border-hp-border">
              <tr>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">#</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Mã hàng</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Tên hàng hóa</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Nhóm</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">DVT</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Công trình</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} className="py-10 text-center text-hp-text-muted">Đang tải dữ liệu...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={7} className="py-10 text-center text-hp-text-muted">Không có hàng hóa</td></tr>
                  : filtered.map((r, i) => (
                      <tr key={r.ma_hang || i} className="border-b border-hp-divider hover:bg-hp-elevated transition-colors">
                        <td className="px-4 py-2.5 text-hp-text-muted text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-hp-accent font-medium">{r.ma_hang}</td>
                        <td className="px-4 py-2.5 text-hp-text">{r.ten_hang}</td>
                        <td className="px-4 py-2.5">
                          {r.nhom
                            ? <span className="bg-hp-accent/15 text-hp-accent text-xs px-2 py-0.5 rounded-full">{r.nhom}</span>
                            : <span className="text-hp-text-muted text-xs">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-hp-text-secondary text-xs">{r.dvt || '—'}</td>
                        <td className="px-4 py-2.5 text-hp-text-secondary text-xs">{ctMap[r.cong_trinh_id] || '—'}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(r)}
                              className="p-1.5 text-hp-text-muted hover:text-hp-accent hover:bg-hp-accent/15 rounded-hp-md transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(r.ma_hang, r.ten_hang)}
                              className="p-1.5 text-hp-text-muted hover:text-hp-danger hover:bg-hp-danger/15 rounded-hp-md transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tạo hàng hóa */}
      {showCreate && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-md w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-hp-border">
              <div>
                <h3 className="font-bold text-hp-text text-lg">Tạo Hàng Hóa Mới</h3>
                <p className="text-sm text-hp-primary font-medium">📌 {selectedCT?.ten_ct}</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-hp-card rounded-hp-md text-hp-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-hp-text-secondary mb-1">Tên hàng hóa *</label>
                <input value={form.ten_hang}
                  onChange={e => setForm(f => ({ ...f, ten_hang: e.target.value }))}
                  className="w-full px-3 py-2 min-h-10 bg-hp-surface border border-hp-border rounded-hp-md text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent"
                  placeholder="Ví dụ: Xi măng PCB40, Sắt phi 10..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-hp-text-secondary mb-1">Mã hàng</label>
                  <input value={form.ma_hang}
                    onChange={e => setForm(f => ({ ...f, ma_hang: e.target.value }))}
                    className="w-full px-3 py-2 min-h-10 bg-hp-surface border border-hp-border rounded-hp-md text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent"
                    placeholder="Tự động nếu bỏ trống" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-hp-text-secondary mb-1">DVT</label>
                  <input value={form.dvt}
                    onChange={e => setForm(f => ({ ...f, dvt: e.target.value }))}
                    className="w-full px-3 py-2 min-h-10 bg-hp-surface border border-hp-border rounded-hp-md text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent"
                    placeholder="cái, kg, m, m2..." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-hp-text-secondary mb-1">Nhóm hàng</label>
                <input value={form.nhom}
                  onChange={e => setForm(f => ({ ...f, nhom: e.target.value }))}
                  className="w-full px-3 py-2 min-h-10 bg-hp-surface border border-hp-border rounded-hp-md text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent"
                  placeholder="Ví dụ: Vật liệu xây dựng, Thiết bị điện..." />
              </div>
            </div>
            <div className="p-4 border-t border-hp-border bg-hp-surface flex items-center justify-between">
              <div>{createError && <p className="text-hp-danger text-xs">{createError}</p>}</div>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 min-h-10 border border-hp-border text-hp-text-secondary rounded-hp-md text-sm hover:bg-hp-card">
                  Hủy
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="px-5 py-2 min-h-10 bg-hp-primary hover:bg-hp-primary/90 text-white rounded-hp-md text-sm font-medium disabled:opacity-50">
                  {creating ? 'Đang lưu...' : 'Tạo hàng hóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal sửa hàng hóa */}
      {editItem && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditItem(null) }}>
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-md w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-hp-border">
              <div>
                <h3 className="font-semibold text-hp-text">Sửa hàng hóa</h3>
                <p className="text-xs text-hp-text-muted font-mono mt-0.5">{editItem.ma_hang}</p>
              </div>
              <button onClick={() => setEditItem(null)} className="p-1 hover:bg-hp-card rounded-hp-md">
                <X className="w-4 h-4 text-hp-text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-hp-text-secondary mb-1 block">Tên hàng hóa *</label>
                <input value={editForm.ten_hang}
                  onChange={e => setEditForm(f => ({ ...f, ten_hang: e.target.value }))}
                  className="w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 min-h-10 text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-hp-text-secondary mb-1 block">Đơn vị tính</label>
                  <input value={editForm.dvt}
                    onChange={e => setEditForm(f => ({ ...f, dvt: e.target.value }))}
                    placeholder="cái, kg, m..."
                    className="w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 min-h-10 text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary mb-1 block">Nhóm</label>
                  <input value={editForm.nhom}
                    onChange={e => setEditForm(f => ({ ...f, nhom: e.target.value }))}
                    className="w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 min-h-10 text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
              </div>
              {editMsg && (
                <div className={`text-sm px-3 py-2 rounded-hp-md ${editMsg.err ? 'bg-hp-danger/15 text-hp-danger' : 'bg-hp-primary/15 text-hp-primary'}`}>
                  {editMsg.err ? '✗' : '✓'} {editMsg.text}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditItem(null)}
                  className="flex-1 py-2 min-h-10 border border-hp-border text-hp-text-secondary rounded-hp-md text-sm hover:bg-hp-card">
                  Hủy
                </button>
                <button onClick={handleEditSave} disabled={editSaving}
                  className="flex-1 py-2 min-h-10 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {editSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
