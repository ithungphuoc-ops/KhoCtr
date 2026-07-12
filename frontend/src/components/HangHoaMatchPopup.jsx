/**
 * HangHoaMatchPopup.jsx — Popup 3 tab phân loại hàng hóa từ AI
 * Tính năng: 3 tab xanh/vàng/đỏ, tạo mặt hàng mới trực tiếp từ tab đỏ
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, CheckCircle, AlertCircle, HelpCircle, Trash2, Edit2, Check, Search, Loader, PlusCircle } from 'lucide-react'
import { confirmMatch, createHangHoa } from '../api'

const SESSION_KEY = 'kho_match_popup'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

function normalizeText(text) {
  if (!text) return ''
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(text) {
  return new Set(normalizeText(text).split(' ').filter(t => t.length > 1))
}

function buildRows(matchResult) {
  if (!matchResult) return []
  const all = [
    ...(matchResult.green  || []).map(it => ({ ...it, _tab: 'green' })),
    ...(matchResult.yellow || []).map(it => ({ ...it, _tab: 'yellow' })),
    ...(matchResult.red    || []).map(it => ({ ...it, _tab: 'red' })),
  ]
  return all.map((it, idx) => ({
    _rowId:     idx,
    _tab:       it._tab || it._match?.tab || 'red',
    _deleted:   false,
    _score:     it._match?.score ?? 0,
    _source:    it._match?.source ?? 'none',
    ten_ai_raw: it._match?.ten_ai_raw ?? it.ten_hang ?? '',
    ten_chuan:  it._match?.ten_chuan ?? '',
    so_luong:   it.so_luong ?? 0,
    dvt:        it.dvt ?? 'cái',
    don_gia:    it.don_gia ?? 0,
    thanh_tien: it.thanh_tien ?? 0,
    _is_global: false,
  }))
}

function loadFromSession(congTrinhId) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (saved.congTrinhId !== congTrinhId || Date.now() - saved.timestamp > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY); return null
    }
    return saved.rows
  } catch { return null }
}

function saveToSession(congTrinhId, rows) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ congTrinhId, timestamp: Date.now(), rows }))
  } catch {}
}

function clearSession() { sessionStorage.removeItem(SESSION_KEY) }

const TAB_META = {
  green:  { label: '🟢 Tự động khớp', bg: 'bg-hp-primary/10',  text: 'text-hp-primary',  badge: 'bg-hp-primary/15 text-hp-primary' },
  yellow: { label: '🟡 Cần xác nhận', bg: 'bg-hp-warning/10',  text: 'text-hp-warning',  badge: 'bg-hp-warning/15 text-hp-warning' },
  red:    { label: '🔴 Hàng mới',     bg: 'bg-hp-danger/10',   text: 'text-hp-danger',   badge: 'bg-hp-danger/15 text-hp-danger' },
}

export default function HangHoaMatchPopup({
  isOpen, onClose, matchResult, onConfirm,
  congTrinhId, loaiPhieu = 'nhap', fileName = '',
  aiProvider = '', aiModel = '', processingTimeMs = 0,
}) {
  const [rows, setRows]             = useState([])
  const [activeTab, setActiveTab]   = useState('green')
  const [search, setSearch]         = useState('')
  const [editingId, setEditingId]   = useState(null)
  const [editVal, setEditVal]       = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmErr, setConfirmErr] = useState(null)
  const [creatingRowId, setCreatingRowId] = useState(null)
  const [createForm, setCreateForm] = useState({ ma_hang: '', ten_hang: '', dvt: '', nhom: '' })
  const [creating, setCreating]     = useState(false)
  const [createErr, setCreateErr]   = useState(null)
  const editRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !matchResult) return
    const saved = loadFromSession(congTrinhId)
    if (saved && saved.length > 0) {
      setRows(saved)
    } else {
      const built = buildRows(matchResult)
      setRows(built)
      saveToSession(congTrinhId, built)
    }
    const hasGreen  = (matchResult.green  || []).length > 0
    const hasYellow = (matchResult.yellow || []).length > 0
    const hasRed    = (matchResult.red    || []).length > 0
    if (hasGreen) setActiveTab('green')
    else if (hasYellow) setActiveTab('yellow')
    else if (hasRed) setActiveTab('red')
    setSearch(''); setConfirmErr(null); setEditingId(null); setCreatingRowId(null)
  }, [isOpen, matchResult, congTrinhId])

  useEffect(() => {
    if (rows.length > 0) saveToSession(congTrinhId, rows)
  }, [rows, congTrinhId])

  useEffect(() => {
    if (editingId !== null && editRef.current) editRef.current.focus()
  }, [editingId])

  const tabRows = useCallback((tab) => rows.filter(r => r._tab === tab && !r._deleted), [rows])

  const filteredRows = useCallback((tab) => {
    const base = tabRows(tab)
    if (!search.trim()) return base
    const q = normalizeText(search)
    return base.filter(r => normalizeText(r.ten_ai_raw).includes(q) || normalizeText(r.ten_chuan).includes(q))
  }, [rows, search, tabRows])

  const countActive = (tab) => tabRows(tab).length

  const deleteRow = (rowId) =>
    setRows(prev => prev.map(r => r._rowId === rowId ? { ...r, _deleted: true } : r))

  const startEdit = (row) => { setEditingId(row._rowId); setEditVal(row.ten_chuan || row.ten_ai_raw) }

  const commitEdit = (rowId) => {
    setRows(prev => prev.map(r => r._rowId === rowId ? { ...r, ten_chuan: editVal.trim() || r.ten_ai_raw } : r))
    setEditingId(null); setEditVal('')
  }

  const updateField = (rowId, field, val) => {
    setRows(prev => prev.map(r => {
      if (r._rowId !== rowId) return r
      const updated = { ...r, [field]: val }
      if (field === 'so_luong' || field === 'don_gia') {
        const sl = parseFloat(field === 'so_luong' ? val : r.so_luong) || 0
        const dg = parseFloat(field === 'don_gia'  ? val : r.don_gia)  || 0
        updated.thanh_tien = sl * dg
      }
      return updated
    }))
  }

  const openCreateForm = (row) => {
    setCreatingRowId(row._rowId)
    setCreateForm({ ma_hang: '', ten_hang: row.ten_chuan || row.ten_ai_raw || '', dvt: row.dvt || 'cái', nhom: '' })
    setCreateErr(null)
  }

  const handleCreateHangHoa = async (row) => {
    if (!createForm.ma_hang.trim() || !createForm.ten_hang.trim()) {
      setCreateErr('Mã hàng và Tên hàng là bắt buộc'); return
    }
    setCreating(true); setCreateErr(null)
    try {
      await createHangHoa({
        ma_hang:       createForm.ma_hang.trim().toUpperCase(),
        ten_hang:      createForm.ten_hang.trim(),
        dvt:           createForm.dvt.trim() || row.dvt || 'cái',
        nhom:          createForm.nhom.trim() || '',
        cong_trinh_id: congTrinhId,
      })
      setRows(prev => prev.map(r =>
        r._rowId === row._rowId
          ? { ...r, ten_chuan: createForm.ten_hang.trim(), _tab: 'green', _score: 100, dvt: createForm.dvt.trim() || r.dvt }
          : r
      ))
      setCreatingRowId(null)
    } catch (e) {
      setCreateErr(e?.response?.data?.detail || e?.message || 'Lỗi tạo mặt hàng')
    } finally {
      setCreating(false)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true); setConfirmErr(null)
    const activeRows = rows.filter(r => !r._deleted)
    const mappings = activeRows
      .filter(r => r.ten_chuan && r.ten_chuan !== r.ten_ai_raw)
      .map(r => ({ ten_ai_raw: r.ten_ai_raw, ten_chuan: r.ten_chuan, is_global: r._is_global ?? false }))
    try {
      await confirmMatch({
        cong_trinh_id: congTrinhId, loai_phieu: loaiPhieu, file_name: fileName,
        mappings,
        khop_xanh: activeRows.filter(r => r._tab === 'green').length,
        khop_vang: activeRows.filter(r => r._tab === 'yellow').length,
        hang_moi:  activeRows.filter(r => r._tab === 'red').length,
        ai_provider: aiProvider, ai_model: aiModel, processing_time_ms: processingTimeMs,
      })
    } catch (e) {
      console.warn('[HangHoaMatchPopup] confirm-match error:', e?.response?.data || e.message)
    }
    clearSession()
    const confirmedItems = activeRows.map(r => ({
      ten_hang:   r.ten_chuan || r.ten_ai_raw,
      dvt:        r.dvt || 'cái',
      so_luong:   parseFloat(r.so_luong) || 0,
      don_gia:    parseFloat(r.don_gia)  || 0,
      thanh_tien: parseFloat(r.thanh_tien) || 0,
      _from_ai:   true,
    }))
    setConfirming(false)
    onConfirm?.(confirmedItems)
  }

  const handleClose    = () => onClose?.()
  const handleCancelAll = () => { clearSession(); setRows([]); onClose?.() }

  if (!isOpen) return null

  const stats = matchResult?.stats || {}
  const allActive = rows.filter(r => !r._deleted)

  return (
    <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-hp-elevated border border-hp-border rounded-hp-xl shadow-md w-full max-w-4xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hp-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-hp-lg bg-hp-primary/15 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-hp-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-hp-text">Xác nhận hàng hóa từ AI</h2>
              <p className="text-xs text-hp-text-muted mt-0.5">
                {stats.tong || allActive.length} dòng • kiểm tra rồi bấm <strong>Xác nhận</strong>
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-hp-md hover:bg-hp-card text-hp-text-muted hover:text-hp-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-3 px-6 py-3 bg-hp-card border-b border-hp-border">
          {[
            { tab: 'green',  icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Tự động khớp' },
            { tab: 'yellow', icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Cần xác nhận' },
            { tab: 'red',    icon: <HelpCircle  className="w-3.5 h-3.5" />, label: 'Hàng mới' },
          ].map(({ tab, icon, label }) => (
            <div key={tab} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-hp-md text-xs font-medium ${TAB_META[tab].badge}`}>
              {icon}<span>{countActive(tab)} {label}</span>
            </div>
          ))}
          {rows.filter(r => r._deleted).length > 0 && (
            <div className="ml-auto flex items-center text-xs text-hp-text-muted">
              {rows.filter(r => r._deleted).length} đã xóa
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {['green', 'yellow', 'red'].map(tab => {
            const meta = TAB_META[tab]
            const cnt  = countActive(tab)
            return (
              <button key={tab} onClick={() => { setActiveTab(tab); setSearch('') }}
                className={`px-4 py-2 rounded-t-hp-md text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab ? `${meta.text} border-current bg-hp-card` : 'text-hp-text-muted border-transparent hover:text-hp-text-secondary'
                }`}>
                {meta.label}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${meta.badge}`}>{cnt}</span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="px-6 py-2 border-t border-hp-border">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-hp-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm trong tab này..."
              className="w-full min-h-10 pl-8 pr-3 py-1.5 text-xs bg-hp-card border border-hp-border text-hp-text placeholder:text-hp-text-muted rounded-hp-md focus:outline-none focus:ring-2 focus:ring-hp-accent" />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 pb-3">
          {filteredRows(activeTab).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-hp-text-muted">
              <CheckCircle className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">
                {countActive(activeTab) === 0 ? 'Không có dòng nào trong tab này' : 'Không tìm thấy kết quả'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-hp-text-muted uppercase">
                  <th className="text-left py-2 font-medium w-6">#</th>
                  <th className="text-left py-2 font-medium">Tên AI nhận diện</th>
                  <th className="text-left py-2 font-medium">Tên chuẩn</th>
                  <th className="text-center py-2 font-medium w-16">Điểm</th>
                  <th className="text-right py-2 font-medium w-20">SL</th>
                  <th className="text-left py-2 font-medium w-16">DVT</th>
                  <th className="text-right py-2 font-medium w-24">Đơn giá</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows(activeTab).map((row, idx) => {
                  const meta = TAB_META[row._tab]
                  const isEditing = editingId === row._rowId
                  return (
                    <React.Fragment key={row._rowId}>
                      <tr className={`border-t border-hp-border ${meta.bg} hover:opacity-95`}>
                        <td className="py-2 pr-2 text-xs text-hp-text-muted">{idx + 1}</td>

                        {/* Tên AI */}
                        <td className="py-2 pr-3">
                          <span className="text-xs text-hp-text-secondary italic leading-tight block">
                            {row.ten_ai_raw || '—'}
                          </span>
                        </td>

                        {/* Tên chuẩn editable */}
                        <td className="py-2 pr-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input ref={editRef} value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                onBlur={() => commitEdit(row._rowId)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitEdit(row._rowId)
                                  if (e.key === 'Escape') { setEditingId(null); setEditVal('') }
                                }}
                                className="flex-1 border border-hp-accent rounded-hp-sm px-2 py-1 text-xs bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-accent" />
                              <button onClick={() => commitEdit(row._rowId)} className="p-1 text-hp-primary hover:text-hp-primary/80">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span className={`text-xs font-medium leading-tight flex-1 ${row.ten_chuan ? meta.text : 'text-hp-text-muted italic'}`}>
                                {row.ten_chuan || <span className="text-hp-danger text-xs">Chưa có tên — bấm ✎</span>}
                              </span>
                              <button onClick={() => startEdit(row)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-hp-text-muted hover:text-hp-accent transition-opacity">
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Score */}
                        <td className="py-2 text-center">
                          <span className={`text-xs font-bold ${meta.text}`}>
                            {row._score > 0 ? `${row._score}%` : '—'}
                          </span>
                        </td>

                        {/* SL */}
                        <td className="py-2 pr-2">
                          <input type="number" value={row.so_luong}
                            onChange={e => updateField(row._rowId, 'so_luong', e.target.value)}
                            className="w-full border border-hp-border rounded-hp-sm px-2 py-1 text-xs text-right bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-accent" />
                        </td>

                        {/* DVT */}
                        <td className="py-2 pr-2">
                          <input value={row.dvt}
                            onChange={e => updateField(row._rowId, 'dvt', e.target.value)}
                            className="w-full border border-hp-border rounded-hp-sm px-2 py-1 text-xs bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-accent" />
                        </td>

                        {/* Đơn giá */}
                        <td className="py-2 pr-2">
                          <input type="number" value={row.don_gia}
                            onChange={e => updateField(row._rowId, 'don_gia', e.target.value)}
                            className="w-full border border-hp-border rounded-hp-sm px-2 py-1 text-xs text-right bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-accent" />
                        </td>

                        {/* Actions */}
                        <td className="py-2 text-center">
                          <div className="flex items-center gap-0.5 justify-center">
                            {row._tab === 'red' && (
                              <button onClick={() => openCreateForm(row)} title="Tạo vào danh mục"
                                className="p-1 text-hp-text-disabled hover:text-hp-primary hover:bg-hp-primary/10 rounded transition-colors">
                                <PlusCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => deleteRow(row._rowId)}
                              className="p-1 text-hp-text-disabled hover:text-hp-danger hover:bg-hp-danger/10 rounded transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Mini form tạo mặt hàng */}
                      {creatingRowId === row._rowId && (
                        <tr className="bg-hp-primary/5 border-t border-hp-primary/20">
                          <td colSpan={8} className="px-3 py-3">
                            <div className="flex flex-col gap-2">
                              <p className="text-xs font-medium text-hp-primary">Tạo mặt hàng mới vào danh mục</p>
                              <div className="flex gap-2 flex-wrap items-end">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs text-hp-text-muted">Mã hàng *</label>
                                  <input value={createForm.ma_hang}
                                    onChange={e => setCreateForm(f => ({ ...f, ma_hang: e.target.value }))}
                                    placeholder="VD: MM-001"
                                    className="w-28 border border-hp-border rounded-hp-sm px-2 py-1 text-xs bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-primary" />
                                </div>
                                <div className="flex flex-col gap-1 flex-1 min-w-40">
                                  <label className="text-xs text-hp-text-muted">Tên hàng *</label>
                                  <input value={createForm.ten_hang}
                                    onChange={e => setCreateForm(f => ({ ...f, ten_hang: e.target.value }))}
                                    placeholder="Tên chuẩn"
                                    className="w-full border border-hp-border rounded-hp-sm px-2 py-1 text-xs bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-primary" />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs text-hp-text-muted">DVT</label>
                                  <input value={createForm.dvt}
                                    onChange={e => setCreateForm(f => ({ ...f, dvt: e.target.value }))}
                                    placeholder="cái"
                                    className="w-20 border border-hp-border rounded-hp-sm px-2 py-1 text-xs bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-primary" />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs text-hp-text-muted">Nhóm</label>
                                  <input value={createForm.nhom}
                                    onChange={e => setCreateForm(f => ({ ...f, nhom: e.target.value }))}
                                    placeholder="VD: Thiết bị"
                                    className="w-28 border border-hp-border rounded-hp-sm px-2 py-1 text-xs bg-hp-card text-hp-text focus:outline-none focus:ring-1 focus:ring-hp-primary" />
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => handleCreateHangHoa(row)} disabled={creating}
                                    className="px-3 py-1 bg-hp-primary text-white rounded-hp-sm text-xs font-medium hover:bg-hp-primary/90 disabled:opacity-50 flex items-center gap-1 min-h-[28px]">
                                    {creating ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    Lưu
                                  </button>
                                  <button onClick={() => { setCreatingRowId(null); setCreateErr(null) }}
                                    className="px-3 py-1 border border-hp-border rounded-hp-sm text-xs text-hp-text-secondary hover:bg-hp-card min-h-[28px]">
                                    Bỏ
                                  </button>
                                </div>
                              </div>
                              {createErr && <p className="text-xs text-hp-danger">{createErr}</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Đã xóa - khôi phục */}
          {rows.filter(r => r._deleted && r._tab === activeTab).length > 0 && (
            <div className="mt-3 border-t border-hp-divider pt-3">
              <p className="text-xs text-hp-text-muted mb-2">Đã xóa (bấm để khôi phục):</p>
              <div className="flex flex-wrap gap-2">
                {rows.filter(r => r._deleted && r._tab === activeTab).map(r => (
                  <button key={r._rowId}
                    onClick={() => setRows(prev => prev.map(x => x._rowId === r._rowId ? { ...x, _deleted: false } : x))}
                    className="px-2 py-1 text-xs bg-hp-elevated text-hp-text-muted rounded-hp-sm hover:bg-hp-card line-through">
                    {r.ten_ai_raw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {confirmErr && (
          <div className="mx-6 mb-2 p-2 bg-hp-danger/10 text-hp-danger text-xs rounded-hp-md border border-hp-danger/20">
            {confirmErr}
          </div>
        )}
        <div className="flex items-center justify-between px-6 py-4 border-t border-hp-border bg-hp-card rounded-b-hp-xl">
          <div className="text-xs text-hp-text-muted">
            <span className="font-medium text-hp-text-secondary">{allActive.length}</span> dòng sẽ đưa vào phiếu
            {rows.filter(r => r._deleted).length > 0 &&
              <span className="ml-2 text-hp-danger">({rows.filter(r => r._deleted).length} đã bỏ)</span>
            }
          </div>
          <div className="flex gap-3">
            <button onClick={handleCancelAll}
              className="px-4 min-h-10 border border-hp-border rounded-hp-md text-sm text-hp-text-secondary hover:bg-hp-elevated transition-colors">
              Hủy tất cả
            </button>
            <button onClick={handleClose}
              className="px-4 min-h-10 border border-hp-border rounded-hp-md text-sm text-hp-text-secondary hover:bg-hp-elevated transition-colors">
              Đóng
            </button>
            <button onClick={handleConfirm} disabled={confirming || allActive.length === 0}
              className="px-6 min-h-10 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors">
              {confirming
                ? <><Loader className="w-4 h-4 animate-spin" /> Đang lưu...</>
                : <><CheckCircle className="w-4 h-4" /> Xác nhận ({allActive.length} dòng)</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
