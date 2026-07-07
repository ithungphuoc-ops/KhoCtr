/**
 * GhiChuModule.jsx — Core Module Ghi chú, dùng chung cho:
 *   - App Công trình (CTGhiChu.jsx): congTrinhId=id, showCT=false
 *   - App Tổng (GhiChu.jsx): congTrinhId=null, showCT=true, congTrinhList passed
 *
 * Props:
 *   congTrinhId  : number | null
 *   congTrinhList: [{id, ten_ct}]  (App Tổng)
 *   title        : string  (override tiêu đề)
 */
import React, { useState, useMemo } from 'react'
import { Plus, RefreshCw, Search, Filter, StickyNote } from 'lucide-react'
import { useGhiChu } from './useGhiChu'
import GhiChuItem    from './GhiChuItem'
import GhiChuForm    from './GhiChuForm'
import { TRANG_THAI_ORDER, TRANG_THAI_MAP, UU_TIEN_OPTIONS } from './ghiChuConfig'

export default function GhiChuModule({ congTrinhId = null, congTrinhList = [], title = 'GHI CHÚ CÔNG VIỆC' }) {
  const showCT = congTrinhList.length > 0
  const {
    items, loading, error,
    filters, setFilters,
    load,
    createItem, updateItem, deleteItem, completeItem,
  } = useGhiChu({ congTrinhId })

  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [viewMode, setViewMode] = useState('trello') // 'trello' | 'list'

  // Build map id → ten_ct cho App Tổng
  const congTrinhMap = useMemo(() => {
    const m = {}
    congTrinhList.forEach(ct => { m[ct.id] = ct.ten_ct })
    return m
  }, [congTrinhList])

  // Stats
  const overdueCount = items.filter(x => {
    if (!x.deadline || x.trang_thai === 'hoan_thanh' || x.trang_thai === 'huy') return false
    const d = new Date(x.deadline); d.setHours(0, 0, 0, 0)
    const t = new Date(); t.setHours(0, 0, 0, 0)
    return d < t
  }).length

  // Group theo trạng thái cho Trello view
  const grouped = useMemo(() => {
    const g = {}
    TRANG_THAI_ORDER.forEach(k => { g[k] = [] })
    items.forEach(x => { if (g[x.trang_thai]) g[x.trang_thai].push(x) })
    return g
  }, [items])

  // Handlers
  const handleSave = async (payload) => {
    if (editItem) {
      const { cong_trinh_id, ...rest } = payload  // không update cong_trinh_id qua PUT
      await updateItem(editItem.id, rest)
    } else {
      await createItem(payload)
    }
    setShowForm(false)
    setEditItem(null)
  }

  const handleEdit = (item) => { setEditItem(item); setShowForm(true) }
  const handleClose = () => { setShowForm(false); setEditItem(null) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-gray-400 text-sm">{items.length} ghi chú</p>
            {overdueCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
                {overdueCount} quá hạn!
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setViewMode('trello')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'trello' ? 'bg-teal-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              Kanban
            </button>
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-teal-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              Danh sách
            </button>
          </div>
          <button onClick={load}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { setEditItem(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Thêm ghi chú
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-300" />
              <input value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                placeholder="Tìm kiếm tiêu đề, nội dung..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-teal-400" />
            </div>
          </div>

          {/* Trạng thái */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Trạng thái</label>
            <select value={filters.trang_thai}
              onChange={e => setFilters(f => ({ ...f, trang_thai: e.target.value }))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 text-gray-600">
              <option value="">Tất cả</option>
              {TRANG_THAI_ORDER.map(k => (
                <option key={k} value={k}>{TRANG_THAI_MAP[k].label}</option>
              ))}
            </select>
          </div>

          {/* Ưu tiên */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ưu tiên</label>
            <select value={filters.uu_tien}
              onChange={e => setFilters(f => ({ ...f, uu_tien: e.target.value }))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 text-gray-600">
              <option value="">Tất cả</option>
              {UU_TIEN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Deadline từ–đến */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Deadline từ</label>
            <input type="date" value={filters.deadline_from}
              onChange={e => setFilters(f => ({ ...f, deadline_from: e.target.value }))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 text-gray-600" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">đến</label>
            <input type="date" value={filters.deadline_to}
              onChange={e => setFilters(f => ({ ...f, deadline_to: e.target.value }))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 text-gray-600" />
          </div>

          {/* Reset */}
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ trang_thai: '', uu_tien: '', search: '', deadline_from: '', deadline_to: '' })}
              className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors">
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-300">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="text-sm">Đang tải ghi chú...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <StickyNote className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Chưa có ghi chú nào</p>
          <button onClick={() => setShowForm(true)}
            className="mt-3 text-teal-500 hover:text-teal-700 text-sm font-medium">
            + Thêm ghi chú đầu tiên
          </button>
        </div>
      ) : viewMode === 'trello' ? (
        /* ── KANBAN VIEW ── */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TRANG_THAI_ORDER.map(status => {
            const col = TRANG_THAI_MAP[status]
            const colItems = grouped[status] || []
            return (
              <div key={status} className="flex-shrink-0 w-64">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${col.badge}`}>
                    {col.label}
                  </span>
                  <span className="text-xs text-gray-400">{colItems.length}</span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {colItems.map(item => (
                    <GhiChuItem key={item.id} item={item}
                      showCT={showCT} congTrinhMap={congTrinhMap}
                      onEdit={handleEdit}
                      onDelete={deleteItem}
                      onComplete={completeItem} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map(item => (
            <GhiChuItem key={item.id} item={item}
              showCT={showCT} congTrinhMap={congTrinhMap}
              onEdit={handleEdit}
              onDelete={deleteItem}
              onComplete={completeItem} />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <GhiChuForm
          congTrinhId={congTrinhId}
          congTrinhList={congTrinhList}
          initial={editItem}
          onSave={handleSave}
          onCancel={handleClose} />
      )}
    </div>
  )
}
