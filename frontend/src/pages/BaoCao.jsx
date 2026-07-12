import React, { useState, useEffect } from 'react'
import { Search, RefreshCw, Eye, X } from 'lucide-react'
import { getPhieuList, getChiTietPhieu } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')
function formatVND(n) {
  const num = n ?? 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' tỷ'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + ' tr'
  return num.toLocaleString('vi-VN')
}

function getDefaultDates() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const f = (d) => d.toISOString().split('T')[0]
  return { from: f(from), to: f(now) }
}

export default function BaoCao() {
  const { selectedCT, ctLoading, congTrinhs, isAdmin } = useCongTrinh()
  const defaults = getDefaultDates()
  const [phieuList, setPhieuList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [loaiFilter, setLoaiFilter] = useState('ALL')
  const [tuNgay, setTuNgay] = useState(defaults.from)
  const [denNgay, setDenNgay] = useState(defaults.to)
  const [selectedPhieu, setSelectedPhieu] = useState(null)
  const [chiTiet, setChiTiet] = useState([])
  const [loadingChiTiet, setLoadingChiTiet] = useState(false)

  const ctMap = Object.fromEntries(congTrinhs.map(ct => [ct.id, ct.ten_ct]))

  // Non-admin: luôn dùng CT được gán; Admin: dùng selectedCT (null = tất cả)
  const effectiveCTId = isAdmin ? selectedCT?.id : congTrinhs[0]?.id

  const loadData = () => {
    if (ctLoading) return
    if (!isAdmin && !effectiveCTId) return
    setLoading(true)
    const params = { limit: 1000 }
    if (effectiveCTId) params.cong_trinh_id = effectiveCTId
    if (tuNgay) params.date_from = tuNgay
    if (denNgay) params.date_to  = denNgay
    getPhieuList(params)
      .then(res => setPhieuList(res.data?.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [selectedCT, ctLoading, tuNgay, denNgay])

  const openChiTiet = (phieu) => {
    setSelectedPhieu(phieu)
    setLoadingChiTiet(true)
    getChiTietPhieu(phieu.id)
      .then(res => setChiTiet(res.data?.items || []))
      .catch(() => setChiTiet([]))
      .finally(() => setLoadingChiTiet(false))
  }

  const filtered = phieuList.filter(p => {
    if (loaiFilter !== 'ALL' && p.loai !== loaiFilter) return false
    if (tuNgay && p.ngay < tuNgay) return false
    if (denNgay && p.ngay > denNgay) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(p.so_phieu || '').toLowerCase().includes(q) &&
          !(p.doi_tac || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const nkList = filtered.filter(p => p.loai === 'NK')
  const xkList = filtered.filter(p => p.loai === 'XK')
  const tongNK  = nkList.reduce((s, p) => s + (p.tong_tien || 0), 0)
  const tongXK  = xkList.reduce((s, p) => s + (p.tong_tien || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">BÁO CÁO CHI TIẾT</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-hp-text-secondary text-sm">Tra cứu phiếu NK / XK theo thời gian và công trình</p>
            {selectedCT
              ? <span className="bg-hp-accent/15 text-hp-accent text-xs font-semibold px-2.5 py-0.5 rounded-full">{selectedCT.ten_ct}</span>
              : <span className="bg-hp-accent/15 text-hp-accent text-xs font-semibold px-2.5 py-0.5 rounded-full">Tất cả CT</span>
            }
          </div>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-hp-accent/15 hover:bg-hp-accent/25 text-hp-accent rounded-hp-md text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* KPI nhanh */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4">
          <div className="text-xs text-hp-text-muted mb-1">Phiếu Nhập Kho</div>
          <div className="text-2xl font-bold text-hp-primary">{nkList.length}</div>
          <div className="text-xs text-hp-text-muted mt-0.5">phiếu trong kỳ</div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4">
          <div className="text-xs text-hp-text-muted mb-1">Tổng Tiền NK</div>
          <div className="text-xl font-bold text-hp-primary">{formatVND(tongNK)}</div>
          <div className="text-xs text-hp-text-muted mt-0.5">giá trị nhập kho</div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4">
          <div className="text-xs text-hp-text-muted mb-1">Phiếu Xuất Kho</div>
          <div className="text-2xl font-bold text-hp-warning">{xkList.length}</div>
          <div className="text-xs text-hp-text-muted mt-0.5">phiếu trong kỳ</div>
        </div>
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4">
          <div className="text-xs text-hp-text-muted mb-1">Tổng Tiền XK</div>
          <div className="text-xl font-bold text-hp-warning">{formatVND(tongXK)}</div>
          <div className="text-xs text-hp-text-muted mt-0.5">giá trị xuất kho</div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex gap-3 flex-wrap items-center">
        <select value={loaiFilter} onChange={e => setLoaiFilter(e.target.value)}
          className="border border-hp-border rounded-hp-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent text-hp-text bg-hp-elevated">
          <option value="ALL">Tất cả loại</option>
          <option value="NK">Nhập kho</option>
          <option value="XK">Xuất kho</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-hp-text-muted whitespace-nowrap">Từ ngày:</label>
          <input type="date" value={tuNgay} onChange={e => setTuNgay(e.target.value)}
            className="border border-hp-border rounded-hp-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent bg-hp-elevated text-hp-text" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-hp-text-muted whitespace-nowrap">Đến ngày:</label>
          <input type="date" value={denNgay} onChange={e => setDenNgay(e.target.value)}
            className="border border-hp-border rounded-hp-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent bg-hp-elevated text-hp-text" />
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm số phiếu, đối tác / NCC..."
            className="w-full pl-9 pr-4 py-2 border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent bg-hp-elevated text-hp-text" />
        </div>
        <span className="text-xs text-hp-text-muted bg-hp-elevated px-3 py-2 rounded-hp-md font-medium">{filtered.length} kết quả</span>
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-hp-lg border border-hp-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-hp-surface border-b border-hp-border">
              <tr>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">#</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Số phiếu</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Ngày</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Loại</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Công trình</th>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Đối tác / NCC</th>
                <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tổng tiền</th>
                <th className="text-center px-4 py-3 text-hp-text-secondary font-medium">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} className="py-12 text-center text-hp-text-muted">Đang tải dữ liệu...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={8} className="py-12 text-center text-hp-text-muted">Không có dữ liệu trong khoảng thời gian này</td></tr>
                  : filtered.map((p, i) => (
                      <tr key={p.id} className="border-b border-hp-border hover:bg-hp-elevated transition-colors">
                        <td className="px-4 py-3 text-hp-text-muted text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-hp-accent">{p.so_phieu}</td>
                        <td className="px-4 py-3 text-hp-text-secondary text-xs">{p.ngay}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            p.loai === 'NK' ? 'bg-hp-primary/15 text-hp-primary' : 'bg-hp-warning/15 text-hp-warning'
                          }`}>{p.loai === 'NK' ? 'Nhập kho' : 'Xuất kho'}</span>
                        </td>
                        <td className="px-4 py-3 text-hp-text-secondary text-xs truncate max-w-[150px]" title={ctMap[p.cong_trinh_id]}>
                          {ctMap[p.cong_trinh_id] || '—'}
                        </td>
                        <td className="px-4 py-3 text-hp-text-secondary text-xs truncate max-w-[120px]" title={p.doi_tac}>
                          {p.doi_tac || '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${p.loai === 'NK' ? 'text-hp-primary' : 'text-hp-warning'}`}>
                          {formatVND(p.tong_tien)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => openChiTiet(p)}
                            className="p-1.5 hover:bg-hp-elevated text-hp-text-muted hover:text-hp-accent rounded-hp-md transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot className="bg-hp-surface border-t-2 border-hp-border">
                <tr>
                  <td colSpan={6} className="px-4 py-3 font-bold text-hp-text text-sm">
                    Tổng cộng ({filtered.length} phiếu)
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-hp-text space-y-0.5">
                    <div className="text-hp-primary">NK: {formatVND(tongNK)}</div>
                    <div className="text-hp-warning">XK: {formatVND(tongXK)}</div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal chi tiết */}
      {selectedPhieu && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedPhieu(null) }}>
          <div className="bg-hp-elevated rounded-hp-lg shadow-md w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-hp-border">
              <div>
                <h3 className="font-bold text-hp-text text-lg flex items-center gap-2">
                  <span className={selectedPhieu.loai === 'NK' ? 'text-hp-primary' : 'text-hp-warning'}>
                    {selectedPhieu.so_phieu}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    selectedPhieu.loai === 'NK' ? 'bg-hp-primary/15 text-hp-primary' : 'bg-hp-warning/15 text-hp-warning'
                  }`}>{selectedPhieu.loai === 'NK' ? 'Nhập kho' : 'Xuất kho'}</span>
                </h3>
                <p className="text-sm text-hp-text-secondary mt-0.5">
                  {selectedPhieu.ngay}
                  {ctMap[selectedPhieu.cong_trinh_id] && <> · {ctMap[selectedPhieu.cong_trinh_id]}</>}
                  {selectedPhieu.doi_tac && <> · {selectedPhieu.doi_tac}</>}
                </p>
              </div>
              <button onClick={() => setSelectedPhieu(null)}
                className="p-1 hover:bg-hp-surface rounded-hp-md text-hp-text-muted hover:text-hp-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-5">
              {loadingChiTiet
                ? <div className="text-center text-hp-text-muted py-8">Đang tải...</div>
                : chiTiet.length === 0
                  ? <div className="text-center text-hp-text-muted py-8">Không có chi tiết</div>
                  : <table className="w-full text-sm">
                      <thead className="bg-hp-surface sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-hp-text-secondary font-medium">#</th>
                          <th className="text-left p-2 text-hp-text-secondary font-medium">Tên hàng</th>
                          <th className="text-right p-2 text-hp-text-secondary font-medium">SL</th>
                          <th className="text-left p-2 text-hp-text-secondary font-medium">DVT</th>
                          <th className="text-right p-2 text-hp-text-secondary font-medium">Đơn giá</th>
                          <th className="text-right p-2 text-hp-text-secondary font-medium">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chiTiet.map((item, i) => (
                          <tr key={i} className="border-b border-hp-border hover:bg-hp-surface">
                            <td className="p-2 text-hp-text-muted text-xs">{i + 1}</td>
                            <td className="p-2 text-hp-text">{item.ten_hang}</td>
                            <td className="p-2 text-right text-hp-text">{fmt(item.so_luong)}</td>
                            <td className="p-2 text-hp-text-secondary text-xs">{item.dvt}</td>
                            <td className="p-2 text-right text-hp-text-secondary">{formatVND(item.don_gia)}</td>
                            <td className="p-2 text-right font-medium text-hp-text">{formatVND(item.thanh_tien)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              }
            </div>
            <div className="p-4 border-t border-hp-border bg-hp-surface flex justify-between items-center">
              <span className="text-sm text-hp-text-secondary">{chiTiet.length} dòng hàng</span>
              <span className={`font-bold text-base ${selectedPhieu.loai === 'NK' ? 'text-hp-primary' : 'text-hp-warning'}`}>
                Tổng: {formatVND(selectedPhieu.tong_tien)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
