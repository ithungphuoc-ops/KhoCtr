import React, { useState, useEffect } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Plus, Search, RefreshCw, Trash2, Package, X, Pencil } from 'lucide-react'
import { getHangHoa, createHangHoa, deleteHangHoa, updateHangHoa } from '../../api'

export default function CTDanhMuc() {
  const { ctId } = useOutletContext() || {}
  const { id } = useParams()
  const realId = ctId || id

  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState(null)
  const [form, setForm]       = useState({ ten_hang: '', dvt: 'cái', nhom: 'Vật tư', mo_ta: '' })

  // Edit state
  const [editItem, setEditItem]   = useState(null) // item đang edit
  const [editForm, setEditForm]   = useState({ ten_hang: '', dvt: '', nhom: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editMsg, setEditMsg]     = useState(null)

  const loadData = () => {
    if (!realId) return
    setLoading(true)
    getHangHoa({ cong_trinh_id: realId, limit: 2000 })
      .then(res => setList(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [realId])

  const filtered = list.filter(h =>
    !search ||
    (h.ten_hang || '').toLowerCase().includes(search.toLowerCase()) ||
    (h.ma_hang  || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!form.ten_hang.trim()) { setMsg({ err: true, text: 'Nhập tên hàng hóa' }); return }
    setSaving(true); setMsg(null)
    try {
      await createHangHoa({ ...form, cong_trinh_id: Number(realId) })
      setMsg({ err: false, text: 'Đã thêm: ' + form.ten_hang })
      setForm({ ten_hang: '', dvt: 'cái', nhom: 'Vật tư', mo_ta: '' })
      loadData()
    } catch (e) {
      setMsg({ err: true, text: e.response?.data?.detail || 'Lỗi thêm hàng hóa' })
    } finally { setSaving(false) }
  }

  const handleDelete = async (ma) => {
    if (!window.confirm('Xóa hàng hóa này?')) return
    try {
      await deleteHangHoa(ma)
      setList(l => l.filter(h => h.ma_hang !== ma))
    } catch (e) {
      alert('Lỗi xóa: ' + (e.response?.data?.detail || e.message))
    }
  }

  const openEdit = (h) => {
    setEditItem(h)
    setEditForm({ ten_hang: h.ten_hang || '', dvt: h.dvt || '', nhom: h.nhom || 'Vật tư' })
    setEditMsg(null)
  }

  const handleEditSave = async () => {
    if (!editForm.ten_hang.trim()) { setEditMsg({ err: true, text: 'Nhập tên hàng hóa' }); return }
    setEditSaving(true); setEditMsg(null)
    try {
      await updateHangHoa(editItem.ma_hang, editForm)
      setList(l => l.map(h => h.ma_hang === editItem.ma_hang ? { ...h, ...editForm } : h))
      setEditMsg({ err: false, text: 'Đã cập nhật!' })
      setTimeout(() => { setEditItem(null); setEditMsg(null) }, 800)
    } catch (e) {
      setEditMsg({ err: true, text: e.response?.data?.detail || 'Lỗi cập nhật' })
    } finally { setEditSaving(false) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-hp-text">DANH MỤC HÀNG HÓA</h1>
          <p className="text-sm text-hp-text-secondary mt-0.5">{list.length} mặt hàng đang quản lý</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="p-2 rounded-hp-md hover:bg-hp-elevated text-hp-text-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setShowForm(v => !v); setMsg(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 transition-colors min-h-10"
          >
            <Plus className="w-4 h-4" />
            Thêm hàng hóa
          </button>
        </div>
      </div>

      {/* Form thêm mới */}
      {showForm && (
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-hp-text">Thêm hàng hóa mới</h3>
            <button onClick={() => setShowForm(false)} className="text-hp-text-muted hover:text-hp-text">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-hp-text-secondary mb-1 block">Tên hàng hóa *</label>
              <input
                value={form.ten_hang}
                onChange={e => setForm(f => ({...f, ten_hang: e.target.value}))}
                placeholder="Ví dụ: Xi măng PC40, Sắt phi 6mm..."
                className="w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent focus:border-hp-accent min-h-10"
              />
            </div>
            <div>
              <label className="text-xs text-hp-text-secondary mb-1 block">Đơn vị tính</label>
              <input
                value={form.dvt}
                onChange={e => setForm(f => ({...f, dvt: e.target.value}))}
                placeholder="cái, kg, m, m2..."
                className="w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent focus:border-hp-accent min-h-10"
              />
            </div>
            <div>
              <label className="text-xs text-hp-text-secondary mb-1 block">Nhóm</label>
              <select
                value={form.nhom}
                onChange={e => setForm(f => ({...f, nhom: e.target.value}))}
                className="w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent min-h-10"
              >
                <option>Vật tư</option>
                <option>Thiết bị</option>
                <option>MM-CCDC</option>
                <option>VPP</option>
                <option>Khác</option>
              </select>
            </div>
          </div>

          {msg && (
            <div className={`mt-3 text-sm px-3 py-2 rounded-hp-md ${msg.err ? 'bg-hp-danger/10 text-hp-danger' : 'bg-hp-primary/15 text-hp-primary'}`}>
              {msg.err ? '✗' : '✓'} {msg.text}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-2 border border-hp-border text-hp-text-secondary rounded-hp-md text-sm hover:bg-hp-elevated min-h-10">
              Hủy
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-2 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 min-h-10">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Thêm vào danh mục
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm hàng hóa..."
          className="w-full pl-9 pr-4 py-2 bg-hp-surface border border-hp-border rounded-hp-lg text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent focus:border-hp-accent min-h-10"
        />
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-hp-lg border border-hp-border overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-hp-text-muted text-sm">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-10 h-10 text-hp-border mx-auto mb-2" />
            <p className="text-hp-text-muted text-sm">{search ? 'Không tìm thấy kết quả' : 'Chưa có hàng hóa nào'}</p>
            {!search && (
              <button onClick={() => setShowForm(true)}
                className="mt-3 text-hp-accent text-sm hover:underline">
                + Thêm hàng hóa đầu tiên
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-hp-surface border-b border-hp-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-hp-text-muted font-medium w-8">#</th>
                <th className="text-left px-4 py-3 text-xs text-hp-text-muted font-medium">Mã hàng</th>
                <th className="text-left px-4 py-3 text-xs text-hp-text-muted font-medium">Tên hàng hóa</th>
                <th className="text-left px-4 py-3 text-xs text-hp-text-muted font-medium">DVT</th>
                <th className="text-left px-4 py-3 text-xs text-hp-text-muted font-medium">Nhóm</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hp-border">
              {filtered.map((h, i) => (
                <tr key={h.ma_hang || i} className="hover:bg-hp-elevated transition-colors">
                  <td className="px-4 py-3 text-hp-text-muted text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-hp-elevated text-hp-text-secondary px-2 py-0.5 rounded-hp-sm">{h.ma_hang}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-hp-text">{h.ten_hang}</td>
                  <td className="px-4 py-3 text-hp-text-secondary">{h.dvt}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-hp-accent/15 text-hp-accent px-2 py-0.5 rounded-full">{h.nhom || 'Vật tư'}</span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(h)}
                        className="p-1.5 text-hp-text-muted hover:text-hp-accent hover:bg-hp-accent/10 rounded-hp-md transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(h.ma_hang)}
                        className="p-1.5 text-hp-text-muted hover:text-hp-danger hover:bg-hp-danger/10 rounded-hp-md transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-hp-text-muted text-center">{filtered.length} hàng hóa</p>
      )}

      {/* Modal sửa */}
      {editItem && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditItem(null) }}>
          <div className="bg-hp-elevated rounded-hp-lg shadow-md w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-hp-border">
              <div>
                <h3 className="font-semibold text-hp-text">Sửa hàng hóa</h3>
                <p className="text-xs text-hp-text-muted font-mono mt-0.5">{editItem.ma_hang}</p>
              </div>
              <button onClick={() => setEditItem(null)} className="p-1 hover:bg-hp-surface rounded-hp-md">
                <X className="w-4 h-4 text-hp-text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-hp-text-secondary mb-1 block">Tên hàng hóa *</label>
                <input
                  value={editForm.ten_hang}
                  onChange={e => setEditForm(f => ({...f, ten_hang: e.target.value}))}
                  className="w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent focus:border-hp-accent min-h-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-hp-text-secondary mb-1 block">Đơn vị tính</label>
                  <input
                    value={editForm.dvt}
                    onChange={e => setEditForm(f => ({...f, dvt: e.target.value}))}
                    placeholder="cái, kg, m..."
                    className="w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent focus:border-hp-accent min-h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary mb-1 block">Nhóm</label>
                  <select
                    value={editForm.nhom}
                    onChange={e => setEditForm(f => ({...f, nhom: e.target.value}))}
                    className="w-full bg-hp-surface border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent min-h-10"
                  >
                    <option>Vật tư</option>
                    <option>Thiết bị</option>
                    <option>MM-CCDC</option>
                    <option>VPP</option>
                    <option>Khác</option>
                  </select>
                </div>
              </div>

              {editMsg && (
                <div className={`text-sm px-3 py-2 rounded-hp-md ${editMsg.err ? 'bg-hp-danger/10 text-hp-danger' : 'bg-hp-primary/15 text-hp-primary'}`}>
                  {editMsg.err ? '✗' : '✓'} {editMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditItem(null)}
                  className="flex-1 py-2 border border-hp-border text-hp-text-secondary rounded-hp-md text-sm hover:bg-hp-surface min-h-10">
                  Hủy
                </button>
                <button onClick={handleEditSave} disabled={editSaving}
                  className="flex-1 py-2 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 min-h-10">
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
