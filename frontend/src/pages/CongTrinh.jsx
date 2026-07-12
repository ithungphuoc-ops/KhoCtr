import React, { useState, useEffect } from 'react'
import {
  Building2, Search, RefreshCw, MapPin, Hash, FileText,
  Plus, Trash2, X, CheckCircle, XCircle, CheckCircle2, RotateCcw, AlertTriangle
} from 'lucide-react'
import { api, updateCongTrinhStatus } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'

export default function CongTrinh() {
  const { loadCongTrinh } = useCongTrinh()
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [updating, setUpdating]   = useState(null)  // id dang update trang thai
  const [msg, setMsg]             = useState(null)
  const [deleteModal, setDeleteModal] = useState({ show: false, ct: null, loading: false, counts: null })
  const [form, setForm] = useState({ ten_ct: '', ma_ct: '', dia_chi: '', ghi_chu: '' })

  const loadData = () => {
    setLoading(true)
    // Dùng trailing slash để tránh SPA catch-all route
    api.get('/cong-trinh/')
      .then(res => setData(res.data?.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const filtered = data.filter(ct =>
    !search ||
    (ct.ten_ct || '').toLowerCase().includes(search.toLowerCase()) ||
    (ct.ma_ct || '').toLowerCase().includes(search.toLowerCase()) ||
    (ct.dia_chi || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.ten_ct || !form.ma_ct) {
      setMsg({ type: 'err', text: 'Vui lòng nhập Tên và Mã công trình' }); return
    }
    setSaving(true); setMsg(null)
    try {
      await api.post('/cong-trinh/', form)
      setMsg({ type: 'ok', text: `Tạo thành công: ${form.ten_ct}` })
      setForm({ ten_ct: '', ma_ct: '', dia_chi: '', ghi_chu: '' })
      setShowForm(false)
      loadData()
      loadCongTrinh()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Lỗi tạo công trình' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = async (ct) => {
    setDeleteModal({ show: true, ct, loading: true, counts: null })
    try {
      const res = await api.get(`/cong-trinh/${ct.id}/stats`)
      setDeleteModal(prev => ({ ...prev, loading: false, counts: res.data }))
    } catch {
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleDeleteConfirm = async () => {
    const { ct } = deleteModal
    if (!ct) return
    setDeleteModal(prev => ({ ...prev, loading: true }))
    try {
      await api.delete(`/cong-trinh/${ct.id}`)
      setMsg({ type: 'ok', text: `Đã xóa: ${ct.ten_ct}` })
      setDeleteModal({ show: false, ct: null, loading: false, counts: null })
      loadData(); loadCongTrinh()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Lỗi xóa công trình' })
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleToggleStatus = async (ct) => {
    const newStatus = (ct.trang_thai || 'hoat_dong') === 'hoat_dong' ? 'hoan_thanh' : 'hoat_dong'
    const label = newStatus === 'hoan_thanh' ? 'Hoàn thành' : 'Hoạt động lại'
    if (!window.confirm(`${label} công trình: ${ct.ten_ct}?`)) return
    setUpdating(ct.id)
    try {
      await updateCongTrinhStatus(ct.id, newStatus)
      setData(prev => prev.map(c => c.id === ct.id ? { ...c, trang_thai: newStatus } : c))
      setMsg({ type: 'ok', text: `Cập nhật trạng thái thành công: ${ct.ten_ct}` })
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Lỗi cập nhật trạng thái' })
    } finally {
      setUpdating(null)
    }
  }

  const getTrangThaiInfo = (trang_thai) => {
    if (!trang_thai || trang_thai === 'hoat_dong') {
      return { label: 'Hoạt động', className: 'bg-hp-primary/20 text-hp-primary' }
    }
    return { label: 'Hoàn thành', className: 'bg-hp-elevated text-hp-text-muted' }
  }

  const dang_hoat_dong = data.filter(c => !c.trang_thai || c.trang_thai === 'hoat_dong').length
  const hoan_thanh    = data.filter(c => c.trang_thai === 'hoan_thanh').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">DANH SÁCH CÔNG TRÌNH</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">
            {data.length} công trình — <span className="text-hp-primary">{dang_hoat_dong} hoạt động</span>
            {hoan_thanh > 0 && <span className="text-hp-text-muted"> · {hoan_thanh} hoàn thành</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} disabled={loading}
            className="p-2 border border-hp-border rounded-lg hover:bg-hp-elevated text-hp-text-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-hp-primary hover:bg-hp-primary/90 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Thêm công trình
          </button>
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${
          msg.type === 'ok'
            ? 'bg-hp-primary/10 border-hp-primary/30 text-hp-primary'
            : 'bg-hp-danger/10 border-hp-danger/30 text-hp-danger'
        }`}>
          {msg.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search */}
      <div className="bg-hp-card rounded-xl border border-hp-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, mã, địa chỉ..."
            className="w-full pl-9 pr-4 py-2 border border-hp-border rounded-lg text-sm bg-hp-elevated text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
      </div>

      {/* List */}
      {loading
        ? <div className="text-center text-hp-text-muted py-12">Đang tải...</div>
        : filtered.length === 0
          ? <div className="text-center text-hp-text-muted py-12">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-hp-border" />
              <div className="font-medium">
                {search ? 'Không tìm thấy kết quả' : 'Chưa có công trình nào'}
              </div>
              {!search && <div className="text-sm mt-1">Nhấn "Thêm công trình" để tạo mới</div>}
            </div>
          : <div className="grid grid-cols-1 gap-3">
              {filtered.map((ct, i) => {
                const ttInfo = getTrangThaiInfo(ct.trang_thai)
                const isHoanThanh = ct.trang_thai === 'hoan_thanh'
                const isUpdating = updating === ct.id
                return (
                  <div key={ct.id} className={`bg-hp-card rounded-xl border p-5 flex items-start gap-4 hover:shadow-sm transition-all ${
                    isHoanThanh ? 'border-hp-border opacity-70' : 'border-hp-border'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                      isHoanThanh ? 'bg-hp-elevated text-hp-text-muted' : 'bg-hp-primary/20 text-hp-primary'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className={`font-bold ${isHoanThanh ? 'text-hp-text-muted line-through' : 'text-hp-text'}`}>
                            {ct.ten_ct}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Hash className="w-3 h-3 text-hp-text-muted" />
                            <span className="text-xs font-mono text-hp-text-secondary">{ct.ma_ct}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Badge trạng thái */}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ttInfo.className}`}>
                            {ttInfo.label}
                          </span>

                          {/* Nút Hoàn thành / Hoạt động lại */}
                          <button
                            onClick={() => handleToggleStatus(ct)}
                            disabled={isUpdating}
                            title={isHoanThanh ? 'Hoạt động lại' : 'Đánh dấu Hoàn thành'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                              isHoanThanh
                                ? 'text-hp-text-muted hover:text-hp-primary hover:bg-hp-primary/10'
                                : 'text-hp-text-muted hover:text-hp-warning hover:bg-hp-warning/10'
                            }`}
                          >
                            {isUpdating
                              ? <RefreshCw className="w-4 h-4 animate-spin" />
                              : isHoanThanh
                                ? <RotateCcw className="w-4 h-4" />
                                : <CheckCircle2 className="w-4 h-4" />
                            }
                          </button>

                          {/* Nút xóa */}
                          <button
                            onClick={() => handleDeleteClick(ct)}
                            title="Xóa công trình"
                            className="p-1.5 text-hp-text-muted hover:text-hp-danger hover:bg-hp-danger/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {ct.dia_chi && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <MapPin className="w-3.5 h-3.5 text-hp-text-muted" />
                          <span className="text-sm text-hp-text-secondary">{ct.dia_chi}</span>
                        </div>
                      )}
                      {ct.ghi_chu && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <FileText className="w-3.5 h-3.5 text-hp-text-muted" />
                          <span className="text-xs text-hp-text-muted italic">{ct.ghi_chu}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
      }

      {/* Modal xác nhận xóa CT */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-hp-elevated rounded-xl shadow-md w-full max-w-md p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 bg-hp-danger/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-hp-danger" />
              </div>
              <div>
                <h3 className="font-bold text-hp-text text-lg">Xóa công trình</h3>
                <p className="text-sm text-hp-text-secondary mt-0.5 font-mono">{deleteModal.ct?.ma_ct} — {deleteModal.ct?.ten_ct}</p>
              </div>
            </div>

            <div className="bg-hp-danger/10 border border-hp-danger/30 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-hp-danger">
                Bạn có chắc chắn muốn xóa công trình này?
              </p>
              <p className="text-sm text-hp-danger mt-1">
                Toàn bộ dữ liệu sẽ bị xóa vĩnh viễn và không thể khôi phục.
              </p>
            </div>

            {deleteModal.loading && !deleteModal.counts && (
              <p className="text-sm text-hp-text-muted text-center py-3">Đang kiểm tra dữ liệu...</p>
            )}

            {deleteModal.counts && (
              <div className="bg-hp-surface rounded-xl p-4 mb-4 space-y-2">
                <p className="text-xs font-semibold text-hp-text-secondary uppercase tracking-wide mb-1">Dữ liệu sẽ bị xóa:</p>
                <div className="flex justify-between text-sm">
                  <span className="text-hp-text-secondary">Phiếu nhập / xuất</span>
                  <span className="font-bold text-hp-text">{deleteModal.counts.phieu_count} phiếu</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-hp-text-secondary">Chi tiết phiếu</span>
                  <span className="font-bold text-hp-text">{deleteModal.counts.chi_tiet_count} dòng</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-hp-text-secondary">Danh mục hàng hóa</span>
                  <span className="font-bold text-hp-text">{deleteModal.counts.hang_hoa_count} mặt hàng</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setDeleteModal({ show: false, ct: null, loading: false, counts: null })}
                disabled={deleteModal.loading && !!deleteModal.counts}
                className="flex-1 py-2.5 border border-hp-border text-hp-text-secondary rounded-xl text-sm hover:bg-hp-elevated disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteModal.loading}
                className="flex-1 py-2.5 bg-hp-danger text-white rounded-xl text-sm font-semibold hover:bg-hp-danger/90 disabled:opacity-50 transition-colors"
              >
                {deleteModal.loading && deleteModal.counts ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo CT */}
      {showForm && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-hp-elevated rounded-xl shadow-md w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-hp-text text-lg">Thêm công trình mới</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-hp-surface rounded-lg text-hp-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Tên công trình *</label>
                <input value={form.ten_ct} onChange={e => setForm({...form, ten_ct: e.target.value})}
                  placeholder="VD: Nhà xưởng Bình Dương"
                  className="w-full border border-hp-border rounded-xl px-3 py-2.5 text-sm bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Mã công trình *</label>
                <input value={form.ma_ct} onChange={e => setForm({...form, ma_ct: e.target.value.toUpperCase()})}
                  placeholder="VD: CT001"
                  className="w-full border border-hp-border rounded-xl px-3 py-2.5 text-sm font-mono bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Địa chỉ</label>
                <input value={form.dia_chi} onChange={e => setForm({...form, dia_chi: e.target.value})}
                  placeholder="Địa chỉ công trình..."
                  className="w-full border border-hp-border rounded-xl px-3 py-2.5 text-sm bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Ghi chú</label>
                <input value={form.ghi_chu} onChange={e => setForm({...form, ghi_chu: e.target.value})}
                  placeholder="Ghi chú thêm..."
                  className="w-full border border-hp-border rounded-xl px-3 py-2.5 text-sm bg-hp-surface text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-hp-border text-hp-text-secondary rounded-xl text-sm hover:bg-hp-elevated">
                  Hủy
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-hp-primary text-white rounded-xl text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50">
                  {saving ? 'Đang lưu...' : 'Tạo công trình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
