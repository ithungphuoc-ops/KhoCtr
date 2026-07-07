/**
 * useGhiChu.js — Custom hook quản lý state + API cho Module Ghi chú
 * Dùng chung cho App Tổng (không có ctId) và App Công trình (có ctId cụ thể).
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'

export function useGhiChu({ congTrinhId = null } = {}) {
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [filters, setFilters]     = useState({
    trang_thai:   '',
    uu_tien:      '',
    search:       '',
    deadline_from: '',
    deadline_to:  '',
  })

  const buildParams = useCallback((extra = {}) => {
    const p = new URLSearchParams()
    if (congTrinhId)           p.set('cong_trinh_id', congTrinhId)
    if (filters.trang_thai)    p.set('trang_thai',    filters.trang_thai)
    if (filters.uu_tien)       p.set('uu_tien',       filters.uu_tien)
    if (filters.search)        p.set('search',        filters.search)
    if (filters.deadline_from) p.set('deadline_from', filters.deadline_from)
    if (filters.deadline_to)   p.set('deadline_to',   filters.deadline_to)
    Object.entries(extra).forEach(([k, v]) => p.set(k, v))
    p.set('limit', '200')
    return p.toString()
  }, [congTrinhId, filters])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/api/ghi-chu/?${buildParams()}`)
      setItems(res.data?.data || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Không tải được ghi chú.')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { load() }, [load])

  // ── CRUD ──────────────────────────────────────────────────

  const createItem = async (payload) => {
    const res = await api.post('/api/ghi-chu/', {
      ...payload,
      cong_trinh_id: congTrinhId || payload.cong_trinh_id,
    })
    await load()
    return res.data?.data
  }

  const updateItem = async (id, payload) => {
    await api.put(`/api/ghi-chu/${id}`, payload)
    setItems(prev => prev.map(x => x.id === id ? { ...x, ...payload } : x))
    await load()
  }

  const deleteItem = async (id) => {
    await api.delete(`/api/ghi-chu/${id}`)
    setItems(prev => prev.filter(x => x.id !== id))
  }

  const completeItem = async (id) => {
    const res = await api.post(`/api/ghi-chu/${id}/complete`)
    setItems(prev => prev.map(x => x.id === id ? res.data?.data || x : x))
    return res.data?.data
  }

  return {
    items, loading, error,
    filters, setFilters,
    load,
    createItem, updateItem, deleteItem, completeItem,
  }
}
