/**
 * GhiChuDetail.jsx — Modal xem chi tiết 1 ghi chú
 * Props:
 *   item        : ghi chú object
 *   congTrinhName : string
 *   onClose     : () => void
 *   onEdit      : (item) => void
 *   onComplete  : (id)   => void
 *   onDelete    : (id)   => void
 */
import React, { useState } from 'react'
import { X, Pencil, CheckCircle2, Trash2, Clock, AlertTriangle, Calendar, User } from 'lucide-react'
import { MAU_MAP, UU_TIEN_MAP, TRANG_THAI_MAP } from './ghiChuConfig'

function fmtDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function deadlineStatus(dl) {
  if (!dl) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dl.split('T')[0]); d.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d - today) / 86400000)
  if (diff < 0)  return 'overdue'
  if (diff <= 3) return 'soon'
  return 'ok'
}

export default function GhiChuDetail({ item, congTrinhName, onClose, onEdit, onComplete, onDelete }) {
  const [delConfirm, setDelConfirm] = useState(false)

  const mau       = MAU_MAP[item.mau]       || MAU_MAP.warning
  const uuTien    = UU_TIEN_MAP[item.uu_tien] || UU_TIEN_MAP.binh_thuong
  const trangThai = TRANG_THAI_MAP[item.trang_thai] || TRANG_THAI_MAP.mo
  const dlStatus  = deadlineStatus(item.deadline)
  const isDone    = item.trang_thai === 'hoan_thanh'
  const isHuy     = item.trang_thai === 'huy'

  const dlBadge = dlStatus === 'overdue'
    ? 'bg-red-100 text-red-700'
    : dlStatus === 'soon'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-100 text-gray-500'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full max-w-lg border-t-4 ${mau.border.replace('border', 'border-t')}`}
           style={{ borderTopColor: undefined }}>

        {/* Color accent bar */}
        <div className={`h-1.5 rounded-t-2xl ${mau.dot}`} />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div className="flex-1 min-w-0 pr-4">
            {congTrinhName && (
              <p className="text-xs text-teal-600 font-medium mb-1">{congTrinhName}</p>
            )}
            <h2 className={`text-lg font-bold text-gray-800 leading-snug ${isDone ? 'line-through text-gray-400' : ''}`}>
              {item.tieu_de}
            </h2>
          </div>
          <button onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 px-6 pb-4">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${trangThai.badge}`}>
            {trangThai.label}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${uuTien.badge}`}>
            {uuTien.icon} {uuTien.label}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${mau.badge}`}>
            {mau.label}
          </span>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-4">
          {/* Nội dung */}
          {item.noi_dung ? (
            <div className={`p-4 rounded-xl text-sm text-gray-700 whitespace-pre-wrap leading-relaxed ${mau.bg}`}>
              {item.noi_dung}
            </div>
          ) : (
            <p className="text-sm text-gray-300 italic">Không có nội dung chi tiết.</p>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Deadline */}
            <div className="flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-400">Deadline</p>
                {item.deadline ? (
                  <span className={`font-medium px-1.5 py-0.5 rounded-full ${dlBadge}`}>
                    {dlStatus === 'overdue' && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                    {dlStatus === 'soon' && <Clock className="w-3 h-3 inline mr-0.5" />}
                    {fmtDate(item.deadline)}
                  </span>
                ) : (
                  <p className="text-gray-500">—</p>
                )}
              </div>
            </div>

            {/* Hoàn thành lúc */}
            {item.completed_at && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-400">Hoàn thành lúc</p>
                  <p className="font-medium text-green-600">{fmtDate(item.completed_at)}</p>
                </div>
              </div>
            )}

            {/* Tạo bởi */}
            {item.created_by && (
              <div className="flex items-start gap-2">
                <User className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-400">Tạo bởi</p>
                  <p className="font-medium text-gray-600 truncate">{item.created_by}</p>
                </div>
              </div>
            )}

            {/* Ngày tạo */}
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-400">Ngày tạo</p>
                <p className="font-medium text-gray-600">{fmtDate(item.created_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          {/* Delete */}
          <div>
            {!delConfirm
              ? <button onClick={() => setDelConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                </button>
              : <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Xác nhận xóa?</span>
                  <button onClick={() => { onDelete(item.id); onClose() }}
                    className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg font-medium">Xóa</button>
                  <button onClick={() => setDelConfirm(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Không</button>
                </div>
            }
          </div>

          <div className="flex items-center gap-2">
            {!isDone && !isHuy && (
              <button onClick={() => { onComplete(item.id); onClose() }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-600 hover:bg-green-50 rounded-lg border border-green-200 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành
              </button>
            )}
            <button onClick={() => { onEdit(item); onClose() }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium rounded-lg transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Chỉnh sửa
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
