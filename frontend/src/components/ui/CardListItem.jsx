import React from 'react'

// HPCons Design System — Card List (Mobile fallback cho <table>, xem 10-data-display/cards.md + 07-responsive)
// Bo góc 12px (rounded-hp-lg), đệm 12-16px, viền 1px, không bóng đổ mạnh.
export function CardListItem({ children, className = '', onClick, highlight = false }) {
  return (
    <div
      onClick={onClick}
      className={`bg-hp-card rounded-hp-lg border ${highlight ? 'border-hp-danger/40 bg-hp-danger/5' : 'border-hp-border'} p-3 sm:p-4 space-y-2 ${
        onClick ? 'cursor-pointer active:bg-hp-elevated transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

// 1 dòng nhãn:giá trị bên trong thẻ — tương đương 1 cột trong bảng gốc
export function CardListRow({ label, value, valueClassName = '' }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm min-h-[28px]">
      <span className="text-hp-text-secondary flex-shrink-0">{label}</span>
      <span className={`text-hp-text font-medium text-right truncate ${valueClassName}`}>{value}</span>
    </div>
  )
}

// Danh sách thẻ + trạng thái loading/rỗng dùng chung — thay cho việc mỗi trang tự viết lại
export function CardList({ loading, empty, emptyMessage = 'Không có dữ liệu', children }) {
  if (loading) {
    return <div className="py-10 text-center text-hp-text-muted text-sm">Đang tải dữ liệu...</div>
  }
  if (empty) {
    return <div className="py-10 text-center text-hp-text-muted text-sm">{emptyMessage}</div>
  }
  return <div className="space-y-3">{children}</div>
}
