/**
 * HangHoaMatchPopup.jsx — Popup 3 tab phân loại hàng hóa từ AI
 *
 * Props:
 *   isOpen          {bool}    Hiển thị popup hay không
 *   onClose         {fn}      Đóng popup (không xác nhận)
 *   matchResult     {object}  { green:[], yellow:[], red:[], stats:{} } từ API /match-items
 *   onConfirm       {fn}      Callback sau khi xác nhận: (confirmedItems) => void
 *   congTrinhId     {number}
 *   loaiPhieu       {string}  "nhap" | "xuat"
 *   fileName        {string}  Tên file PDF gốc
 *   aiProvider      {string}
 *   aiModel         {string}
 *   processingTimeMs {number}
 *
 * Tính năng:
 *   - 3 tab: 🟢 Tự động khớp / 🟡 Cần xác nhận / 🔴 Hàng mới
 *   - Chỉnh sửa ten_chuan trực tiếp mỗi dòng
 *   - Xóa dòng (ẩn, không đưa vào form)
 *   - Lưu trạng thái vào sessionStorage (không mất khi đóng nhầm)
 *   - Fuzzy search realtime trong từng tab (JS, không gọi API)
 *   - Sau xác nhận: gọi API confirm-match → callback onConfirm(items)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, CheckCircle, AlertCircle, HelpCircle, Trash2, Edit2, Check, Search, Loader } from 'lucide-react'
import { confirmMatch } from '../api'

// ── sessionStorage key ─────────────────────────────────────
const SESSION_KEY = 'kho_match_popup'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000  // 24h

// ── Normalize (JS, mirror backend fuzzy_match.py) ──────────
function normalizeText(text) {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // bỏ dấu
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text) {
  return new Set(normalizeText(text).split(' ').filter(t => t.length > 1))
}

function jaccardScore(a, b) {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 && tb.size === 0) return 100
  if (ta.size === 0 || tb.size === 0) return 0
  const intersection = new Set([...ta].filter(x => tb.has(x)))
  const union = new Set([...ta, ...tb])
  return Math.round((intersection.size / union.size) * 100)
}

// ── Merge & annotate items từ matchResult ─────────────────
function buildRows(matchResult, congTrinhId) {
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
    ten_chuan:  it._match?.ten_chuan ?? '',   // Tên chuẩn đề xuất (editable)
    so_luong:   it.so_luong ?? 0,
    dvt:        it.dvt ?? 'cái',
    don_gia:    it.don_gia ?? 0,
    thanh_tien: it.thanh_tien ?? 0,
    _is_global: false,                        // user chọn lưu global
  }))
}

// ── Load / save sessionStorage ─────────────────────────────
function loadFromSession(congTrinhId) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (
      saved.congTrinhId !== congTrinhId ||
      Date.now() - saved.timestamp > SESSION_TTL_MS
    ) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return saved.rows
  } catch { return null }
}

function saveToSession(congTrinhId, rows) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      congTrinhId,
      timestamp: Date.now(),
      rows,
    }))
  } catch { /* ignore quota errors */ }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

// ── Badge tab ──────────────────────────────────────────────
const TAB_META = {
  green:  { label: '🟢 Tự động khớp',    bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700' },
  yellow: { label: '🟡 Cần xác nhận',    bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  red:    { label: '🔴 Hàng mới',        bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
}

// ── Main component ─────────────────────────────────────────
export default function HangHoaMatchPopup({
  isOpen,
  onClose,
  matchResult,
  onConfirm,
  congTrinhId,
  loaiPhieu = 'nhap',
  fileName = '',
  aiProvider = '',
  aiModel = '',
  processingTimeMs = 0,
}) {
  const [rows, setRows]           = useState([])
  const [activeTab, setActiveTab] = useState('green')
  const [search, setSearch]       = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal]     = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmErr, setConfirmErr] = useState(null)
  const editRef = useRef(null)

  // ── Init rows từ matchResult hoặc sessionStorage ────────
  useEffect(() => {
    if (!isOpen || !matchResult) return

    const saved = loadFromSession(congTrinhId)
    if (saved && saved.length > 0) {
      setRows(saved)
    } else {
      const built = buildRows(matchResult, congTrinhId)
      setRows(built)
      saveToSession(congTrinhId, built)
    }

    // Mặc định mở tab có dữ liệu
    const hasGreen  = (matchResult.green  || []).length > 0
    const hasYellow = (matchResult.yellow || []).length > 0
    const hasRed    = (matchResult.red    || []).length > 0
    if (hasGreen)        setActiveTab('green')
    else if (hasYellow)  setActiveTab('yellow')
    else if (hasRed)     setActiveTab('red')

    setSearch('')
    setConfirmErr(null)
    setEditingId(null)
  }, [isOpen, matchResult, congTrinhId])

  // Lưu sessionStorage mỗi khi rows thay đổi
  useEffect(() => {
    if (rows.length > 0) saveToSession(congTrinhId, rows)
  }, [rows, congTrinhId])

  // Focus ô edit khi mở
  useEffect(() => {
    if (editingId !== null && editRef.current) editRef.current.focus()
  }, [editingId])

  // ── Helpers ───────────────────────────────────────────────
  const tabRows = useCallback((tab) =>
    rows.filter(r => r._tab === tab && !r._deleted),
  [rows])

  const filteredRows = useCallback((tab) => {
    const base = tabRows(tab)
    if (!search.trim()) return base
    const q = normalizeText(search)
    return base.filter(r =>
      normalizeText(r.ten_ai_raw).includes(q) ||
      normalizeText(r.ten_chuan).includes(q)
    )
  }, [rows, search, tabRows])

  const countActive = (tab) => tabRows(tab).length

  const deleteRow = (rowId) => {
    setRows(prev => prev.map(r => r._rowId === rowId ? { ...r, _deleted: true } : r))
  }

  const startEdit = (row) => {
    setEditingId(row._rowId)
    setEditVal(row.ten_chuan || row.ten_ai_raw)
  }

  const commitEdit = (rowId) => {
    setRows(prev => prev.map(r => r._rowId === rowId ? { ...r, ten_chuan: editVal.trim() || r.ten_ai_raw } : r))
    setEditingId(null)
    setEditVal('')
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

  // ── Confirm ───────────────────────────────────────────────
  const handleConfirm = async () => {
    setConfirming(true)
    setConfirmErr(null)

    const activeRows = rows.filter(r => !r._deleted)
    const stats = {
      khop_xanh: activeRows.filter(r => r._tab === 'green').length,
      khop_vang: activeRows.filter(r => r._tab === 'yellow').length,
      hang_moi:  activeRows.filter(r => r._tab === 'red').length,
    }

    // Chỉ gửi các mapping có ten_chuan khác ten_ai_raw (có ích để học)
    const mappings = activeRows
      .filter(r => r.ten_chuan && r.ten_chuan !== r.ten_ai_raw)
      .map(r => ({
        ten_ai_raw:  r.ten_ai_raw,
        ten_chuan:   r.ten_chuan,
        is_global:   r._is_global ?? false,
      }))

    try {
      await confirmMatch({
        cong_trinh_id:     congTrinhId,
        loai_phieu:        loaiPhieu,
        file_name:         fileName,
        mappings,
        khop_xanh:         stats.khop_xanh,
        khop_vang:         stats.khop_vang,
        hang_moi:          stats.hang_moi,
        ai_provider:       aiProvider,
        ai_model:          aiModel,
        processing_time_ms: processingTimeMs,
      })
    } catch (e) {
      // Lỗi ghi lịch sử không block luồng chính
      console.warn('[HangHoaMatchPopup] confirm-match error:', e?.response?.data || e.message)
    }

    clearSession()

    // Chuyển đổi rows → items cho form nhập/xuất
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

  // ── Cancel toàn bộ ────────────────────────────────────────
  const handleClose = () => {
    // Không xóa sessionStorage — giữ lại nếu đóng nhầm
    onClose?.()
  }

  const handleCancelAll = () => {
    clearSession()
    setRows([])
    onClose?.()
  }

  if (!isOpen) return null

  const stats = matchResult?.stats || {}
  const allActive = rows.filter(r => !r._deleted)

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">Xác nhận hàng hóa từ AI</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.tong || allActive.length} dòng • kiểm tra rồi bấm <strong>Xác nhận</strong>
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100">
          {[
            { tab: 'green',  icon: <CheckCircle className="w-3.5 h-3.5" />, count: countActive('green'),  label: 'Tự động khớp' },
            { tab: 'yellow', icon: <AlertCircle className="w-3.5 h-3.5" />, count: countActive('yellow'), label: 'Cần xác nhận' },
            { tab: 'red',    icon: <HelpCircle className="w-3.5 h-3.5" />,  count: countActive('red'),    label: 'Hàng mới' },
          ].map(({ tab, icon, count, label }) => (
            <div key={tab} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${TAB_META[tab].badge}`}>
              {icon}
              <span>{count} {label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            {rows.filter(r => r._deleted).length > 0 && (
              <span>{rows.filter(r => r._deleted).length} đã xóa</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {['green', 'yellow', 'red'].map(tab => {
            const meta = TAB_META[tab]
            const cnt  = countActive(tab)
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSearch('') }}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? `${meta.text} border-current bg-white`
                    : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                {meta.label}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${meta.badge}`}>{cnt}</span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="px-6 py-2 border-t border-gray-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm trong tab này..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-teal-300"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 pb-3">
          {filteredRows(activeTab).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <CheckCircle className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">
                {countActive(activeTab) === 0
                  ? 'Không có dòng nào trong tab này'
                  : 'Không tìm thấy kết quả'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase">
                  <th className="text-left py-2 font-medium w-6">#</th>
                  <th className="text-left py-2 font-medium">Tên AI nhận diện</th>
                  <th className="text-left py-2 font-medium">Tên chuẩn (editable)</th>
                  <th className="text-center py-2 font-medium w-16">Điểm</th>
                  <th className="text-right py-2 font-medium w-20">SL</th>
                  <th className="text-left py-2 font-medium w-16">DVT</th>
                  <th className="text-right py-2 font-medium w-24">Đơn giá</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows(activeTab).map((row, idx) => {
                  const meta = TAB_META[row._tab]
                  const isEditing = editingId === row._rowId
                  return (
                    <tr key={row._rowId} className={`border-t border-gray-100 ${meta.bg} hover:opacity-95`}>
                      <td className="py-2 pr-2 text-xs text-gray-400">{idx + 1}</td>

                      {/* Tên AI raw */}
                      <td className="py-2 pr-3">
                        <span className="text-xs text-gray-500 italic leading-tight block">
                          {row.ten_ai_raw || '—'}
                        </span>
                      </td>

                      {/* Tên chuẩn (editable) */}
                      <td className="py-2 pr-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={editRef}
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onBlur={() => commitEdit(row._rowId)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEdit(row._rowId)
                                if (e.key === 'Escape') { setEditingId(null); setEditVal('') }
                              }}
                              className="flex-1 border border-teal-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-300"
                            />
                            <button onClick={() => commitEdit(row._rowId)}
                              className="p-1 text-teal-500 hover:text-teal-700">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span
                              className={`text-xs font-medium leading-tight flex-1 ${
                                row.ten_chuan ? meta.text : 'text-gray-400 italic'
                              }`}
                            >
                              {row.ten_chuan || <span className="text-red-400">Chưa có tên chuẩn — bấm ✎ để nhập</span>}
                            </span>
                            <button onClick={() => startEdit(row)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-teal-600 transition-opacity">
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

                      {/* So luong */}
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          value={row.so_luong}
                          onChange={e => updateField(row._rowId, 'so_luong', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-teal-300"
                        />
                      </td>

                      {/* DVT */}
                      <td className="py-2 pr-2">
                        <input
                          value={row.dvt}
                          onChange={e => updateField(row._rowId, 'dvt', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-300"
                        />
                      </td>

                      {/* Don gia */}
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          value={row.don_gia}
                          onChange={e => updateField(row._rowId, 'don_gia', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-teal-300"
                        />
                      </td>

                      {/* Xoa */}
                      <td className="py-2 text-center">
                        <button onClick={() => deleteRow(row._rowId)}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Danh sach da xoa (co the hoan tac) */}
          {rows.filter(r => r._deleted && r._tab === activeTab).length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 mb-2">Đã xóa (bấm để khôi phục):</p>
              <div className="flex flex-wrap gap-2">
                {rows.filter(r => r._deleted && r._tab === activeTab).map(r => (
                  <button
                    key={r._rowId}
                    onClick={() => setRows(prev => prev.map(x => x._rowId === r._rowId ? { ...x, _deleted: false } : x))}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded hover:bg-gray-200 line-through"
                  >
                    {r.ten_ai_raw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {confirmErr && (
          <div className="mx-6 mb-2 p-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
            {confirmErr}
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div className="text-xs text-gray-400">
            <span className="font-medium text-gray-600">{allActive.length}</span> dòng sẽ đưa vào phiếu
            {rows.filter(r => r._deleted).length > 0 &&
              <span className="ml-2 text-red-400">({rows.filter(r => r._deleted).length} đã bỏ)</span>
            }
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCancelAll}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Hủy tất cả
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming || allActive.length === 0}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
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
