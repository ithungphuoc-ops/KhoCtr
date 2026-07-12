import React from 'react'
import { Inbox } from 'lucide-react'

/**
 * HPCons Design System V1.1 — Empty State
 * Bắt buộc dùng khi màn hình chưa có dữ liệu — tuyệt đối không để khoảng trắng lớn.
 *
 * Props:
 *   icon      — Lucide icon component (mặc định Inbox)
 *   title     — tiêu đề chính
 *   desc      — mô tả phụ
 *   action    — { label, onClick } — nút CTA (optional)
 *   compact   — boolean: dạng nhỏ dùng trong table/card
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Chưa có dữ liệu',
  desc,
  action,
  compact = false,
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center
      ${compact ? 'py-8 px-4' : 'py-16 px-6'}`}>

      {/* Icon vòng tròn */}
      <div className={`rounded-full bg-hp-elevated flex items-center justify-center mb-4
        ${compact ? 'w-12 h-12' : 'w-16 h-16'}`}>
        <Icon className={`text-hp-text-disabled ${compact ? 'w-5 h-5' : 'w-7 h-7'}`} />
      </div>

      <p className={`font-semibold text-hp-text-secondary ${compact ? 'text-sm' : 'text-base'}`}>
        {title}
      </p>

      {desc && (
        <p className={`text-hp-text-muted mt-1 max-w-xs ${compact ? 'text-xs' : 'text-sm'}`}>
          {desc}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-hp-primary text-white text-sm font-medium rounded-hp-md
            hover:bg-hp-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
