import React, { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, Package } from 'lucide-react'
import { getTonKho } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'

const MUC_DO = [
  { label: 'Hết hàng',   color: 'bg-hp-danger/15 text-hp-danger',    check: (t) => t <= 0 },
  { label: 'Rất thấp',   color: 'bg-hp-warning/15 text-hp-warning',  check: (t) => t > 0 && t <= 5 },
  { label: 'Thấp',       color: 'bg-hp-warning/15 text-hp-warning',   check: (t) => t > 5 && t <= 20 },
]

function getMucDo(ton) {
  for (const m of MUC_DO) if (m.check(ton)) return m
  return null
}

export default function CanhBao() {
  const { selectedCT, ctLoading } = useCongTrinh()
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all') // all | het | rat_thap | thap

  const loadData = () => {
    if (ctLoading) return
    setLoading(true)
    const params = selectedCT ? { cong_trinh_id: selectedCT.id } : {}
    getTonKho(params)
      .then(res => {
        const rows = res.data?.data || []
        // Chỉ giữ những mặt hàng có cảnh báo (ton_cuoi <= 20)
        const canhBao = rows
          .filter(r => getMucDo(r.ton_cuoi ?? 0))
          .sort((a, b) => (a.ton_cuoi ?? 0) - (b.ton_cuoi ?? 0))
        setData(canhBao)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [selectedCT, ctLoading])

  const filtered = data.filter(r => {
    const ton = r.ton_cuoi ?? 0
    if (filter === 'het')      return ton <= 0
    if (filter === 'rat_thap') return ton > 0 && ton <= 5
    if (filter === 'thap')     return ton > 5 && ton <= 20
    return true
  })

  const hetHang   = data.filter(r => (r.ton_cuoi ?? 0) <= 0).length
  const ratThap   = data.filter(r => { const t = r.ton_cuoi ?? 0; return t > 0 && t <= 5 }).length
  const thap      = data.filter(r => { const t = r.ton_cuoi ?? 0; return t > 5 && t <= 20 }).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">CẢNH BÁO TỒN KHO</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">Danh sách vật tư cần bổ sung theo công trình</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="p-2 border border-hp-border rounded-hp-md hover:bg-hp-elevated text-hp-text-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Tổng cảnh báo', value: data.length,  color: 'text-hp-text',    bg: 'bg-hp-card', active: filter === 'all',      key: 'all' },
          { label: 'Hết hàng',      value: hetHang,       color: 'text-hp-danger',  bg: 'bg-hp-card', active: filter === 'het',       key: 'het' },
          { label: 'Rất thấp',      value: ratThap,       color: 'text-hp-warning', bg: 'bg-hp-card', active: filter === 'rat_thap',  key: 'rat_thap' },
          { label: 'Thấp',          value: thap,          color: 'text-hp-warning',  bg: 'bg-hp-card', active: filter === 'thap',     key: 'thap' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`${s.bg} rounded-hp-lg border p-4 text-left transition-all ${
              s.active ? 'border-hp-accent ring-1 ring-hp-accent/30' : 'border-hp-border hover:border-hp-border/60'
            }`}>
            <div className="text-xs text-hp-text-muted mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-hp-lg border border-hp-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hp-border">
          <h3 className="font-semibold text-hp-text">
            Danh sách cảnh báo ({filtered.length})
          </h3>
          {filtered.length > 0 && (
            <span className="bg-hp-danger/15 text-hp-danger text-xs font-semibold px-2 py-0.5 rounded-full">
              {filtered.length} mục cần xử lý
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-hp-text-muted">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-12 h-12 text-hp-text-disabled mx-auto mb-3" />
            <div className="text-hp-text-muted font-medium">Không có cảnh báo nào</div>
            <div className="text-hp-text-muted text-sm mt-1">Tất cả vật tư đều có tồn kho ổn định</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hp-border text-hp-text-secondary text-xs bg-hp-surface">
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Tên vật tư</th>
                <th className="text-left px-4 py-3 font-medium">Nhóm</th>
                <th className="text-left px-4 py-3 font-medium">Công trình</th>
                <th className="text-right px-4 py-3 font-medium">Tồn kho</th>
                <th className="text-center px-4 py-3 font-medium">Mức độ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const ton = item.ton_cuoi ?? 0
                const mucDo = getMucDo(ton)
                return (
                  <tr key={i} className="border-b border-hp-border hover:bg-hp-elevated">
                    <td className="px-4 py-3 text-hp-text-muted">{i + 1}</td>
                    <td className="px-4 py-3 text-hp-text font-medium">{item.ten_hang}</td>
                    <td className="px-4 py-3 text-hp-text-secondary text-xs">{item.nhom || '—'}</td>
                    <td className="px-4 py-3 text-hp-text-secondary text-xs">{item.ma_ct || '—'}</td>
                    <td className={`px-4 py-3 text-right font-bold ${ton <= 0 ? 'text-hp-danger' : 'text-hp-warning'}`}>
                      {ton.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${mucDo.color}`}>
                        <AlertTriangle className="w-3 h-3" />
                        {mucDo.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
