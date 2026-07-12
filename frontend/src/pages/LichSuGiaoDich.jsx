import React, { useState, useEffect } from 'react'
import { History, Search, RefreshCw, Download, Upload } from 'lucide-react'
import { getLichSuGiaoDich } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')
function formatVND(n) {
  const num = n ?? 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' tỷ'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + ' tr'
  return num.toLocaleString('vi-VN')
}

export default function LichSuGiaoDich() {
  const { selectedCT, ctLoading, congTrinhs, dateFrom, dateTo, isAdmin } = useCongTrinh()

  // Non-admin: luôn dùng CT đầu tiên được gán (không cho xem tất cả)
  const effectiveCT = isAdmin ? selectedCT : (congTrinhs?.[0] || null)

  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [loaiFilter, setLoaiFilter] = useState('')   // '' | 'NK' | 'XK'

  const loadData = () => {
    if (ctLoading) return
    // Non-admin: phải có CT, không load tất cả
    if (!isAdmin && !effectiveCT) return
    setLoading(true)
    const params = { limit: 2000 }
    if (effectiveCT) params.cong_trinh_id = effectiveCT.id
    if (loaiFilter)  params.loai = loaiFilter
    if (dateFrom)    params.date_from = dateFrom
    if (dateTo)      params.date_to   = dateTo
    getLichSuGiaoDich(params)
      .then(res => {
        setData(res.data?.data || [])
        setTotal(res.data?.total || 0)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [effectiveCT, ctLoading, loaiFilter, dateFrom, dateTo])

  const ctMap = Object.fromEntries((congTrinhs || []).map(ct => [ct.id, ct.ten_ct]))

  const filtered = data.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (r.ten_hang || '').toLowerCase().includes(q) ||
           (r.so_phieu || '').toLowerCase().includes(q) ||
           (r.doi_tac  || '').toLowerCase().includes(q)
  })

  const tongNK = filtered.filter(r => r.loai === 'NK').reduce((s, r) => s + (r.thanh_tien || 0), 0)
  const tongXK = filtered.filter(r => r.loai === 'XK').reduce((s, r) => s + (r.thanh_tien || 0), 0)
  const countNK = filtered.filter(r => r.loai === 'NK').length
  const countXK = filtered.filter(r => r.loai === 'XK').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">LỊCH SỬ GIAO DỊCH</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">Toàn bộ hàng hóa nhập/xuất theo từng phiếu</p>
          {effectiveCT
            ? <span className="inline-block mt-1 px-2 py-0.5 bg-hp-primary/15 text-hp-primary text-xs rounded-full">📌 {effectiveCT.ten_ct}</span>
            : isAdmin
              ? <span className="inline-block mt-1 px-2 py-0.5 bg-hp-accent/15 text-hp-accent text-xs rounded-full">🏢 Tất cả CT</span>
              : <span className="inline-block mt-1 px-2 py-0.5 bg-hp-muted/20 text-hp-text-secondary text-xs rounded-full">Chưa có công trình</span>
          }
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 min-h-10 bg-hp-accent/15 hover:bg-hp-accent/25 text-hp-accent rounded-hp-md text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3 cursor-pointer hover:border-hp-accent/50"
          onClick={() => setLoaiFilter(loaiFilter === 'NK' ? '' : 'NK')}>
          <Download className={`w-8 h-8 flex-shrink-0 ${loaiFilter === 'NK' ? 'text-hp-accent' : 'text-hp-accent/60'}`} />
          <div>
            <div className="text-2xl font-bold text-hp-text">{countNK}</div>
            <div className="text-sm text-hp-text-secondary">Dòng nhập kho · {formatVND(tongNK)}</div>
          </div>
          {loaiFilter === 'NK' && <span className="ml-auto text-xs bg-hp-accent/15 text-hp-accent px-2 py-0.5 rounded-full">Đang lọc</span>}
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3 cursor-pointer hover:border-hp-warning/50"
          onClick={() => setLoaiFilter(loaiFilter === 'XK' ? '' : 'XK')}>
          <Upload className={`w-8 h-8 flex-shrink-0 ${loaiFilter === 'XK' ? 'text-hp-warning' : 'text-hp-warning/60'}`} />
          <div>
            <div className="text-2xl font-bold text-hp-text">{countXK}</div>
            <div className="text-sm text-hp-text-secondary">Dòng xuất kho · {formatVND(tongXK)}</div>
          </div>
          {loaiFilter === 'XK' && <span className="ml-auto text-xs bg-hp-warning/15 text-hp-warning px-2 py-0.5 rounded-full">Đang lọc</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên hàng, số phiếu, đối tác..."
            className="w-full pl-9 pr-4 py-2 min-h-10 bg-hp-surface border border-hp-border rounded-hp-md text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
        <div className="flex gap-1">
          {['', 'NK', 'XK'].map(v => (
            <button key={v} onClick={() => setLoaiFilter(v)}
              className={`px-3 py-1.5 rounded-hp-md text-xs font-medium transition-colors ${
                loaiFilter === v
                  ? v === 'NK' ? 'bg-hp-accent text-white' : v === 'XK' ? 'bg-hp-warning text-white' : 'bg-hp-nav text-white'
                  : 'bg-hp-elevated text-hp-text-secondary hover:text-hp-text'
              }`}>
              {v === '' ? 'Tất cả' : v === 'NK' ? 'Nhập kho' : 'Xuất kho'}
            </button>
          ))}
        </div>
        <span className="text-xs text-hp-text-muted">{filtered.length} / {total} dòng</span>
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-hp-surface border-b border-hp-border">
              <tr>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">#</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Tên hàng hóa</th>
                <th className="text-right px-3 py-3 text-hp-text-secondary font-medium">SL</th>
                <th className="text-left px-2 py-3 text-hp-text-secondary font-medium">ĐVT</th>
                <th className="text-right px-3 py-3 text-hp-text-secondary font-medium">Đơn giá</th>
                <th className="text-right px-3 py-3 text-hp-text-secondary font-medium">Thành tiền</th>
                <th className="text-center px-3 py-3 text-hp-text-secondary font-medium">Loại</th>
                <th className="text-left px-3 py-3 text-hp-text-secondary font-medium">Số phiếu</th>
                <th className="text-left px-3 py-3 text-hp-text-secondary font-medium">Ngày</th>
                <th className="text-left px-3 py-3 text-hp-text-secondary font-medium">Đối tác</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={10} className="py-10 text-center text-hp-text-muted">Đang tải dữ liệu...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={10} className="py-10 text-center text-hp-text-muted">Không có dữ liệu</td></tr>
                  : filtered.map((r, i) => (
                      <tr key={i} className="border-b border-hp-divider hover:bg-hp-elevated transition-colors">
                        <td className="px-4 py-2.5 text-hp-text-muted text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 text-hp-text font-medium max-w-[200px] truncate">{r.ten_hang}</td>
                        <td className="px-3 py-2.5 text-right text-hp-text">{fmt(r.so_luong)}</td>
                        <td className="px-2 py-2.5 text-hp-text-secondary text-xs">{r.dvt || '—'}</td>
                        <td className="px-3 py-2.5 text-right text-hp-text-secondary text-xs">{formatVND(r.don_gia)}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold text-xs ${r.loai === 'NK' ? 'text-hp-accent' : 'text-hp-warning'}`}>
                          {formatVND(r.thanh_tien)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.loai === 'NK' ? 'bg-hp-accent/15 text-hp-accent' : 'bg-hp-warning/15 text-hp-warning'
                          }`}>
                            {r.loai === 'NK' ? '↓ NK' : '↑ XK'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-hp-accent">{r.so_phieu}</td>
                        <td className="px-3 py-2.5 text-hp-text-secondary text-xs">{r.ngay}</td>
                        <td className="px-3 py-2.5 text-hp-text-secondary text-xs truncate max-w-[120px]">{r.doi_tac || '—'}</td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
