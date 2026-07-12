/**
 * ghiChuConfig.js — Mapping màu semantic → Tailwind CSS
 * Giữ tất cả "màu thật" ở đây, component không hard-code màu.
 */

export const MAU_MAP = {
  warning: {
    bg:     'bg-hp-warning/10',
    border: 'border-hp-warning/40',
    badge:  'bg-hp-warning/15 text-hp-warning',
    dot:    'bg-hp-warning',
    label:  'Vàng',
  },
  success: {
    bg:     'bg-hp-primary/10',
    border: 'border-hp-primary/40',
    badge:  'bg-hp-primary/15 text-hp-primary',
    dot:    'bg-hp-primary',
    label:  'Xanh lá',
  },
  danger: {
    bg:     'bg-hp-danger/10',
    border: 'border-hp-danger/40',
    badge:  'bg-hp-danger/15 text-hp-danger',
    dot:    'bg-hp-danger',
    label:  'Đỏ',
  },
  info: {
    bg:     'bg-hp-accent/10',
    border: 'border-hp-accent/40',
    badge:  'bg-hp-accent/15 text-hp-accent',
    dot:    'bg-hp-accent',
    label:  'Xanh dương',
  },
  primary: {
    bg:     'bg-hp-primary/10',
    border: 'border-hp-primary/40',
    badge:  'bg-hp-primary/15 text-hp-primary',
    dot:    'bg-hp-primary',
    label:  'Teal',
  },
}

export const UU_TIEN_MAP = {
  thap:       { label: 'Thấp',        badge: 'bg-hp-muted/20 text-hp-text-secondary', icon: '↓' },
  binh_thuong: { label: 'Bình thường', badge: 'bg-hp-accent/15 text-hp-accent',        icon: '→' },
  cao:         { label: 'Cao',         badge: 'bg-hp-warning/15 text-hp-warning',      icon: '↑' },
  khan:        { label: 'Khẩn',        badge: 'bg-hp-danger/15 text-hp-danger',        icon: '‼' },
}

export const TRANG_THAI_MAP = {
  mo:          { label: 'Mở',          badge: 'bg-hp-muted/20 text-hp-text-secondary', col: 'Mở' },
  dang_lam:    { label: 'Đang làm',    badge: 'bg-hp-accent/15 text-hp-accent',        col: 'Đang làm' },
  tam_dung:    { label: 'Tạm dừng',    badge: 'bg-hp-warning/15 text-hp-warning',      col: 'Tạm dừng' },
  hoan_thanh:  { label: 'Hoàn thành',  badge: 'bg-hp-primary/15 text-hp-primary',      col: 'Hoàn thành' },
  huy:         { label: 'Huỷ',         badge: 'bg-hp-muted/20 text-hp-text-secondary', col: 'Huỷ' },
}

export const TRANG_THAI_ORDER = ['mo', 'dang_lam', 'tam_dung', 'hoan_thanh', 'huy']

export const MAU_OPTIONS     = Object.entries(MAU_MAP).map(([k, v]) => ({ value: k, ...v }))
export const UU_TIEN_OPTIONS = Object.entries(UU_TIEN_MAP).map(([k, v]) => ({ value: k, ...v }))
export const TRANG_THAI_OPTIONS = Object.entries(TRANG_THAI_MAP).map(([k, v]) => ({ value: k, ...v }))
