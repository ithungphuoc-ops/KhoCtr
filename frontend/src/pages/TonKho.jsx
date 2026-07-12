import React, { useState, useEffect } from 'react'
import { Package, Search, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { getTonKho } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')

export default function TonKho() {
  const { selectedCT, ctLoading, congTrinhs, isAdmin } = useCongTrinh()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCanhBao, setShowCanhBao] = useState(false)

  // Non-admin: luôn dùng CT được gán; Admin: dùng selectedCT (null = tất cả)
  const effectiveCTId = isAdmin ? selectedCT?.id : congTrinhs[0]?.id

  const loadData = () => {
    if (ctLoading) return
    if (!isAdmin && !effectiveCTId) return
    setLoading(true)
    const params = effectiveCTId ? { cong_trinh_id: effectiveCTId } : {}
    getTonKho(params)
      .then(res => setData(res.data?.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [selectedCT, ctLoading])

  const filtered = data.filter(r => {
    const matchSearch = !search ||
      (r.ten_hang || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.nhom     || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.ma_hang  || '').toLowerCase().includes(search.toLowerCase())
    const matchCB = !showCanhBao || (r.ton_cuoi ?? 0) <= 0
    return matchSearch && matchCB
  })

  const canhBaoCount = data.filter(r => (r.ton_cuoi ?? 0) <= 0).length
  const conHangCount = data.filter(r => (r.ton_cuoi ?? 0) > 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">TỒN KHO</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">Theo dõi tồn kho theo công trình và vật tư</p>
          {selectedCT
            ? <span className="inline-block mt-1 px-2 py-0.5 bg-hp-primary/15 text-hp-primary text-xs rounded-full">📌 {selectedCT.ten_ct}</span>
            : <span className="inline-block mt-1 px-2 py-0.5 bg-hp-accent/15 text-hp-accent text-xs rounded-full">🏢 Tất cả CT</span>
          }
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 min-h-10 bg-hp-accent/15 hover:bg-hp-accent/25 text-hp-accent rounded-hp-md text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <Package className="w-8 h-8 text-hp-accent flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-text">{fmt(data.length)}</div>
            <div className="text-sm text-hp-text-secondary">Tổng mặt hàng</div>
          </div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-hp-primary flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-text">{fmt(conHangCount)}</div>
            <div className="text-sm text-hp-text-secondary">Còn hàng trong kho</div>
          </div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3 cursor-pointer hover:border-hp-danger/50 transition-colors"
          onClick={() => setShowCanhBao(!showCanhBao)}>
          <AlertCircle className="w-8 h-8 text-hp-danger flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-hp-danger">{fmt(canhBaoCount)}</div>
            <div className="text-sm text-hp-text-secondary">Hết hàng / cần kiểm tra</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên hàng hóa, nhóm..."
            className="w-full pl-9 pr-4 py-2 min-h-10 bg-hp-surface border border-hp-border rounded-hp-md text-sm text-hp-text placeholder:text-hp-text-muted focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
        <span className="text-xs text-hp-text-muted italic">Chọn CT ở sidebar để lọc</span>
        <label className="flex items-center gap-2 text-sm text-hp-text-secondary cursor-pointer select-none">
          <input type="checkbox" checked={showCanhBao} onChange={e => setShowCanhBao(e.target.checked)}
            className="w-4 h-4 rounded accent-hp-primary" />
          Chỉ hiển thị hết hàng
        </label>
        <span className="text-xs text-hp-text-muted">{filtered.length} dòng</span>
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-hp-surface border-b border-hp-border">
              <tr>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">#</th>
                <th className="text-left px-3 py-3 text-hp-text-secondary font-medium">Mã hàng</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Tên hàng hóa</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Nhóm</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Công trình</th>
                <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tổng nhập</th>
                <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tổng xuất</th>
                <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tồn cuối</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">ĐVT</th>
                <th className="text-center px-4 py-3 text-hp-text-secondary font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={10} className="py-10 text-center text-hp-text-muted">Đang tải dữ liệu...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={10} className="py-10 text-center text-hp-text-muted">Không có dữ liệu tồn kho</td></tr>
                  : filtered.map((r, i) => {
                      const hetHang = (r.ton_cuoi ?? 0) <= 0
                      return (
                        <tr key={i} className={`border-b border-hp-divider hover:bg-hp-elevated transition-colors ${hetHang ? 'bg-hp-danger/10' : ''}`}>
                          <td className="px-4 py-2.5 text-hp-text-muted text-xs">{i + 1}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-hp-accent">{r.ma_hang || '—'}</td>
                          <td className="px-4 py-2.5 text-hp-text font-medium">{r.ten_hang}</td>
                          <td className="px-4 py-2.5 text-hp-text-secondary text-xs">{r.nhom || '—'}</td>
                          <td className="px-4 py-2.5 text-hp-text-secondary text-xs">{r.ma_ct || '—'}</td>
                          <td className="px-4 py-2.5 text-right text-hp-primary">{fmt(r.tong_nhap)}</td>
                          <td className="px-4 py-2.5 text-right text-hp-warning">{fmt(r.tong_xuat)}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${hetHang ? 'text-hp-danger' : 'text-hp-text'}`}>
                            {fmt(r.ton_cuoi)}
                          </td>
                          <td className="px-4 py-2.5 text-hp-text-secondary text-xs">{r.dvt || '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              hetHang ? 'bg-hp-danger/15 text-hp-danger' : 'bg-hp-primary/15 text-hp-primary'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${hetHang ? 'bg-hp-danger' : 'bg-hp-primary'}`} />
                              {hetHang ? 'Hết hàng' : 'Còn hàng'}
                            </span>
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
