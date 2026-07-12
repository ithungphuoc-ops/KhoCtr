import React, { useState, useEffect } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, registerables } from 'chart.js'

ChartJS.register(...registerables)

import {
  Building2, Download, Upload, Package, DollarSign, AlertTriangle,
  ArrowRight, Database, Smartphone, RefreshCw, Monitor, AlertCircle,
  CheckCircle, XCircle, RotateCcw, StickyNote, Plus, X, TrendingDown, TrendingUp,
  Layers
} from 'lucide-react'
import { getBaoCaoTongHop, getBieuDo } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'
import { HP } from '../theme/tokens'

// ── Màu ghi chú ──────────────────────────────────────────────
const NOTE_COLORS = [
  { key: 'yellow', bg: 'bg-hp-warning/10', border: 'border-hp-warning/40', btn: 'bg-hp-warning' },
  { key: 'blue',   bg: 'bg-hp-accent/10',  border: 'border-hp-accent/40',  btn: 'bg-hp-accent'  },
  { key: 'green',  bg: 'bg-hp-primary/10', border: 'border-hp-primary/40', btn: 'bg-hp-primary' },
  { key: 'pink',   bg: 'bg-hp-danger/10',  border: 'border-hp-danger/40',  btn: 'bg-hp-danger'  },
]
const colorMap = Object.fromEntries(NOTE_COLORS.map(c => [c.key, c]))

function GhiChuWidget() {
  const [notes, setNotes] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('khounice_ghi_chu') || '[]') }
    catch { return [] }
  })
  const [draft, setDraft]           = React.useState('')
  const [color, setColor]           = React.useState('yellow')
  const [deadline, setDeadline]     = React.useState('')
  const [editId, setEditId]         = React.useState(null)
  const [editText, setEditText]     = React.useState('')
  const [editDeadline, setEditDeadline] = React.useState('')

  const save = (next) => {
    setNotes(next)
    localStorage.setItem('khounice_ghi_chu', JSON.stringify(next))
  }

  const todayMidnight = () => { const d = new Date(); d.setHours(0,0,0,0); return d }
  const in3Days = () => { const d = todayMidnight(); d.setDate(d.getDate() + 3); return d }

  const dlStatus = (dl) => {
    if (!dl) return null
    const d = new Date(dl); d.setHours(0,0,0,0)
    if (d < todayMidnight())  return 'overdue'
    if (d <= in3Days())       return 'soon'
    return 'ok'
  }

  const fmtDeadline = (dl) => {
    if (!dl) return null
    return new Date(dl).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const overdueCount = notes.filter(n => dlStatus(n.deadline) === 'overdue').length
  const soonCount    = notes.filter(n => dlStatus(n.deadline) === 'soon').length

  const dlBorderMap = { overdue: 'border-hp-danger', soon: 'border-hp-warning', ok: 'border-transparent' }
  const dlBadgeMap  = { overdue: 'bg-hp-danger/15 text-hp-danger', soon: 'bg-hp-warning/15 text-hp-warning', ok: 'bg-hp-primary/15 text-hp-primary' }
  const dlLabelMap  = { overdue: 'Quá hạn', soon: 'Sắp đến', ok: '' }

  const addNote = () => {
    if (!draft.trim()) return
    save([{ id: Date.now(), noi_dung: draft.trim(), mau: color, deadline: deadline || null, created_at: new Date().toLocaleString('vi-VN') }, ...notes])
    setDraft('')
    setDeadline('')
  }

  const deleteNote = (id) => save(notes.filter(n => n.id !== id))

  const startEdit = (n) => { setEditId(n.id); setEditText(n.noi_dung); setEditDeadline(n.deadline || '') }
  const saveEdit  = (id) => {
    save(notes.map(n => n.id === id ? { ...n, noi_dung: editText, deadline: editDeadline || null } : n))
    setEditId(null)
  }

  return (
    <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="w-4 h-4 text-hp-warning" />
        <h3 className="font-semibold text-hp-text">Ghi chú công việc</h3>
        {overdueCount > 0 && (
          <span className="px-1.5 py-0.5 bg-hp-danger/15 text-hp-danger text-xs font-bold rounded-full animate-pulse">
            {overdueCount} quá hạn!
          </span>
        )}
        {soonCount > 0 && overdueCount === 0 && (
          <span className="px-1.5 py-0.5 bg-hp-warning/15 text-hp-warning text-xs font-medium rounded-full">
            {soonCount} sắp đến hạn
          </span>
        )}
        <span className="ml-auto text-xs text-hp-text-muted">{notes.length} ghi chú</span>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 space-y-1.5">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addNote() }}
            placeholder="Nhập ghi chú... (Ctrl+Enter để lưu)"
            rows={2}
            className="w-full min-h-10 bg-hp-surface text-hp-text border border-hp-border rounded-hp-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent resize-none"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-hp-text-muted whitespace-nowrap">Deadline:</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="flex-1 min-h-10 bg-hp-surface text-hp-text-secondary border border-hp-border rounded-hp-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-hp-accent" />
            {deadline && <button onClick={() => setDeadline('')} className="text-hp-text-muted hover:text-hp-text-secondary"><X className="w-3 h-3" /></button>}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            {NOTE_COLORS.map(c => (
              <button key={c.key} onClick={() => setColor(c.key)}
                className={`w-5 h-5 rounded-full ${c.btn} transition-transform ${color === c.key ? 'scale-125 ring-2 ring-offset-1 ring-offset-hp-card ring-hp-accent' : ''}`} />
            ))}
          </div>
          <button onClick={addNote} disabled={!draft.trim()}
            className="flex items-center gap-1 min-h-10 px-3 py-1.5 bg-hp-primary hover:bg-hp-primary/90 text-white rounded-hp-md text-xs font-medium disabled:opacity-40 transition-colors">
            <Plus className="w-3 h-3" /> Thêm
          </button>
        </div>
      </div>

      {notes.length === 0
        ? <div className="text-center text-hp-text-muted py-6 text-sm">Chưa có ghi chú nào</div>
        : <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
            {notes.map(n => {
              const c   = colorMap[n.mau] || colorMap.yellow
              const dls = dlStatus(n.deadline)
              const borderExtra = dls ? dlBorderMap[dls] : c.border
              return (
                <div key={n.id} className={`rounded-hp-lg border-2 p-3 text-sm ${c.bg} ${borderExtra} relative group`}>
                  {editId === n.id
                    ? <div className="space-y-1.5">
                        <textarea value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={3}
                          className="w-full bg-transparent border-none outline-none text-hp-text text-sm resize-none" />
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-xs text-hp-text-muted">Deadline:</label>
                          <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                            className="flex-1 min-h-10 bg-hp-surface text-hp-text-secondary border border-hp-border rounded-hp-sm px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                          {editDeadline && <button onClick={() => setEditDeadline('')} className="text-hp-text-muted hover:text-hp-text-secondary"><X className="w-3 h-3" /></button>}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditId(null)} className="text-xs text-hp-text-muted hover:text-hp-text-secondary">Hủy</button>
                          <button onClick={() => saveEdit(n.id)} className="text-xs text-hp-accent font-medium hover:text-hp-accent/80">Lưu</button>
                        </div>
                      </div>
                    : <>
                        <p className="text-hp-text whitespace-pre-wrap cursor-pointer leading-relaxed" onClick={() => startEdit(n)}>{n.noi_dung}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <p className="text-xs text-hp-text-muted">{n.created_at}</p>
                          {n.deadline && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${dlBadgeMap[dls] || 'bg-hp-muted/20 text-hp-text-secondary'}`}>
                              {dlLabelMap[dls]} {fmtDeadline(n.deadline)}
                            </span>
                          )}
                        </div>
                        <button onClick={() => deleteNote(n.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-hp-elevated rounded-full text-hp-text-muted hover:text-hp-danger">
                          <X className="w-3 h-3" />
                        </button>
                      </>
                  }
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')

function formatVND(n) {
  const num = n ?? 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + ' tỷ'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + ' tr'
  return num.toLocaleString('vi-VN')
}

function KPICard({ icon: Icon, iconBg, title, value, subtitle, valueColor, loading }) {
  return (
    <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-5 flex items-center gap-4 flex-1 min-w-0">
      <div className={`w-12 h-12 rounded-hp-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-hp-text-secondary truncate">{title}</div>
        {loading
          ? <div className="h-7 w-16 bg-hp-elevated rounded animate-pulse mt-1" />
          : <div className={`text-2xl font-bold leading-tight ${valueColor || 'text-hp-text'}`}>{value}</div>
        }
        <div className="text-xs text-hp-text-muted truncate">{subtitle}</div>
      </div>
    </div>
  )
}

// ── Bảng tồn kho mini ─────────────────────────────────────────
function TonKhoWidget({ data, loading }) {
  const [search, setSearch] = useState('')
  const filtered = data.filter(r =>
    !search || (r.ten_hang || '').toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-hp-text flex items-center gap-2">
          <Layers className="w-4 h-4 text-hp-accent" />
          Báo cáo tồn kho
        </h3>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm hàng..."
          className="min-h-10 bg-hp-surface text-hp-text border border-hp-border rounded-hp-md px-2 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-hp-accent"
        />
      </div>
      {loading
        ? <div className="text-hp-text-muted text-sm text-center py-4">Đang tải...</div>
        : filtered.length === 0
          ? <div className="text-hp-text-muted text-sm text-center py-4">Không có dữ liệu</div>
          : <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-hp-surface">
                  <tr className="border-b border-hp-border text-hp-text-secondary">
                    <th className="text-left py-2 font-medium">Tên hàng</th>
                    <th className="text-right py-2 font-medium">Nhập</th>
                    <th className="text-right py-2 font-medium">Xuất</th>
                    <th className="text-right py-2 font-medium">Tồn</th>
                    <th className="text-right py-2 font-medium">ĐVT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hp-border">
                  {filtered.map((r, i) => {
                    const ton = r.ton_cuoi ?? 0
                    const tonColor = ton <= 0 ? 'text-hp-danger font-bold' : ton <= 20 ? 'text-hp-warning font-semibold' : 'text-hp-primary font-semibold'
                    return (
                      <tr key={i} className="hover:bg-hp-elevated">
                        <td className="py-1.5 text-hp-text max-w-[160px] truncate" title={r.ten_hang}>{r.ten_hang}</td>
                        <td className="py-1.5 text-right text-hp-accent">{fmt(r.tong_nhap)}</td>
                        <td className="py-1.5 text-right text-hp-warning">{fmt(r.tong_xuat)}</td>
                        <td className={`py-1.5 text-right ${tonColor}`}>{fmt(ton)}</td>
                        <td className="py-1.5 text-right text-hp-text-muted">{r.dvt || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
      }
    </div>
  )
}

// ── Bảng nhập/xuất chi tiết ──────────────────────────────────
function TopVatTuWidget({ title, data, loading, type }) {
  const color    = type === 'nk' ? 'text-hp-accent' : 'text-hp-warning'
  const barColor = type === 'nk' ? 'bg-hp-accent' : 'bg-hp-warning'
  const Icon     = type === 'nk' ? TrendingUp : TrendingDown
  return (
    <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-5">
      <h3 className="font-semibold text-hp-text mb-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        {title}
      </h3>
      {loading
        ? <div className="text-hp-text-muted text-sm text-center py-4">Đang tải...</div>
        : data.length === 0
          ? <div className="text-hp-text-muted text-sm text-center py-4">Chưa có dữ liệu</div>
          : <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {data.slice(0, 8).map((item, i) => {
                const maxSL = data[0]?.so_luong || 1
                const pct   = Math.round((item.so_luong / maxSL) * 100)
                const label = item.thanh_tien > 0
                  ? formatVND(item.thanh_tien)
                  : `${fmt(item.so_luong)} ${item.dvt || ''}`
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-hp-text-muted w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs text-hp-text truncate max-w-[140px]" title={item.ten_hang}>{item.ten_hang}</span>
                        <span className={`text-xs font-semibold ${color} ml-2 whitespace-nowrap`}>{label}</span>
                      </div>
                      <div className="w-full bg-hp-elevated rounded-full h-1">
                        <div className={`h-1 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
      }
    </div>
  )
}

export default function Dashboard() {
  const { selectedCT, ctLoading, congTrinhs, isAdmin, dateFrom, dateTo } = useCongTrinh()
  const [chartMode, setChartMode] = useState('month')
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState(null)
  const [topNK, setTopNK] = useState([])
  const [topXK, setTopXK] = useState([])
  const [bangCT, setBangCT] = useState([])
  const [canhBao, setCanhBao] = useState([])
  const [bieuDoData, setBieuDoData] = useState([])
  const [tonKho, setTonKho] = useState([])

  // selectedCT?.id — undefined nếu admin chọn "Tất cả CT" (selectedCT=null)
  // Context đảm bảo: non-admin luôn có selectedCT=list[0]; admin default null
  const effectiveCTId = selectedCT?.id

  const loadData = () => {
    if (ctLoading) return
    // Không cần check isAdmin — context đảm bảo non-admin luôn có selectedCT sau khi load
    setLoading(true)

    const ctParam   = effectiveCTId ? { cong_trinh_id: effectiveCTId } : {}
    const dateParam = { date_from: dateFrom, date_to: dateTo }

    console.log('[Dashboard] loadData:', {
      effectiveCTId,
      ctParam,
      selectedCT: selectedCT?.ten_ct || 'Tất cả',
    })

    Promise.all([
      getBaoCaoTongHop({ ...ctParam, ...dateParam }),
      getBieuDo({ period: chartMode, from_date: dateFrom, to_date: dateTo, ...ctParam })
    ])
      .then(([bcRes, bdRes]) => {
        const bc = bcRes.data || {}
        console.log('[Dashboard] API response KPI:', bc.kpi)
        setKpi(bc.kpi || {})
        setTopNK(bc.top_vat_tu_nk || [])
        setTopXK(bc.top_vat_tu_xk || [])
        setBangCT(bc.bang_cong_trinh || [])
        setCanhBao(bc.canh_bao_ton_thap || [])
        setBieuDoData(bdRes.data?.data || [])
        setTonKho(bc.ton_kho || [])
      })
      .catch(err => console.error('[Dashboard] Load data error:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [chartMode, effectiveCTId, ctLoading, dateFrom, dateTo])

  const phieuNhap = kpi?.so_phieu_nk || 0
  const phieuXuat = kpi?.so_phieu_xk || 0
  const tongPhieu = phieuNhap + phieuXuat

  const barChartData = {
    labels: bieuDoData.length ? bieuDoData.map(d => d.period) : ['Chưa có dữ liệu'],
    datasets: [
      {
        type: 'bar',
        label: 'Nhập',
        data: bieuDoData.map(d => d.tong_nk),
        backgroundColor: HP.accent,
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'Xuất',
        data: bieuDoData.map(d => d.tong_xk),
        backgroundColor: HP.warning,
        borderRadius: 4,
        yAxisID: 'y',
      },
    ]
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 11 }, padding: 10, color: HP.textSecondary } },
    },
    scales: {
      x: { grid: { color: HP.border }, ticks: { color: HP.textSecondary } },
      y: { type: 'linear', display: true, position: 'left', grid: { color: HP.border }, ticks: { color: HP.textSecondary }, beginAtZero: true },
    }
  }

  const donutData = {
    labels: ['Nhập kho', 'Xuất kho'],
    datasets: [{
      data: [phieuNhap || 1, phieuXuat || 1],
      backgroundColor: [HP.primary, HP.warning],
      borderColor: [HP.primary, HP.warning],
      borderWidth: 2,
      hoverOffset: 4,
    }]
  }

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12, color: HP.textSecondary } },
    }
  }

  const tongCT = bangCT.reduce((a, c) => ({
    so_phieu_nk: a.so_phieu_nk + (c.so_phieu_nk || 0),
    so_phieu_xk: a.so_phieu_xk + (c.so_phieu_xk || 0),
    tong_tien_nk: a.tong_tien_nk + (c.tong_tien_nk || 0),
    tong_tien_xk: a.tong_tien_xk + (c.tong_tien_xk || 0),
  }), { so_phieu_nk: 0, so_phieu_xk: 0, tong_tien_nk: 0, tong_tien_xk: 0 })

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">BÁO CÁO TỔNG HỢP</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-hp-text-secondary text-sm">Theo dõi hoạt động nhập - xuất - tồn kho</p>
            {selectedCT
              ? <span className="bg-hp-primary/15 text-hp-primary text-xs font-semibold px-2.5 py-0.5 rounded-full">{selectedCT.ten_ct}</span>
              : <span className="bg-hp-accent/15 text-hp-accent text-xs font-semibold px-2.5 py-0.5 rounded-full">Tất cả công trình</span>
            }
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 min-h-10 px-4 py-2 bg-hp-accent/15 hover:bg-hp-accent/25 text-hp-accent rounded-hp-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* KPI Cards — Row 1 */}
      <div className="flex gap-4">
        <KPICard loading={loading} icon={Building2}     iconBg="bg-hp-accent"  title="Tổng công trình"   value={kpi?.so_cong_trinh ?? '—'}         subtitle="Đang hoạt động" />
        <KPICard loading={loading} icon={Download}      iconBg="bg-hp-primary" title="Phiếu nhập"        value={kpi?.so_phieu_nk ?? '—'}            subtitle="Tổng số phiếu" />
        <KPICard loading={loading} icon={Upload}        iconBg="bg-hp-warning" title="Phiếu xuất"        value={kpi?.so_phieu_xk ?? '—'}            subtitle="Tổng số phiếu" />
        <KPICard loading={loading} icon={Package}       iconBg="bg-hp-nav"     title="Mặt hàng quản lý"  value={fmt(kpi?.so_mat_hang)}              subtitle="Mã hàng hóa" />
        <KPICard loading={loading} icon={AlertTriangle} iconBg="bg-hp-danger"  title="Cảnh báo hết hàng" value={kpi?.so_canh_bao ?? '—'}            subtitle="Tồn ≤ 0" valueColor="text-hp-danger" />
      </div>

      {/* KPI Cards — Row 2: Giá trị */}
      <div className="flex gap-4">
        <KPICard loading={loading} icon={TrendingUp}   iconBg="bg-hp-primary" title="Tổng tiền nhập"  value={formatVND(kpi?.tong_tien_nk)}          subtitle="Giá trị phiếu NK" valueColor="text-hp-primary" />
        <KPICard loading={loading} icon={TrendingDown} iconBg="bg-hp-warning" title="Tổng tiền xuất"  value={formatVND(kpi?.tong_tien_xk)}          subtitle="Giá trị phiếu XK" valueColor="text-hp-warning" />
        <KPICard loading={loading} icon={DollarSign}   iconBg="bg-hp-accent"  title="Tổng phiếu"      value={fmt(tongPhieu)}                        subtitle="NK + XK" />
        <KPICard loading={loading} icon={AlertCircle}  iconBg="bg-hp-warning" title="Sắp hết hàng"    value={kpi?.so_canh_bao_thap ?? canhBao.length} subtitle="Tồn ≤ 20" valueColor="text-hp-warning" />
        <KPICard loading={loading} icon={Layers}       iconBg="bg-hp-danger"  title="Âm kho"          value={kpi?.so_am_kho ?? '—'}                 subtitle="Tồn < 0" valueColor="text-hp-danger" />
      </div>

      {/* Row 3: Chart + Donut */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '5fr 3fr' }}>
        {/* Bar Chart */}
        <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-hp-text">Biểu đồ Nhập - Xuất</h3>
            <select
              value={chartMode}
              onChange={e => setChartMode(e.target.value)}
              className="text-xs min-h-10 bg-hp-surface border border-hp-border rounded-hp-md px-2 py-1 text-hp-text-secondary focus:outline-none focus:ring-2 focus:ring-hp-accent"
            >
              <option value="day">Theo ngày</option>
              <option value="week">Theo tuần</option>
              <option value="month">Theo tháng</option>
              <option value="year">Theo năm</option>
            </select>
          </div>
          <div style={{ height: 220 }}>
            {loading
              ? <div className="h-full flex items-center justify-center text-hp-text-muted text-sm">Đang tải...</div>
              : <Bar data={barChartData} options={barChartOptions} />
            }
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-5">
          <h3 className="font-semibold text-hp-text mb-4">Tỷ lệ nhập xuất</h3>
          <div style={{ height: 200 }} className="relative">
            {loading
              ? <div className="h-full flex items-center justify-center text-hp-text-muted text-sm">Đang tải...</div>
              : <>
                  <Doughnut data={donutData} options={donutOptions} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-10px' }}>
                    <div className="text-center">
                      <div className="text-xl font-bold text-hp-text">{fmt(tongPhieu)}</div>
                      <div className="text-xs text-hp-text-muted">Tổng phiếu</div>
                    </div>
                  </div>
                </>
            }
          </div>
        </div>
      </div>

      {/* Row 4: Top vật tư NK + XK */}
      <div className="grid grid-cols-2 gap-4">
        <TopVatTuWidget title="Top vật tư nhập nhiều nhất"  data={topNK} loading={loading} type="nk" />
        <TopVatTuWidget title="Top vật tư xuất nhiều nhất"  data={topXK} loading={loading} type="xk" />
      </div>

      {/* Row 5: Tồn kho + Cảnh báo */}
      <div className="grid grid-cols-2 gap-4">
        <TonKhoWidget data={tonKho} loading={loading} />

        {/* Cảnh báo tồn kho */}
        <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-hp-text">Cảnh báo hết hàng</h3>
            <span className="bg-hp-danger/15 text-hp-danger text-xs font-semibold px-2 py-0.5 rounded-full">
              {canhBao.length} cảnh báo
            </span>
          </div>
          {loading
            ? <div className="text-hp-text-muted text-sm text-center py-4">Đang tải...</div>
            : canhBao.length === 0
              ? <div className="flex flex-col items-center justify-center py-8 text-hp-text-muted">
                  <CheckCircle className="w-10 h-10 text-hp-primary mb-2" />
                  <span className="text-sm">Không có cảnh báo tồn kho</span>
                </div>
              : <div className="space-y-2 max-h-64 overflow-y-auto">
                  {canhBao.map((cb, i) => {
                    const ton = cb.ton_cuoi ?? 0
                    const isZero = ton <= 0
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-hp-lg border ${isZero ? 'bg-hp-danger/10 border-hp-danger/30' : 'bg-hp-warning/10 border-hp-warning/30'}`}>
                        <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isZero ? 'text-hp-danger' : 'text-hp-warning'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-hp-text truncate">{cb.ten_hang}</div>
                          {cb.ma_ct && <div className="text-xs text-hp-text-secondary">{cb.ma_ct}</div>}
                          <div className={`text-xs font-medium mt-0.5 ${isZero ? 'text-hp-danger' : 'text-hp-warning'}`}>
                            {isZero
                              ? <><XCircle className="w-3.5 h-3.5 inline mr-0.5" /> Hết hàng</>
                              : <AlertTriangle className="w-3.5 h-3.5 inline mr-0.5" />
                            } Tồn: {fmt(ton)} {cb.dvt || ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
          }
        </div>
      </div>

      {/* Row 6: Tổng hợp theo công trình */}
      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-5">
        <h3 className="font-semibold text-hp-text mb-4">Tổng hợp theo công trình</h3>
        {loading
          ? <div className="text-hp-text-muted text-sm text-center py-4">Đang tải...</div>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-hp-surface border-b border-hp-border text-hp-text-secondary">
                    <th className="text-left py-2 font-medium">#</th>
                    <th className="text-left py-2 font-medium">Công trình</th>
                    <th className="text-right py-2 font-medium">P.Nhập</th>
                    <th className="text-right py-2 font-medium">Tiền NK</th>
                    <th className="text-right py-2 font-medium">P.Xuất</th>
                    <th className="text-right py-2 font-medium">Tiền XK</th>
                  </tr>
                </thead>
                <tbody>
                  {bangCT.length === 0
                    ? <tr><td colSpan={6} className="py-4 text-center text-hp-text-muted">Chưa có dữ liệu</td></tr>
                    : bangCT.map((ct, i) => (
                        <tr key={ct.id || i} className="border-b border-hp-divider hover:bg-hp-elevated">
                          <td className="py-2 text-hp-text-muted">{i + 1}</td>
                          <td className="py-2 text-hp-text truncate max-w-[160px]" title={ct.ten_ct}>{ct.ten_ct}</td>
                          <td className="py-2 text-right text-hp-primary">{ct.so_phieu_nk || 0}</td>
                          <td className="py-2 text-right text-hp-text">{formatVND(ct.tong_tien_nk)}</td>
                          <td className="py-2 text-right text-hp-warning">{ct.so_phieu_xk || 0}</td>
                          <td className="py-2 text-right text-hp-text">{formatVND(ct.tong_tien_xk)}</td>
                        </tr>
                      ))
                  }
                  {bangCT.length > 0 && (
                    <tr className="border-t-2 border-hp-border font-bold bg-hp-surface">
                      <td className="py-2 text-hp-text-secondary" colSpan={2}>Tổng cộng</td>
                      <td className="py-2 text-right text-hp-primary">{tongCT.so_phieu_nk}</td>
                      <td className="py-2 text-right text-hp-text">{formatVND(tongCT.tong_tien_nk)}</td>
                      <td className="py-2 text-right text-hp-warning">{tongCT.so_phieu_xk}</td>
                      <td className="py-2 text-right text-hp-text">{formatVND(tongCT.tong_tien_xk)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Flow Diagram */}
      <div className="bg-hp-card rounded-hp-lg shadow-sm border border-hp-border p-5">
        <h3 className="font-semibold text-hp-text mb-4">Luồng dữ liệu hệ thống</h3>
        <div className="flex items-stretch gap-2">
          {[
            { icon: Smartphone, color: 'bg-hp-accent',  label: 'APP CON',       items: [`${kpi?.so_cong_trinh || 0} app công trình`, 'Nhập / xuất kho', 'Offline capable'] },
            { icon: RefreshCw,  color: 'bg-hp-primary', label: 'ĐỒNG BỘ',      items: ['Auto sync Supabase', 'Real-time update', 'Delta sync'] },
            { icon: Database,   color: 'bg-hp-nav',     label: 'DATABASE TỔNG', items: ['Supabase PostgreSQL', 'Real-time', 'Backup tự động'] },
            { icon: Monitor,    color: 'bg-hp-warning', label: 'WEB APP',       items: ['Dashboard', 'Báo cáo', 'Quản trị'] },
          ].map((node, i, arr) => (
            <React.Fragment key={i}>
              <div className="flex-1 border border-hp-border rounded-hp-lg p-3 flex flex-col items-center text-center gap-2">
                <div className={`w-10 h-10 rounded-hp-lg ${node.color} flex items-center justify-center`}>
                  <node.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-xs font-bold text-hp-text">{node.label}</div>
                <ul className="text-xs text-hp-text-secondary space-y-0.5 text-left w-full">
                  {node.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-1">
                      <span className="text-hp-text-muted mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {i < arr.length - 1 && (
                <div className="flex items-center">
                  <ArrowRight className="w-5 h-5 text-hp-text-muted" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
