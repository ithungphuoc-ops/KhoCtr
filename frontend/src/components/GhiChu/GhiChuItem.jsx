/**
 * GhiChuItem.jsx — Card hiển thị 1 ghi chú (dùng trong cả List và Trello column)
 * Props:
 *   item       : ghi chú object
 *   showCT     : bool — hiển thị tên công trình (App Tổng)
 *   congTrinhMap: { id: ten_ct }
 *   onEdit     : (item) => void
 *   onDelete   : (id)   => void
 *   onComplete : (id)   => void
 */
import React, { useState } from 'react'
import { Pencil, Trash2, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { MAU_MAP, UU_TIEN_MAP, TRANG_THAI_MAP } from './ghiChuConfig'

function deadlineStatus(dl) {
  if (!dl) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dl); d.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d - today) / 86400000)
  if (diff < 0)  return 'overdue'
  if (diff <= 3) return 'soon'
  return 'ok'
}

function fmtDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

export default function GhiChuItem({ item, showCT = false, congTrinhMap = {}, onEdit, onDelete, onComplete }) {
  const [expanded, setExpanded] = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)

  const mau      = MAU_MAP[item.mau]     || MAU_MAP.warning
  const uuTien   = UU_TIEN_MAP[item.uu_tien] || UU_TIEN_MAP.binh_thuong
  const trangThai = TRANG_THAI_MAP[item.trang_thai] || TRANG_THAI_MAP.mo
  const dlStatus = deadlineStatus(item.deadline)
  const isDone   = item.trang_thai === 'hoan_thanh'
  const isHuy    = item.trang_thai === 'huy'

  const dlBadge = dlStatus === 'overdue'
    ? 'bg-red-100 text-red-700'
    : dlStatus === 'soon'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-100 text-gray-500'

  const borderExtra = dlStatus === 'overdue'
    ? 'border-red-400'
    : dlStatus === 'soon'
      ? 'border-amber-400'
      : mau.border

  return (
    <div className={`rounded-xl border-2 ${mau.bg} ${borderExtra} ${isDone || isHuy ? 'opacity-60' : ''} group transition-all`}>
      <div className="p-3">
        {/* Top row */}
        <div className="flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${mau.dot}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium text-gray-800 leading-snug ${isDone ? 'line-through text-gray-400' : ''}`}>
              {item.tieu_de}
            </p>
            {showCT && congTrinhMap[item.cong_trinh_id] && (
              <p className="text-xs text-teal-600 mt-0.5 truncate">{congTrinhMap[item.cong_trinh_id]}</p>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {!isDone && !isHuy && (
              <button onClick={() => onComplete(item.id)} title="Hoàn thành"
                className="p-1 rounded-lg hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => onEdit(item)} title="Chỉnh sửa"
              className="p-1 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {!delConfirm
              ? <button onClick={() => setDelConfirm(true)} title="Xóa"
                  className="p-1 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              : <div className="flex items-center gap-1">
                  <button onClick={() => onDelete(item.id)}
                    className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-lg font-medium">Xóa</button>
                  <button onClick={() => setDelConfirm(false)}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Không</button>
                </div>
            }
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center flex-wrap gap-1.5 mt-2">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${trangThai.badge}`}>
            {trangThai.label}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${uuTien.badge}`}>
            {uuTien.icon} {uuTien.label}
          </span>
          {item.deadline && (
            <span className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${dlBadge}`}>
              {dlStatus === 'overdue' ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {fmtDate(item.deadline)}
            </span>
          )}
        </div>

        {/* Expand nội dung */}
        {item.noi_dung && (
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Thu gọn' : 'Xem chi tiết'}
          </button>
        )}
        {expanded && item.noi_dung && (
          <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-2">
            {item.noi_dung}
          </p>
        )}
      </div>
    </div>
  )
}
