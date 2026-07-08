/**
 * GhiChuModule.jsx — Core Module Ghi chú công việc
 * Dùng chung cho:
 *   App Công trình : congTrinhId=<id>, congTrinhList=[]
 *   App Tổng       : congTrinhId=null, congTrinhList=[...all CTs]
 *
 * Props:
 *   congTrinhId  : number | null
 *   congTrinhList: [{id, ten_ct}]
 *   title        : string
 */
import React, { useState, useMemo } from 'react'
import { Plus, RefreshCw, Search, StickyNote } from 'lucide-react'
import { useGhiChu }    from './useGhiChu'
import GhiChuList       from './GhiChuList'
import GhiChuForm       from './GhiChuForm'
import GhiChuDetail     from './GhiChuDetail'
import { TRANG_THAI_ORDER, TRANG_THAI_MAP, UU_TIEN_OPTIONS } from './ghiChuConfig'

export default function GhiChuModule({
  congTrinhId   = null,
  congTrinhList = [],
  title         = 'GHI CHÚ CÔNG VIỆC',
}) {
  const showCT = congTrinhList.length > 0

  const {
    items, loading, error,
    filters, setFilters,
    load,
    createItem, updateItem, deleteItem, completeItem,
  } = useGhiChu({ congTrinhId })

  const [showForm,   setShowForm]   = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [viewMode,   setViewMode]   = useState('kanban')

  // Build id → ten_ct map
  const congTrinhMap = useMemo(() => {
    const m = {}
    congTrinhList.forEach(ct => { m[ct.id] = ct.ten_ct })
    return m
  }, [congTrinhList])

  // Stats
  const stats = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    return {
      total:       items.length,
      mo:          items.filter(x => x.trang_thai === 'mo').length,
      dang_lam:    items.filter(x => x.trang_thai === 'dang_lam').length,
      hoan_thanh:  items.filter(x => x.trang_thai === 'hoan_thanh').length,
      overdue:     items.filter(x => {
        if (!x.deadline || ['hoan_thanh','huy'].includes(x.trang_thai)) return false
        const d = new Date(x.deadline.split('T')[0]); d.setHours(0,0,0,0)
        return d < now
      }).length,
    }
  }, [items])

  // Handlers
  const handleSave = async (payload) => {
    if (editItem) {
      const { cong_trinh_id, ...rest } = payload
      await updateItem(editItem.id, rest)
    } else {
      await createItem(payload)
    }
    setShowForm(false)
    setEditItem(null)
  }

  const handleEdit   = (item) => { setEditItem(item);  setShowForm(true) }
  const handleDetail = (item) => { setDetailItem(item) }
  const handleClose  = () => { setShowForm(false); setEditItem(null) }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-gray-400 text-sm">{stats.total} ghi chú</span>
            {stats.overdue > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
                {stats.overdue} quá hạn!
              </span>
            )}
            {stats.hoan_thanh > 0 && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                {stats.hoan_thanh} hoàn thành
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {['kanban','list'].map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize
                  ${viewMode === m ? 'bg-teal-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {m === 'kanban' ? 'Kanban' : 'Danh sách'}
              </button>
            ))}
          </div>
          <button onClick={load}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { setEditItem(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Thêm ghi chú
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-300" />
              <input
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                placeholder="Tìm tiêu đề, nội dung..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-teal-400"
              />
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

          {/* Deadline range */}
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

          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => setFilters({ trang_thai:'', uu_tien:'', search:'', deadline_from:'', deadline_to:'' })}
              className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors self-end">
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-16 text-gray-300">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="text-sm">Đang tải ghi chú...</p>
        </div>
      ) : items.length === 0 && !Object.values(filters).some(Boolean) ? (
        <div className="text-center py-16">
          <StickyNote className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Chưa có ghi chú nào</p>
          <button onClick={() => setShowForm(true)}
            className="mt-3 text-teal-500 hover:text-teal-700 text-sm font-medium">
            + Thêm ghi chú đầu tiên
          </button>
        </div>
      ) : (
        <GhiChuList
          items={items}
          viewMode={viewMode}
          showCT={showCT}
          congTrinhMap={congTrinhMap}
          onEdit={handleEdit}
          onDelete={deleteItem}
          onComplete={completeItem}
          onDetail={handleDetail}
        />
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {showForm && (
        <GhiChuForm
          congTrinhId={congTrinhId}
          congTrinhList={congTrinhList}
          initial={editItem}
          onSave={handleSave}
          onCancel={handleClose}
        />
      )}

      {detailItem && (
        <GhiChuDetail
          item={detailItem}
          congTrinhName={showCT ? congTrinhMap[detailItem.cong_trinh_id] : null}
          onClose={() => setDetailItem(null)}
          onEdit={item => { setDetailItem(null); handleEdit(item) }}
          onComplete={async id => { await completeItem(id); setDetailItem(null) }}
          onDelete={async id => { await deleteItem(id); setDetailItem(null) }}
        />
      )}
    </div>
  )
}
