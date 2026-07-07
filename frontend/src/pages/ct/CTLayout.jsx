import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Download, Upload, Package,
  Cpu, ChevronLeft, ChevronRight, ArrowLeft, Warehouse, BookOpen, FileUp, StickyNote
} from 'lucide-react'
import { getCongTrinh } from '../../api'

const menuItems = [
  { icon: LayoutDashboard, label: 'Tổng quan',       path: '' },
  { icon: Download,        label: 'Nhập kho',        path: 'nhap-kho' },
  { icon: Upload,          label: 'Xuất kho',        path: 'xuat-kho' },
  { icon: Package,         label: 'Tồn kho',         path: 'ton-kho' },
  { icon: BookOpen,        label: 'Danh mục hàng',   path: 'danh-muc' },
  { icon: Cpu,             label: 'AI đọc PDF',      path: 'ai-reader' },
  { icon: FileUp,          label: 'Import dữ liệu',  path: 'import-data' },
  { icon: StickyNote,      label: 'Ghi chú',         path: 'ghi-chu' },
]

export default function CTLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [congTrinh, setCongTrinh] = useState(null)

  useEffect(() => {
    getCongTrinh().then(res => {
      const list = res.data?.data || []
      const ct = list.find(c => String(c.id) === String(id))
      setCongTrinh(ct || null)
    }).catch(() => {})
  }, [id])

  const base = `/ct/${id}`

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside
        className="flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden flex-shrink-0"
        style={{ width: collapsed ? 64 : 220, minWidth: collapsed ? 64 : 220 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-gray-100" style={{ minHeight: 64 }}>
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Warehouse className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-teal-700 leading-tight truncate">
                  {congTrinh?.ten_ct || 'Công trình'}
                </div>
                <div className="text-xs text-gray-400 leading-tight font-mono">{congTrinh?.ma_ct || ''}</div>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center mx-auto">
              <Warehouse className="w-4 h-4 text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1 rounded hover:bg-gray-100 text-gray-400 flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Menu */}
        <div className="flex-1 py-2 overflow-y-auto">
          {menuItems.map(item => {
            const Icon = item.icon
            const to = item.path ? `${base}/${item.path}` : base
            return (
              <NavLink
                key={item.label}
                to={to}
                end={item.path === ''}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative group
                  ${isActive
                    ? 'bg-teal-50 text-teal-700 font-medium border-l-[3px] border-teal-500'
                    : 'text-gray-600 hover:bg-gray-50 border-l-[3px] border-transparent'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">
                    {item.label}
                  </div>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Back to web tong */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => navigate('/')}
            title={collapsed ? 'Về Web Tổng' : undefined}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Về Web Tổng</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-teal-500" />
          <span className="text-sm font-semibold text-gray-700">
            {congTrinh?.ten_ct || 'Đang tải...'}
          </span>
          {congTrinh?.dia_chi && (
            <span className="text-xs text-gray-400">&nbsp;·&nbsp; {congTrinh.dia_chi}</span>
          )}
        </div>
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <Outlet context={{ congTrinh, ctId: id }} />
        </main>
      </div>
    </div>
  )
}
