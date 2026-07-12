import React, { useState, useEffect } from 'react'
import { useOutletContext, Link, useParams } from 'react-router-dom'
import { Download, Upload, Package, AlertCircle, RefreshCw, ArrowRight, AlertTriangle, CheckCircle, Settings } from 'lucide-react'
import { getPhieuList, getTonKho } from '../../api'

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')
function formatVND(n) {
  const num = n ?? 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' tỷ'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + ' tr'
  return num.toLocaleString('vi-VN')
}

export default function CTDashboard() {
  const { ctId } = useOutletContext() || {}
  const { id } = useParams()
  const realId = ctId || id

  const [phieuNK, setPhieuNK] = useState([])
  const [phieuXK, setPhieuXK] = useState([])
  const [tonKho, setTonKho] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    if (!realId) return
    setLoading(true)
    Promise.all([
      getPhieuList({ loai: 'NK', cong_trinh_id: realId, limit: 200 }),
      getPhieuList({ loai: 'XK', cong_trinh_id: realId, limit: 200 }),
      getTonKho({ cong_trinh_id: realId }),
    ])
      .then(([nkRes, xkRes, tkRes]) => {
        setPhieuNK(nkRes.data?.data || [])
        setPhieuXK(xkRes.data?.data || [])
        setTonKho(tkRes.data?.data || [])
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [realId])

  const [nguong, setNguong] = useState(10)   // ngưỡng cảnh báo sắp hết
  const [showNguong, setShowNguong] = useState(false)

  const tongTienNK = phieuNK.reduce((s, p) => s + (p.tong_tien || 0), 0)
  const tongTienXK = phieuXK.reduce((s, p) => s + (p.tong_tien || 0), 0)
  const amKho  = tonKho.filter(r => (r.ton_cuoi ?? 0) < 0)
  const hetHang = tonKho.filter(r => (r.ton_cuoi ?? 0) === 0)
  const sapHet  = tonKho.filter(r => (r.ton_cuoi ?? 0) > 0 && (r.ton_cuoi ?? 0) <= nguong)
  const conHang = tonKho.filter(r => (r.ton_cuoi ?? 0) > nguong)

  // 5 phiếu gần nhất
  const recentNK = [...phieuNK].sort((a, b) => (b.ngay || '').localeCompare(a.ngay || '')).slice(0, 5)
  const recentXK = [...phieuXK].sort((a, b) => (b.ngay || '').localeCompare(a.ngay || '')).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">TỔNG QUAN KHO</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">Thống kê nhập xuất tồn kho của công trình này</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 min-h-10 bg-hp-primary/15 hover:bg-hp-primary/25 text-hp-primary rounded-hp-md text-sm font-medium disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Download, bg: 'bg-hp-primary', label: 'Số phiếu NK', value: loading ? '...' : phieuNK.length, sub: formatVND(tongTienNK) },
          { icon: Upload,   bg: 'bg-hp-warning', label: 'Số phiếu XK', value: loading ? '...' : phieuXK.length, sub: formatVND(tongTienXK) },
          { icon: Package,  bg: 'bg-hp-accent', label: 'Mặt hàng còn hàng', value: loading ? '...' : conHang.length, sub: `/ ${tonKho.length} mặt hàng` },
          { icon: AlertCircle, bg: 'bg-hp-danger', label: 'Âm kho / Hết hàng', value: loading ? '...' : amKho.length + hetHang.length, sub: 'Cần nhập thêm', color: 'text-hp-danger' },
        ].map((kpi, i) => (
          <div key={i} className="bg-hp-card rounded-hp-lg border border-hp-border p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${kpi.bg} rounded-hp-lg flex items-center justify-center flex-shrink-0`}>
              <kpi.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs text-hp-text-secondary">{kpi.label}</div>
              <div className={`text-xl font-bold ${kpi.color || 'text-hp-text'}`}>{kpi.value}</div>
              <div className="text-xs text-hp-text-muted">{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent phieu */}
      <div className="grid grid-cols-2 gap-4">
        {/* NK */}
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-hp-text">Phiếu nhập gần nhất</h3>
            <Link to={`/ct/${realId}/nhap-kho`} className="text-xs text-hp-accent hover:underline flex items-center gap-1">
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading
            ? <div className="text-hp-text-muted text-sm text-center py-4">Đang tải...</div>
            : recentNK.length === 0
              ? <div className="text-hp-text-muted text-sm text-center py-4">Chưa có phiếu nhập</div>
              : <table className="w-full text-xs">
                  <thead><tr className="text-hp-text-muted border-b border-hp-border">
                    <th className="text-left py-1.5 font-medium">Số phiếu</th>
                    <th className="text-left py-1.5 font-medium">Ngày</th>
                    <th className="text-right py-1.5 font-medium">Tổng tiền</th>
                  </tr></thead>
                  <tbody>
                    {recentNK.map(p => (
                      <tr key={p.id} className="border-b border-hp-border hover:bg-hp-elevated">
                        <td className="py-1.5 font-mono text-hp-primary font-medium">{p.so_phieu}</td>
                        <td className="py-1.5 text-hp-text-secondary">{p.ngay}</td>
                        <td className="py-1.5 text-right text-hp-text">{formatVND(p.tong_tien)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          }
        </div>

        {/* XK */}
        <div className="bg-hp-card rounded-hp-lg border border-hp-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-hp-text">Phiếu xuất gần nhất</h3>
            <Link to={`/ct/${realId}/xuat-kho`} className="text-xs text-hp-accent hover:underline flex items-center gap-1">
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading
            ? <div className="text-hp-text-muted text-sm text-center py-4">Đang tải...</div>
            : recentXK.length === 0
              ? <div className="text-hp-text-muted text-sm text-center py-4">Chưa có phiếu xuất</div>
              : <table className="w-full text-xs">
                  <thead><tr className="text-hp-text-muted border-b border-hp-border">
                    <th className="text-left py-1.5 font-medium">Số phiếu</th>
                    <th className="text-left py-1.5 font-medium">Ngày</th>
                    <th className="text-right py-1.5 font-medium">Tổng tiền</th>
                  </tr></thead>
                  <tbody>
                    {recentXK.map(p => (
                      <tr key={p.id} className="border-b border-hp-border hover:bg-hp-elevated">
                        <td className="py-1.5 font-mono text-hp-warning font-medium">{p.so_phieu}</td>
                        <td className="py-1.5 text-hp-text-secondary">{p.ngay}</td>
                        <td className="py-1.5 text-right text-hp-text">{formatVND(p.tong_tien)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          }
        </div>
      </div>

      {/* ── CẢNH BÁO TỒN KHO ───────────────────────────────── */}
      {!loading && (amKho.length > 0 || hetHang.length > 0 || sapHet.length > 0) && (
        <div className="space-y-3">
          {/* Header cảnh báo + cài ngưỡng */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-hp-text flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-hp-warning" />
              Cảnh báo tồn kho
            </h3>
            <button onClick={() => setShowNguong(v => !v)}
              className="flex items-center gap-1 text-xs text-hp-text-muted hover:text-hp-text-secondary">
              <Settings className="w-3 h-3" />
              Ngưỡng: {nguong}
            </button>
          </div>

          {showNguong && (
            <div className="bg-hp-card rounded-hp-lg p-3 flex items-center gap-3 text-sm">
              <label className="text-hp-text-secondary text-xs">Cảnh báo sắp hết khi tồn &le;</label>
              <input
                type="number" min="1" max="100" value={nguong}
                onChange={e => setNguong(Number(e.target.value) || 10)}
                className="w-16 min-h-10 bg-hp-surface text-hp-text border border-hp-border rounded-hp-md px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-hp-accent"
              />
              <span className="text-xs text-hp-text-muted">(đơn vị tính)</span>
            </div>
          )}

          {/* Âm kho - critical */}
          {amKho.length > 0 && (
            <div className="bg-hp-card rounded-hp-lg border border-hp-danger/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-hp-danger rounded-full animate-pulse" />
                  <span className="font-semibold text-hp-danger text-sm">{amKho.length} mặt hàng ÂM KHO — khẩn cấp!</span>
                </div>
                <Link to={`/ct/${realId}/ton-kho`} className="text-xs text-hp-accent hover:underline flex items-center gap-1">
                  Xem tất cả <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {amKho.slice(0, 9).map((r, i) => (
                  <div key={i} className="bg-hp-danger/15 border border-hp-danger/20 rounded-hp-md px-3 py-2 text-xs">
                    <div className="font-medium text-hp-text truncate">{r.ten_hang}</div>
                    <div className="text-hp-danger font-bold">Tồn: {fmt(r.ton_cuoi)} {r.dvt}</div>
                  </div>
                ))}
              </div>
              {amKho.length > 9 && <p className="text-xs text-hp-text-muted text-center mt-2">...và {amKho.length - 9} mặt hàng khác</p>}
            </div>
          )}

          {/* Hết hàng - critical */}
          {hetHang.length > 0 && (
            <div className="bg-hp-card rounded-hp-lg border border-hp-warning/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 bg-hp-warning rounded-full" />
                <span className="font-semibold text-hp-warning text-sm">{hetHang.length} mặt hàng HẾT HÀNG (tồn = 0)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {hetHang.slice(0, 6).map((r, i) => (
                  <div key={i} className="bg-hp-warning/15 border border-hp-warning/20 rounded-hp-md px-3 py-2 text-xs">
                    <div className="font-medium text-hp-text truncate">{r.ten_hang}</div>
                    <div className="text-hp-warning font-bold">Đã hết hàng</div>
                  </div>
                ))}
              </div>
              {hetHang.length > 6 && <p className="text-xs text-hp-text-muted text-center mt-2">...và {hetHang.length - 6} mặt hàng khác</p>}
            </div>
          )}

          {/* Sắp hết - warning */}
          {sapHet.length > 0 && (
            <div className="bg-hp-card rounded-hp-lg border border-hp-warning/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 bg-hp-warning rounded-full" />
                <span className="font-semibold text-hp-warning text-sm">{sapHet.length} mặt hàng SẮP HẾT (tồn &le; {nguong})</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {sapHet.slice(0, 6).map((r, i) => (
                  <div key={i} className="bg-hp-warning/15 border border-hp-warning/20 rounded-hp-md px-3 py-2 text-xs">
                    <div className="font-medium text-hp-text truncate">{r.ten_hang}</div>
                    <div className="text-hp-warning font-semibold">Còn: {fmt(r.ton_cuoi)} {r.dvt}</div>
                  </div>
                ))}
              </div>
              {sapHet.length > 6 && <p className="text-xs text-hp-text-muted text-center mt-2">...và {sapHet.length - 6} mặt hàng khác</p>}
            </div>
          )}

          {/* OK - không có cảnh báo */}
          {amKho.length === 0 && hetHang.length === 0 && sapHet.length === 0 && (
            <div className="bg-hp-primary/15 rounded-hp-lg border border-hp-primary/20 p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-hp-primary" />
              <span className="text-sm text-hp-primary font-medium">Tồn kho ổn định — không có cảnh báo</span>
            </div>
          )}
        </div>
      )}

      {/* Không có cảnh báo */}
      {!loading && amKho.length === 0 && hetHang.length === 0 && sapHet.length === 0 && tonKho.length > 0 && (
        <div className="bg-hp-primary/15 rounded-hp-lg border border-hp-primary/20 p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-hp-primary" />
          <span className="text-sm text-hp-primary font-medium">Tồn kho ổn định — không có cảnh báo</span>
        </div>
      )}
    </div>
  )
}
