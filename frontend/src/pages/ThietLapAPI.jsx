import React, { useState, useEffect, useCallback } from 'react'
import {
  Cpu, Building2, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Settings, Trash2, ZapOff, Zap, Play,
  ChevronRight, Eye, EyeOff, Save, Info, Clock
} from 'lucide-react'
import { api } from '../api'
import { useCongTrinh } from '../context/CongTrinhContext'
import { useAuth } from '../context/AuthContext'

// ── Helpers ──────────────────────────────────────────────────

const PROVIDER_COLORS = {
  gemini: 'bg-blue-100 text-blue-700',
  claude: 'bg-purple-100 text-purple-700',
  openai: 'bg-green-100 text-green-700',
}

const STATUS_BADGE = {
  ok:              { cls: 'bg-green-100 text-green-700',  label: 'OK' },
  error:           { cls: 'bg-red-100 text-red-700',      label: 'Lỗi' },
  quota_exceeded:  { cls: 'bg-yellow-100 text-yellow-700', label: 'Hết quota' },
  null:            { cls: 'bg-gray-100 text-gray-500',    label: 'Chưa test' },
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

// ── Component chính ──────────────────────────────────────────

export default function ThietLapAPI() {
  const { congTrinhs } = useCongTrinh()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [providers, setProviders]     = useState([])
  const [configs, setConfigs]         = useState({})   // { ct_id: configObj }
  const [selectedCT, setSelectedCT]   = useState(null)
  const [loading, setLoading]         = useState(true)
  const [testing, setTesting]         = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [msg, setMsg]                 = useState(null)
  const [showForm, setShowForm]       = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showKey, setShowKey]         = useState(false)

  const [form, setForm] = useState({
    provider: 'gemini',
    api_key: '',
    model: '',
    max_tokens: 4096,
    system_prompt: '',
  })

  // ── Load providers + configs ────────────────────────────────
  const loadProviders = useCallback(async () => {
    try {
      const res = await api.get('/ai-config/providers')
      setProviders(res.data?.providers || [])
    } catch { setProviders([]) }
  }, [])

  const loadConfigs = useCallback(async () => {
    if (!congTrinhs.length) return
    setLoading(true)
    try {
      const res = await api.get('/ai-config/')
      const map = {}
      for (const cfg of (res.data?.data || [])) {
        map[cfg.cong_trinh_id] = cfg
      }
      setConfigs(map)
    } catch {
      setConfigs({})
    } finally {
      setLoading(false)
    }
  }, [congTrinhs])

  useEffect(() => { loadProviders() }, [loadProviders])
  useEffect(() => { loadConfigs() }, [loadConfigs])

  // Auto-select CT đầu tiên sau khi load
  useEffect(() => {
    if (!selectedCT && congTrinhs.length > 0) setSelectedCT(congTrinhs[0])
  }, [congTrinhs, selectedCT])

  // Khi đổi CT → reset form
  const handleSelectCT = (ct) => {
    setSelectedCT(ct)
    setShowForm(false)
    setShowDeleteConfirm(false)
    setMsg(null)
  }

  // ── Form helpers ────────────────────────────────────────────
  const currentCfg  = selectedCT ? configs[selectedCT.id] : null
  const currentProv = providers.find(p => p.name === form.provider)

  const openForm = () => {
    if (currentCfg) {
      setForm({
        provider:      currentCfg.provider || 'gemini',
        api_key:       '',
        model:         currentCfg.model || '',
        max_tokens:    currentCfg.max_tokens || 4096,
        system_prompt: currentCfg.system_prompt || '',
      })
    } else {
      setForm({ provider: 'gemini', api_key: '', model: '', max_tokens: 4096, system_prompt: '' })
    }
    setShowForm(true)
    setMsg(null)
    setShowKey(false)
  }

  // ── API actions ─────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault()
    if (!selectedCT) return
    if (!form.api_key && !currentCfg?.api_key_set) {
      setMsg({ type: 'err', text: 'Vui lòng nhập API Key.' }); return
    }
    setActionLoading(true); setMsg(null)
    try {
      await api.post(`/ai-config/${selectedCT.id}`, {
        provider:      form.provider,
        api_key:       form.api_key,
        model:         form.model || null,
        max_tokens:    form.max_tokens,
        system_prompt: form.system_prompt || null,
      })
      setMsg({ type: 'ok', text: 'Đã lưu cấu hình. Nhấn "Kiểm tra kết nối" để xác nhận key hợp lệ.' })
      setShowForm(false)
      await loadConfigs()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Lưu thất bại.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleTest = async () => {
    if (!selectedCT) return
    setTesting(true); setMsg(null)
    try {
      const res = await api.post(`/ai-config/${selectedCT.id}/test-connection`)
      const d = res.data
      if (d.status === 'ok') {
        setMsg({ type: 'ok', text: `✅ Kết nối thành công! Provider: ${d.provider}, Model: ${d.model}` })
      } else {
        setMsg({ type: 'err', text: `❌ ${d.message}` })
      }
      await loadConfigs()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Kiểm tra thất bại.' })
    } finally {
      setTesting(false)
    }
  }

  const handleDisable = async () => {
    if (!selectedCT) return
    setActionLoading(true); setMsg(null)
    try {
      const res = await api.post(`/ai-config/${selectedCT.id}/disable`)
      setMsg({ type: 'ok', text: res.data?.message || 'Đã tắt AI.' })
      await loadConfigs()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Thất bại.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEnable = async () => {
    if (!selectedCT) return
    setActionLoading(true); setMsg(null)
    try {
      const res = await api.post(`/ai-config/${selectedCT.id}/enable`)
      setMsg({ type: 'ok', text: res.data?.message || 'Đã bật lại AI.' })
      await loadConfigs()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Thất bại.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!selectedCT) return
    setActionLoading(true); setMsg(null)
    try {
      await api.delete(`/ai-config/${selectedCT.id}`)
      setMsg({ type: 'ok', text: 'Đã xóa API Key. Lịch sử test được giữ lại.' })
      setShowDeleteConfirm(false)
      await loadConfigs()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Xóa thất bại.' })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Non-admin ─────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Cpu className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">Chức năng dành riêng cho Admin.</p>
        <p className="text-sm mt-1">Liên hệ Admin để cấu hình API AI cho công trình của bạn.</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Cpu className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800">Thiết lập API AI</h1>
            <p className="text-xs text-gray-400">Quản lý cấu hình AI riêng cho từng công trình</p>
          </div>
        </div>
        <button
          onClick={loadConfigs}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: danh sách CT ───────────────────────────── */}
        <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Danh sách công trình ({congTrinhs.length})
            </span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
            </div>
          ) : congTrinhs.map((ct) => {
            const cfg = configs[ct.id]
            const active = cfg?.is_active
            const hasKey = cfg?.api_key_set
            const isSelected = selectedCT?.id === ct.id
            return (
              <button
                key={ct.id}
                onClick={() => handleSelectCT(ct)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors flex items-center gap-3 group
                  ${isSelected ? 'bg-indigo-50 border-l-[3px] border-l-indigo-500' : 'hover:bg-gray-50 border-l-[3px] border-l-transparent'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>
                      {ct.ten_ct}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400">{ct.ma_ct}</span>
                    {cfg && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                        ${PROVIDER_COLORS[cfg.provider] || 'bg-gray-100 text-gray-600'}`}>
                        {cfg.provider}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {!hasKey ? (
                    <AlertCircle className="w-4 h-4 text-gray-300" title="Chưa cấu hình" />
                  ) : active ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" title="Đang hoạt động" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" title="Đã tắt / chưa test" />
                  )}
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 ${isSelected ? 'text-indigo-400' : ''}`} />
              </button>
            )
          })}
        </div>

        {/* ── Right: detail panel ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedCT ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Building2 className="w-10 h-10 mb-2 text-gray-200" />
              <p>Chọn công trình để xem cấu hình</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">

              {/* CT header */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <h2 className="text-base font-bold text-gray-800">{selectedCT.ten_ct}</h2>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{selectedCT.ma_ct}</span>
                    </div>
                    {selectedCT.dia_chi && (
                      <p className="text-xs text-gray-400 ml-6">{selectedCT.dia_chi}</p>
                    )}
                  </div>
                  {/* Trạng thái tổng */}
                  {currentCfg?.api_key_set ? (
                    currentCfg.is_active
                      ? <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />AI Đang hoạt động
                        </span>
                      : <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />AI Đã tắt
                        </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                      <AlertCircle className="w-3 h-3" />Chưa cấu hình
                    </span>
                  )}
                </div>
              </div>

              {/* Thông báo */}
              {msg && (
                <div className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2
                  ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                     : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  <span>{msg.text}</span>
                </div>
              )}

              {/* Config hiện tại */}
              {currentCfg?.api_key_set ? (
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-400" />Cấu hình hiện tại
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">Provider</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                        ${PROVIDER_COLORS[currentCfg.provider] || 'bg-gray-100 text-gray-600'}`}>
                        {currentCfg.provider}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">Model</span>
                      <span className="text-gray-700">{currentCfg.model || <em className="text-gray-400">Mặc định</em>}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">API Key</span>
                      <span className="font-mono text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                        {currentCfg.api_key_masked || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">Max Tokens</span>
                      <span className="text-gray-700">{currentCfg.max_tokens}</span>
                    </div>
                  </div>

                  {/* Kết quả test gần nhất */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">Kiểm tra kết nối gần nhất</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${(STATUS_BADGE[currentCfg.last_test_status] || STATUS_BADGE.null).cls}`}>
                        {(STATUS_BADGE[currentCfg.last_test_status] || STATUS_BADGE.null).label}
                      </span>
                      <span className="text-xs text-gray-400">{fmtDate(currentCfg.last_test_at)}</span>
                    </div>
                    {currentCfg.last_error && (
                      <p className="text-xs text-red-500 mt-1.5 bg-red-50 px-2 py-1 rounded">
                        {currentCfg.last_error}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-3">
                  <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Công trình này chưa được cấu hình API AI</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Nhấn "Cập nhật cấu hình" để thêm API Key. Sau khi lưu, hãy nhấn "Kiểm tra kết nối" để xác nhận key hoạt động.
                    </p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={openForm}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  <Settings className="w-4 h-4" />
                  {currentCfg?.api_key_set ? 'Cập nhật cấu hình' : 'Thêm cấu hình'}
                </button>

                {currentCfg?.api_key_set && (
                  <>
                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:opacity-50"
                    >
                      <Play className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
                      {testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                    </button>

                    {currentCfg.is_active ? (
                      <button
                        onClick={handleDisable}
                        disabled={actionLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                      >
                        <ZapOff className="w-4 h-4" />Tắt tạm
                      </button>
                    ) : (
                      <button
                        onClick={handleEnable}
                        disabled={actionLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200 transition-colors font-medium disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4" />Bật lại
                      </button>
                    )}

                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors font-medium"
                    >
                      <Trash2 className="w-4 h-4" />Xóa API Key
                    </button>
                  </>
                )}
              </div>

              {/* Confirm xóa key */}
              {showDeleteConfirm && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-red-800 mb-1">Xác nhận xóa API Key?</p>
                  <p className="text-xs text-red-600 mb-3">
                    Key sẽ bị xóa vĩnh viễn khỏi hệ thống. Lịch sử kiểm tra kết nối vẫn được giữ lại.
                    Để dùng AI lại, cần thêm key mới.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteKey}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                    >
                      {actionLoading ? 'Đang xóa...' : 'Xác nhận xóa'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 bg-white text-gray-600 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 font-medium"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Form cập nhật cấu hình */}
              {showForm && (
                <div className="bg-white rounded-xl border border-indigo-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-500" />
                    {currentCfg?.api_key_set ? 'Cập nhật cấu hình API' : 'Thêm cấu hình API'}
                  </h3>
                  <form onSubmit={handleSave} className="space-y-4">

                    {/* Provider */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Provider *</label>
                      <select
                        value={form.provider}
                        onChange={e => setForm(f => ({ ...f, provider: e.target.value, model: '' }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                      >
                        {providers.map(p => (
                          <option key={p.name} value={p.name}>{p.label} — {p.description}</option>
                        ))}
                      </select>
                    </div>

                    {/* Model */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Model <span className="text-gray-400 font-normal">(để trống = dùng mặc định)</span>
                      </label>
                      <select
                        value={form.model}
                        onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                      >
                        <option value="">— Mặc định ({currentProv?.default_model}) —</option>
                        {(currentProv?.models || []).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        API Key {currentCfg?.api_key_set
                          ? <span className="text-gray-400 font-normal">(để trống = giữ key hiện tại)</span>
                          : <span className="text-red-500">*</span>}
                      </label>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={form.api_key}
                          onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                          placeholder={currentCfg?.api_key_masked
                            ? `Hiện tại: ${currentCfg.api_key_masked}`
                            : 'Nhập API Key...'}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Max tokens */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Max Tokens</label>
                      <input
                        type="number"
                        value={form.max_tokens}
                        onChange={e => setForm(f => ({ ...f, max_tokens: parseInt(e.target.value) || 4096 }))}
                        min={512} max={32768} step={512}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {actionLoading ? 'Đang lưu...' : 'Lưu cấu hình'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); setMsg(null) }}
                        className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors font-medium"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
