// Sidebar v2.1 - non-admin chi thay QUAN LY DU LIEU
import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart2, Bell, StickyNote,
  Download, Upload, Package, Box, Building2,
  Users, Shield, ChevronLeft, ChevronRight,
  Database, CheckCircle, Cpu,
  ChevronDown, ChevronUp, Layers, FileUp, ClipboardList, History
} from 'lucide-react'
import { useCongTrinh } from '../../context/CongTrinhContext'
import { useAuth } from '../../context/AuthContext'

// ── Menu tĩnh ─────────────────────────────────────────────────
const groupTongQuan = {
  label: 'TỔNG QUAN',
  keep: true,
  items: [
    { icon: BarChart2,  label: 'Báo cáo tổng hợp', path: '/' },
    { icon: Bell,       label: 'Cảnh báo',          path: '/canh-bao', badge: true },
    { icon: StickyNote, label: 'Ghi chú công việc', path: '/ghi-chu' },
  ]
}

const groupQuanLy = {
  label: 'QUẢN LÝ DỮ LIỆU',
  items: [
    { icon: Upload,    label: 'Xuất kho',         path: '/phieu-xuat' },
    { icon: Download,  label: 'Nhập kho',          path: '/phieu-nhap' },
    { icon: Package,   label: 'Tồn kho',           path: '/ton-kho' },
    { icon: Box,       label: 'Danh mục hàng hóa', path: '/danh-muc' },
    { icon: BarChart2,     label: 'Báo cáo',        path: '/bao-cao' },
    { icon: History,       label: 'Lịch sử GD',    path: '/lich-su' },
    { icon: ClipboardList, label: 'Nhật ký HĐ',   path: '/nhat-ky', adminOnly: true },
  ]
}

const groupHeThong = {
  label: 'HỆ THỐNG',
  items: [
    { icon: Building2, label: 'Công trình',      path: '/cong-trinh' },
    { icon: Shield,    label: 'Phân quyền',      path: '/phan-quyen' },
    { icon: Users,     label: 'Người dùng',      path: '/nguoi-dung' },
    { icon: Cpu,       label: 'Thiết lập API AI', path: '/thiet-lap-api', adminOnly: true },
  ]
}

const CT_COLORS = [
  'bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-green-600', 'bg-indigo-500', 'bg-red-500',
]

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation()
  const { congTrinhs, selectedCT, setSelectedCT, isAdmin } = useCongTrinh()
  const { user } = useAuth()
  const isAdminUser = user?.role === 'admin' || isAdmin
  const [ctCollapsed, setCtCollapsed] = useState(false)

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const renderGroup = (group) => (
    <div key={group.label} className="mb-1">
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">{group.label}</span>
        </div>
      )}
      {collapsed && <div className="border-t border-gray-100 mx-2 my-2" />}
      {group.items.filter(item => !item.adminOnly || isAdminUser).map((item) => {
        const Icon = item.icon
        const active = isActive(item.path)
        return (
          <NavLink
            key={item.path}
            to={item.path}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 relative group
              ${active
                ? 'bg-blue-50 text-blue-600 font-semibold border-l-[3px] border-blue-500'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 border-l-[3px] border-transparent'
              }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-500' : 'text-gray-400'}`} />
            {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            {collapsed && item.badge && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                {item.label}
              </div>
            )}
          </NavLink>
        )
      })}
    </div>
  )

  return (
    <aside
      className="flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? 64 : 260, minWidth: collapsed ? 64 : 260 }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100" style={{ minHeight: 64 }}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/logo-hpcons.png" alt="HP Cons" className="h-9 w-auto object-contain flex-shrink-0" />
            <div>
              <div className="font-bold text-gray-800 text-sm leading-tight">
                {isAdminUser ? 'HPCons App Tổng' : `HPCons - ${selectedCT?.ten_ct || ''}`}
              </div>
              <div className="text-xs text-gray-400 leading-tight">Quản lý kho v2.0</div>
            </div>
          </div>
        )}
        {collapsed && (
          <img src="/logo-hpcons.png" alt="HP Cons" className="h-8 w-auto object-contain mx-auto" />
        )}
        <button
          onClick={onToggle}
          className={`p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors ${collapsed ? 'hidden' : ''}`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {collapsed && (
          <button onClick={onToggle} className="absolute top-5 -right-3 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 z-10">
            <ChevronRight className="w-3 h-3 text-gray-500" />
          </button>
        )}
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">

        {/* Admin: TONG QUAN */}
        {isAdminUser && renderGroup(groupTongQuan)}

        {/* Admin only: DANH SACH CONG TRINH */}
        {isAdminUser && (
          <div className="mb-1">
            {!collapsed && (
              <button
                onClick={() => setCtCollapsed(!ctCollapsed)}
                className="w-full flex items-center justify-between px-4 pt-3 pb-1 group"
              >
                <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Danh sách công trình</span>
                {ctCollapsed
                  ? <ChevronDown className="w-3 h-3 text-gray-400" />
                  : <ChevronUp className="w-3 h-3 text-gray-400" />
                }
              </button>
            )}
            {collapsed && <div className="border-t border-gray-100 mx-2 my-2" />}

            {!ctCollapsed && (
              <button
                onClick={() => setSelectedCT(null)}
                title={collapsed ? 'Tất cả công trình' : undefined}
                className={`w-full flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 relative group
                  ${selectedCT === null
                    ? 'bg-blue-50 text-blue-700 font-semibold border-l-[3px] border-blue-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 border-l-[3px] border-transparent'
                  }`}
                style={{ width: 'calc(100% - 16px)' }}
              >
                <div className="w-5 h-5 bg-gray-400 rounded flex items-center justify-center flex-shrink-0">
                  <Layers className="w-3 h-3 text-white" />
                </div>
                {!collapsed && <span className="flex-1 truncate text-left font-medium">Tất cả công trình</span>}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">
                    Tất cả công trình
                  </div>
                )}
              </button>
            )}

            {!ctCollapsed && congTrinhs.map((ct, i) => {
              const colorClass = CT_COLORS[i % CT_COLORS.length]
              const active = selectedCT?.id === ct.id
              return (
                <button
                  key={ct.id}
                  onClick={() => setSelectedCT(ct)}
                  title={collapsed ? ct.ten_ct : undefined}
                  className={`w-full flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 relative group
                    ${active
                      ? 'bg-teal-50 text-teal-700 font-semibold border-l-[3px] border-teal-500'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 border-l-[3px] border-transparent'
                    }`}
                  style={{ width: 'calc(100% - 16px)' }}
                >
                  <div className={`w-5 h-5 ${colorClass} rounded flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-[9px] font-bold">{i + 1}</span>
                  </div>
                  {!collapsed && <span className="flex-1 truncate text-left">{ct.ten_ct}</span>}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                      {ct.ten_ct}
                    </div>
                  )}
                </button>
              )
            })}

            {!ctCollapsed && congTrinhs.length === 0 && !collapsed && (
              <div className="mx-2 px-3 py-2 text-xs text-gray-400 italic">Chưa có công trình</div>
            )}
          </div>
        )}

        {/* Tat ca: QUAN LY DU LIEU */}
        {renderGroup(groupQuanLy)}

        {/* Admin: HE THONG */}
        {isAdminUser && renderGroup(groupHeThong)}

      </div>

      {/* Connection Status */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Kết nối hệ thống</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600">Database tổng</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                <span className="text-xs text-green-600 font-medium">Online</span>
              </div>
            </div>
            {isAdminUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-600">App con</span>
                </div>
                <span className="text-xs text-teal-600 font-medium">{congTrinhs.length} công trình</span>
              </div>
            ) : selectedCT ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-600">Công trình</span>
                </div>
                <span className="text-xs text-teal-600 font-medium truncate max-w-[110px]">{selectedCT.ten_ct}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-gray-400" />                <span className="text-xs text-gray-600">Đồng bộ</span>
              </div>
              <span className="text-xs text-green-600 font-medium">Thành công</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">© 2026 {isAdminUser ? 'HPCons App Tổng' : `HPCons - ${selectedCT?.ten_ct || ''}`}</p>
          <p className="text-xs text-gray-400 text-center">Phiên bản 2.0.0</p>
        </div>
      )}
    </aside>
  )
}
