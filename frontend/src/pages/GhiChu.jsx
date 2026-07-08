/**
 * GhiChu.jsx — Trang Ghi chú công việc (dùng chung Admin + User App CT)
 *
 * RBAC:
 *   Admin : mode 'all' (tất cả CT) hoặc 'by_ct' (nhóm theo CT)
 *           congTrinhId=null → backend trả tất cả
 *   User  : chỉ thấy selectedCT của mình
 *           congTrinhId=selectedCT.id, không có filter CT, không có mode by_ct
 */
import React, { useState, useEffect, useMemo } from 'react'
import { LayoutGrid, List, RefreshCw, StickyNote,
         ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { api } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'
import GhiChuModule from '../components/GhiChu/GhiChuModule'
import { TRANG_THAI_MAP } from '../components/GhiChu/ghiChuConfig'

/* ── Stats mini-card ──────────────────────────────────────── */
function StatCard({ label, value, color }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3`}>
      <div className={`w-2 h-8 rounded-full ${color}`} />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}

/* ── CT group card ────────────────────────────────────────── */
function CTGroup({ ct, items, onExpand, isOpen }) {
  const now     = new Date(); now.setHours(0,0,0,0)
  const overdue = items.filter(x => {
    if (!x.deadline || ['hoan_thanh','huy'].includes(x.trang_thai)) return false
    const d = new Date(x.deadline.split('T')[0]); d.setHours(0,0,0,0)
    return d < now
  }).length
  const done = items.filter(x => x.trang_thai === 'hoan_thanh').length

  const byStatus = {}
  Object.keys(TRANG_THAI_MAP).forEach(k => { byStatus[k] = 0 })
  items.forEach(x => { if (byStatus[x.trang_thai] !== undefined) byStatus[x.trang_thai]++ })

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        onClick={onExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isOpen
            ? <ChevronDown className="w-4 h-4 text-teal-500" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />
          }
          <div className="text-left">
            <p className="font-semibold text-gray-800">{ct.ten_ct}</p>
            <p className="text-xs text-gray-400 font-mono">{ct.ma_ct}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {overdue > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
              {overdue} quá hạn
            </span>
          )}
          {done > 0 && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              {done} xong
            </span>
          )}
          <span className="text-sm font-medium text-gray-500">{items.length} ghi chú</span>
        </div>
      </button>

      {/* Status breakdown bar */}
      {items.length > 0 && (
        <div className="px-5 pb-3 flex gap-1.5 flex-wrap">
          {Object.entries(byStatus).filter(([,v]) => v > 0).map(([k, v]) => (
            <span key={k} className={`text-xs px-2 py-0.5 rounded-full ${TRANG_THAI_MAP[k]?.badge}`}>
              {TRANG_THAI_MAP[k]?.label}: {v}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: GhiChuModule cho CT này */}
      {isOpen && (
        <div className="border-t border-gray-100 p-5">
          <GhiChuModule
            congTrinhId={ct.id}
            congTrinhList={[]}
            title=""
          />
        </div>
      )}
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────── */
export default function GhiChu() {
  const { congTrinhs, isAdmin, selectedCT, ctLoading } = useCongTrinh()

  const [mode,       setMode]       = useState('all')       // 'all' | 'by_ct'
  const [allItems,   setAllItems]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [openCTs,    setOpenCTs]    = useState({})           // { ct_id: bool }

  // Lấy tất cả ghi chú để thống kê (chỉ dùng cho mode by_ct)
  const loadAll = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/ghi-chu/?limit=500')
      setAllItems(res.data?.data || [])
    } catch { setAllItems([]) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (mode === 'by_ct') loadAll()
  }, [mode])

  // Stats tổng
  const globalStats = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0)
    return {
      total:      allItems.length,
      overdue:    allItems.filter(x => {
        if (!x.deadline || ['hoan_thanh','huy'].includes(x.trang_thai)) return false
        const d = new Date(x.deadline.split('T')[0]); d.setHours(0,0,0,0)
        return d < now
      }).length,
      hoan_thanh: allItems.filter(x => x.trang_thai === 'hoan_thanh').length,
      mo:         allItems.filter(x => x.trang_thai === 'mo').length,
    }
  }, [allItems])

  // Group items by CT
  const itemsByCT = useMemo(() => {
    const g = {}
    allItems.forEach(x => {
      if (!g[x.cong_trinh_id]) g[x.cong_trinh_id] = []
      g[x.cong_trinh_id].push(x)
    })
    return g
  }, [allItems])

  const congTrinhList = useMemo(() => {
    if (isAdmin) return congTrinhs || []
    return []
  }, [isAdmin, congTrinhs])

  const toggleCT = (id) => setOpenCTs(p => ({ ...p, [id]: !p[id] }))

  // ── Non-admin: chỉ thấy CT đang chọn ─────────────────────
  if (!isAdmin) {
    // Đợi context load xong trước khi render — tránh selectedCT=null thoáng qua
    if (ctLoading) {
      return (
        <div className="text-center py-16 text-gray-300">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="text-sm">Đang tải...</p>
        </div>
      )
    }
    if (!selectedCT) {
      return (
        <div className="text-center py-16">
          <StickyNote className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Vui lòng chọn công trình để xem ghi chú.</p>
        </div>
      )
    }
    // selectedCT có giá trị — gọi API với congTrinhId hợp lệ
    return (
      <GhiChuModule
        congTrinhId={selectedCT.id}
        congTrinhList={[]}
        title={`GHI CHÚ — ${selectedCT.ten_ct}`}
      />
    )
  }

  // ── Admin: mode all / by_ct ────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">GHI CHÚ CÔNG VIỆC</h1>
          <p className="text-gray-400 text-sm mt-0.5">Quản lý ghi chú toàn bộ công trình</p>
        </div>
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setMode('all')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors
              ${mode === 'all' ? 'bg-teal-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            <LayoutGrid className="w-4 h-4" /> Tất cả
          </button>
          <button onClick={() => setMode('by_ct')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors
              ${mode === 'by_ct' ? 'bg-teal-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            <List className="w-4 h-4" /> Theo CT
          </button>
        </div>
      </div>

      {/* ── MODE: Tất cả ─────────────────────────────────── */}
      {mode === 'all' && (
        <GhiChuModule
          congTrinhId={null}
          congTrinhList={congTrinhList}
          title=""
        />
      )}

      {/* ── MODE: Theo CT ────────────────────────────────── */}
      {mode === 'by_ct' && (
        <div className="space-y-4">
          {!loading && allItems.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Tổng ghi chú"  value={globalStats.total}      color="bg-teal-400" />
              <StatCard label="Đang mở"        value={globalStats.mo}         color="bg-blue-400" />
              <StatCard label="Hoàn thành"     value={globalStats.hoan_thanh} color="bg-green-400" />
              <StatCard label="Quá hạn"        value={globalStats.overdue}    color="bg-red-400" />
            </div>
          )}
          {loading ? (
            <div className="text-center py-16 text-gray-300">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p className="text-sm">Đang tải...</p>
            </div>
          ) : congTrinhs.length === 0 ? (
            <div className="text-center py-16">
              <StickyNote className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Không có công trình nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {congTrinhs.map(ct => (
                <CTGroup
                  key={ct.id}
                  ct={ct}
                  items={itemsByCT[ct.id] || []}
                  isOpen={!!openCTs[ct.id]}
                  onExpand={() => toggleCT(ct.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
