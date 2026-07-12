import React, { useState, useEffect } from 'react'
import { ClipboardList, RefreshCw, Search, Filter } from 'lucide-react'
import { getNhatKy } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'

const ACTION_LABELS = {
  create_nk:    { label: 'Tạo phiếu NK',  color: 'bg-hp-primary/15 text-hp-primary' },
  create_xk:    { label: 'Tạo phiếu XK',  color: 'bg-hp-warning/15 text-hp-warning' },
  delete_phieu: { label: 'Xóa phiếu',     color: 'bg-hp-danger/15 text-hp-danger' },
  login:        { label: 'Đăng nhập',     color: 'bg-hp-accent/15 text-hp-accent' },
  manual:       { label: 'Thủ công',      color: 'bg-hp-muted/20 text-hp-text-secondary' },
}

function fmtAction(action) {
  return ACTION_LABELS[action] || { label: action, color: 'bg-hp-muted/20 text-hp-text-secondary' }
}

function fmtTime(ts) {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return ts }
}

export default function NhatKy() {
  const { selectedCT, ctLoading, congTrinhs } = useCongTrinh()
  const ctMap = Object.fromEntries((congTrinhs || []).map(ct => [ct.id, ct.ten_ct]))

  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage]       = useState(0)
  const PAGE_SIZE = 50

  const loadData = () => {
    if (ctLoading) return
    setLoading(true)
    const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE }
    if (filterAction) params.action = filterAction
    if (selectedCT)   params.cong_trinh_id = selectedCT.id
    getNhatKy(params)
      .then(res => setLogs(res.data?.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [page, filterAction, selectedCT, ctLoading])

  const filtered = logs.filter(l =>
    !search ||
    (l.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.details    || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.action     || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">NHẬT KÝ HOẠT ĐỘNG</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">Theo dõi toàn bộ thao tác trên hệ thống</p>
          {selectedCT
            ? <span className="inline-block mt-1 px-2 py-0.5 bg-hp-accent/15 text-hp-accent text-xs rounded-full">📌 {selectedCT.ten_ct}</span>
            : <span className="inline-block mt-1 px-2 py-0.5 bg-hp-accent/15 text-hp-accent text-xs rounded-full">🏢 Tất cả công trình</span>
          }
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-hp-accent/15 hover:bg-hp-accent/25 text-hp-accent rounded-hp-md text-sm font-medium disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm người dùng, chi tiết..."
            className="w-full pl-9 pr-4 py-2 border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent bg-hp-elevated text-hp-text" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-hp-text-muted" />
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }}
            className="border border-hp-border rounded-hp-md px-3 py-2 text-sm text-hp-text bg-hp-elevated focus:outline-none focus:ring-2 focus:ring-hp-accent">
            <option value="">Tất cả hành động</option>
            <option value="create_nk">Tạo phiếu NK</option>
            <option value="create_xk">Tạo phiếu XK</option>
            <option value="delete_phieu">Xóa phiếu</option>
            <option value="login">Đăng nhập</option>
          </select>
        </div>
        <span className="text-xs text-hp-text-muted">{filtered.length} bản ghi</span>
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-hp-lg border border-hp-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-hp-surface border-b border-hp-border">
              <tr>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium w-8">#</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Thời gian</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Người dùng</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Hành động</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Chi tiết</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Công trình</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={6} className="py-10 text-center text-hp-text-muted">Đang tải...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={6} className="py-10 text-center text-hp-text-muted">
                      <ClipboardList className="w-10 h-10 text-hp-text-disabled mx-auto mb-2" />
                      Chưa có nhật ký nào
                    </td></tr>
                  : filtered.map((log, i) => {
                      const act = fmtAction(log.action)
                      return (
                        <tr key={log.id || i} className="border-b border-hp-border hover:bg-hp-elevated transition-colors">
                          <td className="px-4 py-3 text-hp-text-muted text-xs">{page * PAGE_SIZE + i + 1}</td>
                          <td className="px-4 py-3 text-hp-text-secondary text-xs whitespace-nowrap">{fmtTime(log.created_at)}</td>
                          <td className="px-4 py-3 text-hp-text-secondary text-xs">{log.user_email || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${act.color}`}>
                              {act.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-hp-text-secondary text-xs max-w-[280px] truncate" title={log.details}>{log.details || '—'}</td>
                          <td className="px-4 py-3 text-hp-text-secondary text-xs truncate max-w-[120px]">
                            {log.cong_trinh_id ? (ctMap[log.cong_trinh_id] || `CT #${log.cong_trinh_id}`) : '—'}
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
          className="px-4 py-2 border border-hp-border rounded-hp-md text-sm text-hp-text-secondary hover:bg-hp-elevated disabled:opacity-40">
          ← Trang trước
        </button>
        <span className="text-sm text-hp-text-secondary">Trang {page + 1}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={logs.length < PAGE_SIZE || loading}
          className="px-4 py-2 border border-hp-border rounded-hp-md text-sm text-hp-text-secondary hover:bg-hp-elevated disabled:opacity-40">
          Trang sau →
        </button>
      </div>
    </div>
  )
}
