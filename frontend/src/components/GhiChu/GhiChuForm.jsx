/**
 * GhiChuForm.jsx — Form tạo / chỉnh sửa ghi chú
 * Props:
 *   congTrinhId  : number | null  (bắt buộc khi tạo mới)
 *   congTrinhList: [{id, ten_ct}]  (nếu admin trong App Tổng)
 *   initial      : object | null  (null = tạo mới, object = edit)
 *   onSave       : (payload) => Promise<void>
 *   onCancel     : () => void
 */
import React, { useState } from 'react'
import { X, Save } from 'lucide-react'
import {
  MAU_MAP, UU_TIEN_MAP, TRANG_THAI_MAP,
  MAU_OPTIONS, UU_TIEN_OPTIONS, TRANG_THAI_OPTIONS,
} from './ghiChuConfig'

export default function GhiChuForm({ congTrinhId, congTrinhList = [], initial, onSave, onCancel }) {
  const isEdit = !!initial

  const [form, setForm] = useState({
    cong_trinh_id: initial?.cong_trinh_id ?? congTrinhId ?? '',
    tieu_de:       initial?.tieu_de       ?? '',
    noi_dung:      initial?.noi_dung      ?? '',
    mau:           initial?.mau           ?? 'warning',
    uu_tien:       initial?.uu_tien       ?? 'binh_thuong',
    trang_thai:    initial?.trang_thai    ?? 'mo',
    deadline:      initial?.deadline      ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [err,    setErr   ] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.tieu_de.trim()) { setErr('Tiêu đề không được để trống.'); return }
    if (!form.cong_trinh_id)  { setErr('Phải chọn công trình.'); return }
    setSaving(true); setErr('')
    try {
      const payload = {
        cong_trinh_id: Number(form.cong_trinh_id),
        tieu_de:    form.tieu_de.trim(),
        noi_dung:   form.noi_dung,
        mau:        form.mau,
        uu_tien:    form.uu_tien,
        trang_thai: form.trang_thai,
        deadline:   form.deadline || null,
      }
      await onSave(payload)
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const mauStyle = MAU_MAP[form.mau]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            {isEdit ? 'Chỉnh sửa ghi chú' : 'Thêm ghi chú mới'}
          </h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Công trình (chỉ hiển thị nếu có list + không fix) */}
          {congTrinhList.length > 0 && !congTrinhId && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Công trình *</label>
              <select value={form.cong_trinh_id} onChange={e => set('cong_trinh_id', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400">
                <option value="">-- Chọn công trình --</option>
                {congTrinhList.map(ct => (
                  <option key={ct.id} value={ct.id}>{ct.ten_ct}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tiêu đề */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tiêu đề *</label>
            <input value={form.tieu_de} onChange={e => set('tieu_de', e.target.value)}
              placeholder="Nhập tiêu đề ghi chú..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </div>

          {/* Nội dung */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nội dung</label>
            <textarea value={form.noi_dung} onChange={e => set('noi_dung', e.target.value)}
              placeholder="Mô tả chi tiết..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 resize-none" />
          </div>

          {/* Màu + Ưu tiên + Trạng thái */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Màu</label>
              <select value={form.mau} onChange={e => set('mau', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-teal-400">
                {MAU_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ưu tiên</label>
              <select value={form.uu_tien} onChange={e => set('uu_tien', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-teal-400">
                {UU_TIEN_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Trạng thái</label>
              <select value={form.trang_thai} onChange={e => set('trang_thai', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-teal-400">
                {TRANG_THAI_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Deadline</label>
            <div className="flex items-center gap-2">
              <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
              {form.deadline && (
                <button type="button" onClick={() => set('deadline', '')}
                  className="text-gray-300 hover:text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Preview màu */}
          <div className={`rounded-xl border-2 p-3 ${mauStyle.bg} ${mauStyle.border}`}>
            <p className="text-xs text-gray-400 mb-1">Preview:</p>
            <p className="text-sm font-medium text-gray-800">{form.tieu_de || '(tiêu đề)'}</p>
            {form.noi_dung && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{form.noi_dung}</p>}
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Thêm ghi chú')}
          </button>
        </div>
      </div>
    </div>
  )
}
