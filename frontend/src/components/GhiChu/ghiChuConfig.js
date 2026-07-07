/**
 * ghiChuConfig.js — Mapping màu semantic → Tailwind CSS
 * Giữ tất cả "màu thật" ở đây, component không hard-code màu.
 */

export const MAU_MAP = {
  warning: {
    bg:     'bg-amber-50',
    border: 'border-amber-300',
    badge:  'bg-amber-100 text-amber-700',
    dot:    'bg-amber-400',
    label:  'Vàng',
  },
  success: {
    bg:     'bg-green-50',
    border: 'border-green-300',
    badge:  'bg-green-100 text-green-700',
    dot:    'bg-green-500',
    label:  'Xanh lá',
  },
  danger: {
    bg:     'bg-red-50',
    border: 'border-red-300',
    badge:  'bg-red-100 text-red-700',
    dot:    'bg-red-500',
    label:  'Đỏ',
  },
  info: {
    bg:     'bg-blue-50',
    border: 'border-blue-300',
    badge:  'bg-blue-100 text-blue-700',
    dot:    'bg-blue-400',
    label:  'Xanh dương',
  },
  primary: {
    bg:     'bg-teal-50',
    border: 'border-teal-300',
    badge:  'bg-teal-100 text-teal-700',
    dot:    'bg-teal-500',
    label:  'Teal',
  },
}

export const UU_TIEN_MAP = {
  thap:       { label: 'Thấp',        badge: 'bg-gray-100 text-gray-500',   icon: '↓' },
  binh_thuong: { label: 'Bình thường', badge: 'bg-blue-100 text-blue-600',   icon: '→' },
  cao:         { label: 'Cao',         badge: 'bg-orange-100 text-orange-600', icon: '↑' },
  khan:        { label: 'Khẩn',        badge: 'bg-red-100 text-red-600',     icon: '‼' },
}

export const TRANG_THAI_MAP = {
  mo:          { label: 'Mở',          badge: 'bg-gray-100 text-gray-600',   col: 'Mở' },
  dang_lam:    { label: 'Đang làm',    badge: 'bg-blue-100 text-blue-700',   col: 'Đang làm' },
  tam_dung:    { label: 'Tạm dừng',    badge: 'bg-amber-100 text-amber-700', col: 'Tạm dừng' },
  hoan_thanh:  { label: 'Hoàn thành',  badge: 'bg-green-100 text-green-700', col: 'Hoàn thành' },
  huy:         { label: 'Huỷ',         badge: 'bg-red-100 text-red-500',     col: 'Huỷ' },
}

export const TRANG_THAI_ORDER = ['mo', 'dang_lam', 'tam_dung', 'hoan_thanh', 'huy']

export const MAU_OPTIONS     = Object.entries(MAU_MAP).map(([k, v]) => ({ value: k, ...v }))
export const UU_TIEN_OPTIONS = Object.entries(UU_TIEN_MAP).map(([k, v]) => ({ value: k, ...v }))
export const TRANG_THAI_OPTIONS = Object.entries(TRANG_THAI_MAP).map(([k, v]) => ({ value: k, ...v }))
