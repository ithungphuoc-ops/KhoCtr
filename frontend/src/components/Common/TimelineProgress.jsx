import React from 'react'
import { Calendar, Clock } from 'lucide-react'

/**
 * HPCons Design System V1.1 — Timeline Progress
 * Dùng cho màn hình có thời hạn: Mua hàng, Dự án, Hợp đồng, Công việc...
 *
 * Props:
 *   startDate   — ISO date string "YYYY-MM-DD"
 *   endDate     — ISO date string "YYYY-MM-DD"
 *   completed   — boolean: nếu true, thanh xanh lá + label "Hoàn thành"
 *   label       — tên hiển thị (optional)
 */
export default function TimelineProgress({ startDate, endDate, completed = false, label }) {
  const now    = new Date()
  const start  = new Date(startDate)
  const end    = new Date(endDate)

  const totalMs    = end - start
  const elapsedMs  = now - start
  const pct        = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 0
  const daysLeft   = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  const isOverdue  = daysLeft < 0

  const barColor = completed
    ? 'bg-hp-primary'
    : isOverdue
      ? 'bg-hp-danger'
      : pct >= 80
        ? 'bg-hp-warning'
        : 'bg-hp-accent'

  const statusText = completed
    ? 'Hoàn thành'
    : isOverdue
      ? `Quá hạn ${Math.abs(daysLeft)} ngày`
      : `Còn ${daysLeft} ngày`

  const statusColor = completed
    ? 'text-hp-primary'
    : isOverdue
      ? 'text-hp-danger'
      : pct >= 80
        ? 'text-hp-warning'
        : 'text-hp-text-muted'

  const fmt = (d) => {
    if (!d) return '?'
    const dt = new Date(d)
    return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`
  }

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-hp-text-secondary">{label}</span>
          <span className={`text-xs font-semibold ${statusColor}`}>{statusText}</span>
        </div>
      )}

      {/* Thanh tiến độ */}
      <div className="relative h-2 bg-hp-elevated rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${barColor} ${completed ? '' : 'opacity-90'}`}
          style={{ width: completed ? '100%' : `${pct}%` }}
        />
      </div>

      {/* Ngày bắt đầu — phần trăm — ngày kết thúc */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1 text-xs text-hp-text-disabled">
          <Calendar className="w-3 h-3" />
          <span>{fmt(startDate)}</span>
        </div>

        {!label && (
          <span className={`text-xs font-semibold ${statusColor}`}>{statusText}</span>
        )}

        <div className="flex items-center gap-1 text-xs text-hp-text-disabled">
          <Clock className="w-3 h-3" />
          <span>{fmt(endDate)}</span>
        </div>
      </div>
    </div>
  )
}
