import React, { useState, useEffect } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, registerables } from 'chart.js'

ChartJS.register(...registerables)

import {
  Building2, Download, Upload, Package, DollarSign, AlertTriangle,
  ArrowRight, Database, Smartphone, RefreshCw, Monitor, AlertCircle,
  CheckCircle, RotateCcw, StickyNote, Plus, X, TrendingDown, TrendingUp,
  Layers
} from 'lucide-react'
import { getBaoCaoTongHop, getBieuDo } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'

// ── Màu ghi chú ──────────────────────────────────────────────
const NOTE_COLORS = [
  { key: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-200', btn: 'bg-yellow-400' },
  { key: 'blue',   bg: 'bg-blue-50',   border: 'border-blue-200',   btn: 'bg-blue-400'   },
  { key: 'green',  bg: 'bg-green-50',  border: 'border-green-200',  btn: 'bg-green-400'  },
  { key: 'pink',   bg: 'bg-pink-50',   border: 'border-pink-200',   btn: 'bg-pink-400'   },
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

  const dlBorderMap = { overdue: 'border-red-400', soon: 'border-amber-400', ok: 'border-transparent' }
  const dlBadgeMap  = { overdue: 'bg-red-100 text-red-700', soon: 'bg-amber-100 text-amber-700', ok: 'bg-green-100 text-green-700' }
  const dlLabelMap  = { overdue: '⚠ Quá hạn', soon: '⏰ Sắp đến', ok: '✓' }

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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-gray-800">Ghi chú công việc</h3>
        {overdueCount > 0 && (
          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
            {overdueCount} quá hạn!
          </span>
        )}
        {soonCount > 0 && overdueCount === 0 && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            {soonCount} sắp đến hạn
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">{notes.length} ghi chú</span>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 space-y-1.5">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addNote() }}
            placeholder="Nhập ghi chú... (Ctrl+Enter để lưu)"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-300 resize-none"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Deadline:</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:border-blue-300" />
            {deadline && <button onClick={() => setDeadline('')} className="text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            {NOTE_COLORS.map(c => (
              <button key={c.key} onClick={() => setColor(c.key)}
                className={`w-5 h-5 rounded-full ${c.btn} transition-transform ${color === c.key ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`} />
            ))}
          </div>
          <button onClick={addNote} disabled={!draft.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-40 transition-colors">
            <Plus className="w-3 h-3" /> Thêm
          </button>
        </div>
      </div>

      {notes.length === 0
        ? <div className="text-center text-gray-300 py-6 text-sm">Chưa có ghi chú nào</div>
        : <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
            {notes.map(n => {
              const c   = colorMap[n.mau] || colorMap.yellow
              const dls = dlStatus(n.deadline)
              const borderExtra = dls ? dlBorderMap[dls] : c.border
              return (
                <div key={n.id} className={`rounded-xl border-2 p-3 text-sm ${c.bg} ${borderExtra} relative group`}>
                  {editId === n.id
                    ? <div className="space-y-1.5">
                        <textarea value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={3}
                          className="w-full bg-transparent border-none outline-none text-gray-800 text-sm resize-none" />
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-xs text-gray-400">Deadline:</label>
                          <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs" />
                          {editDeadline && <button onClick={() => setEditDeadline('')} className="text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">Hủy</button>
                          <button onClick={() => saveEdit(n.id)} className="text-xs text-blue-600 font-medium hover:text-blue-800">Lưu</button>
                        </div>
                      </div>
                    : <>
                        <p className="text-gray-800 whitespace-pre-wrap cursor-pointer leading-relaxed" onClick={() => startEdit(n)}>{n.noi_dung}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <p className="text-xs text-gray-400">{n.created_at}</p>
                          {n.deadline && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${dlBadgeMap[dls] || 'bg-gray-100 text-gray-500'}`}>
                              {dlLabelMap[dls]} {fmtDeadline(n.deadline)}
                            </span>
                          )}
                        </div>
                        <button onClick={() => deleteNote(n.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white rounded-full text-gray-400 hover:text-red-500">
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 flex-1 min-w-0">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-gray-500 truncate">{title}</div>
        {loading
          ? <div className="h-7 w-16 bg-gray-100 rounded animate-pulse mt-1" />
          : <div className={`text-2xl font-bold leading-tight ${valueColor || 'text-gray-800'}`}>{value}</div>
        }
        <div className="text-xs text-gray-400 truncate">{subtitle}</div>
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-500" />
          Báo cáo tồn kho
        </h3>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm hàng..."
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-32 focus:outline-none focus:border-blue-300"
        />
      </div>
      {loading
        ? <div className="text-gray-400 text-sm text-center py-4">Đang tải...</div>
        : filtered.length === 0
          ? <div className="text-gray-400 text-sm text-center py-4">Không có dữ liệu</div>
          : <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100 text-gray-400">
                    <th className="text-left py-2 font-medium">Tên hàng</th>
                    <th className="text-right py-2 font-medium">Nhập</th>
                    <th className="text-right py-2 font-medium">Xuất</th>
                    <th className="text-right py-2 font-medium">Tồn</th>
                    <th className="text-right py-2 font-medium">ĐVT</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const ton = r.ton_cuoi ?? 0
                    const tonColor = ton <= 0 ? 'text-red-600 font-bold' : ton <= 20 ? 'text-amber-600 font-semibold' : 'text-green-700 font-semibold'
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 text-gray-700 max-w-[160px] truncate" title={r.ten_hang}>{r.ten_hang}</td>
                        <td className="py-1.5 text-right text-blue-600">{fmt(r.tong_nhap)}</td>
                        <td className="py-1.5 text-right text-orange-500">{fmt(r.tong_xuat)}</td>
                        <td className={`py-1.5 text-right ${tonColor}`}>{fmt(ton)}</td>
                        <td className="py-1.5 text-right text-gray-400">{r.dvt || ''}</td>
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
  const color = type === 'nk' ? 'text-blue-600' : 'text-orange-500'
  const bg    = type === 'nk' ? 'bg-blue-50' : 'bg-orange-50'
  const Icon  = type === 'nk' ? TrendingUp : TrendingDown
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        {title}
      </h3>
      {loading
        ? <div className="text-gray-400 text-sm text-center py-4">Đang tải...</div>
        : data.length === 0
          ? <div className="text-gray-400 text-sm text-center py-4">Chưa có dữ liệu</div>
          : <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {data.slice(0, 8).map((item, i) => {
                const maxTT = data[0]?.thanh_tien || 1
                const pct = Math.round((item.thanh_tien / maxTT) * 100)
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs text-gray-700 truncate max-w-[120px]" title={item.ten_hang}>{item.ten_hang}</span>
                        <span className={`text-xs font-semibold ${color}`}>{formatVND(item.thanh_tien)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div className={`h-1 rounded-full ${type === 'nk' ? 'bg-blue-400' : 'bg-orange-400'}`} style={{ width: `${pct}%` }} />
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
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'Xuất',
        data: bieuDoData.map(d => d.tong_xk),
        backgroundColor: 'rgba(249, 115, 22, 0.8)',
        borderRadius: 4,
        yAxisID: 'y',
      },
    ]
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 11 }, padding: 10 } },
    },
    scales: {
      y: { type: 'linear', display: true, position: 'left', grid: { color: '#f1f5f9' }, beginAtZero: true },
    }
  }

  const donutData = {
    labels: ['Nhập kho', 'Xuất kho'],
    datasets: [{
      data: [phieuNhap || 1, phieuXuat || 1],
      backgroundColor: ['rgba(34, 197, 94, 0.85)', 'rgba(249, 115, 22, 0.85)'],
      borderColor: ['#22c55e', '#f97316'],
      borderWidth: 2,
      hoverOffset: 4,
    }]
  }

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
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
          <h1 className="text-2xl font-bold text-gray-800">BÁO CÁO TỔNG HỢP</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 text-sm">Theo dõi hoạt động nhập - xuất - tồn kho</p>
            {selectedCT
              ? <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">📌 {selectedCT.ten_ct}</span>
              : <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">🏢 Tất cả công trình</span>
            }
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* KPI Cards — Row 1 */}
      <div className="flex gap-4">
        <KPICard loading={loading} icon={Building2}     iconBg="bg-blue-500"   title="Tổng công trình"   value={kpi?.so_cong_trinh ?? '—'}         subtitle="Đang hoạt động" />
        <KPICard loading={loading} icon={Download}      iconBg="bg-green-500"  title="Phiếu nhập"        value={kpi?.so_phieu_nk ?? '—'}            subtitle="Tổng số phiếu" />
        <KPICard loading={loading} icon={Upload}        iconBg="bg-orange-500" title="Phiếu xuất"        value={kpi?.so_phieu_xk ?? '—'}            subtitle="Tổng số phiếu" />
        <KPICard loading={loading} icon={Package}       iconBg="bg-purple-500" title="Mặt hàng quản lý"  value={fmt(kpi?.so_mat_hang)}              subtitle="Mã hàng hóa" />
        <KPICard loading={loading} icon={AlertTriangle} iconBg="bg-red-500"    title="Cảnh báo hết hàng" value={kpi?.so_canh_bao ?? '—'}            subtitle="Tồn ≤ 0" valueColor="text-red-600" />
      </div>

      {/* KPI Cards — Row 2: Giá trị */}
      <div className="flex gap-4">
        <KPICard loading={loading} icon={TrendingUp}   iconBg="bg-teal-500"   title="Tổng tiền nhập"  value={formatVND(kpi?.tong_tien_nk)}          subtitle="Giá trị phiếu NK" valueColor="text-teal-700" />
        <KPICard loading={loading} icon={TrendingDown} iconBg="bg-amber-500"  title="Tổng tiền xuất"  value={formatVND(kpi?.tong_tien_xk)}          subtitle="Giá trị phiếu XK" valueColor="text-amber-700" />
        <KPICard loading={loading} icon={DollarSign}   iconBg="bg-pink-500"   title="Tổng phiếu"      value={fmt(tongPhieu)}                        subtitle="NK + XK" />
        <KPICard loading={loading} icon={AlertCircle}  iconBg="bg-yellow-500" title="Sắp hết hàng"    value={kpi?.so_canh_bao_thap ?? canhBao.length} subtitle="Tồn ≤ 20" valueColor="text-yellow-700" />
        <KPICard loading={loading} icon={Layers}       iconBg="bg-red-600"    title="Âm kho"          value={kpi?.so_am_kho ?? '—'}                 subtitle="Tồn < 0" valueColor="text-red-700" />
      </div>

      {/* Row 3: Chart + Donut */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '5fr 3fr' }}>
        {/* Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Biểu đồ Nhập - Xuất</h3>
            <select
              value={chartMode}
              onChange={e => setChartMode(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:border-blue-300"
            >
              <option value="day">Theo ngày</option>
              <option value="week">Theo tuần</option>
              <option value="month">Theo tháng</option>
              <option value="year">Theo năm</option>
            </select>
          </div>
          <div style={{ height: 220 }}>
            {loading
              ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Đang tải...</div>
              : <Bar data={barChartData} options={barChartOptions} />
            }
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Tỷ lệ nhập xuất</h3>
          <div style={{ height: 200 }} className="relative">
            {loading
              ? <div className="h-full flex items-center justify-center text-gray-400 text-sm">Đang tải...</div>
              : <>
                  <Doughnut data={donutData} options={donutOptions} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-10px' }}>
                    <div className="text-center">
                      <div className="text-xl font-bold text-gray-800">{fmt(tongPhieu)}</div>
                      <div className="text-xs text-gray-400">Tổng phiếu</div>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Cảnh báo hết hàng</h3>
            <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
              {canhBao.length} cảnh báo
            </span>
          </div>
          {loading
            ? <div className="text-gray-400 text-sm text-center py-4">Đang tải...</div>
            : canhBao.length === 0
              ? <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <CheckCircle className="w-10 h-10 text-green-400 mb-2" />
                  <span className="text-sm">Không có cảnh báo tồn kho</span>
                </div>
              : <div className="space-y-2 max-h-64 overflow-y-auto">
                  {canhBao.map((cb, i) => {
                    const ton = cb.ton_cuoi ?? 0
                    const isZero = ton <= 0
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${isZero ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                        <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isZero ? 'text-red-500' : 'text-amber-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{cb.ten_hang}</div>
                          {cb.ma_ct && <div className="text-xs text-gray-500">{cb.ma_ct}</div>}
                          <div className={`text-xs font-medium mt-0.5 ${isZero ? 'text-red-600' : 'text-amber-600'}`}>
                            {isZero ? '❌ Hết hàng' : '⚠'} Tồn: {fmt(ton)} {cb.dvt || ''}
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Tổng hợp theo công trình</h3>
        {loading
          ? <div className="text-gray-400 text-sm text-center py-4">Đang tải...</div>
          : <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400">
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
                    ? <tr><td colSpan={6} className="py-4 text-center text-gray-400">Chưa có dữ liệu</td></tr>
                    : bangCT.map((ct, i) => (
                        <tr key={ct.id || i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 text-gray-400">{i + 1}</td>
                          <td className="py-2 text-gray-700 truncate max-w-[160px]" title={ct.ten_ct}>{ct.ten_ct}</td>
                          <td className="py-2 text-right text-green-600">{ct.so_phieu_nk || 0}</td>
                          <td className="py-2 text-right text-gray-700">{formatVND(ct.tong_tien_nk)}</td>
                          <td className="py-2 text-right text-orange-600">{ct.so_phieu_xk || 0}</td>
                          <td className="py-2 text-right text-gray-700">{formatVND(ct.tong_tien_xk)}</td>
                        </tr>
                      ))
                  }
                  {bangCT.length > 0 && (
                    <tr className="border-t-2 border-gray-200 font-bold bg-gray-50">
                      <td className="py-2 text-gray-600" colSpan={2}>Tổng cộng</td>
                      <td className="py-2 text-right text-green-700">{tongCT.so_phieu_nk}</td>
                      <td className="py-2 text-right text-gray-800">{formatVND(tongCT.tong_tien_nk)}</td>
                      <td className="py-2 text-right text-orange-700">{tongCT.so_phieu_xk}</td>
                      <td className="py-2 text-right text-gray-800">{formatVND(tongCT.tong_tien_xk)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Ghi chú công việc */}
      <GhiChuWidget />

      {/* Flow Diagram */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Luồng dữ liệu hệ thống</h3>
        <div className="flex items-stretch gap-2">
          {[
            { icon: Smartphone, color: 'bg-blue-500',   label: 'APP CON',       items: [`${kpi?.so_cong_trinh || 0} app công trình`, 'Nhập / xuất kho', 'Offline capable'] },
            { icon: RefreshCw,  color: 'bg-green-500',  label: 'ĐỒNG BỘ',      items: ['Auto sync Supabase', 'Real-time update', 'Delta sync'] },
            { icon: Database,   color: 'bg-purple-500', label: 'DATABASE TỔNG', items: ['Supabase PostgreSQL', 'Real-time', 'Backup tự động'] },
            { icon: Monitor,    color: 'bg-orange-500', label: 'WEB APP',       items: ['Dashboard', 'Báo cáo', 'Quản trị'] },
          ].map((node, i, arr) => (
            <React.Fragment key={i}>
              <div className="flex-1 border border-gray-100 rounded-xl p-3 flex flex-col items-center text-center gap-2">
                <div className={`w-10 h-10 rounded-xl ${node.color} flex items-center justify-center`}>
                  <node.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-xs font-bold text-gray-700">{node.label}</div>
                <ul className="text-xs text-gray-500 space-y-0.5 text-left w-full">
                  {node.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-1">
                      <span className="text-gray-300 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {i < arr.length - 1 && (
                <div className="flex items-center">
                  <ArrowRight className="w-5 h-5 text-gray-300" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
