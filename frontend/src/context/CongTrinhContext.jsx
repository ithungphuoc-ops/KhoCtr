import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api'

const CongTrinhContext = createContext(null)

export function CongTrinhProvider({ children }) {
  const [congTrinhs, setCongTrinhs]   = useState([])
  const [selectedCT, setSelectedCT]   = useState(null)
  const [isAdmin, setIsAdmin]         = useState(false)
  const [ctLoading, setCtLoading]     = useState(true)
  const today = new Date().toISOString().split('T')[0]
  const [dateFrom, setDateFrom]       = useState('2025-01-01')
  const [dateTo, setDateTo]           = useState(today)

  const loadCongTrinh = () => {
    setCtLoading(true)
    api.get('/auth/my-congtrinh')
      .then(res => {
        const list = res.data?.congtrinhs || []
        const admin = res.data?.is_admin || false
        setCongTrinhs(list)
        setIsAdmin(admin)
        // Non-admin: tự động chọn CT đầu tiên (họ chỉ có 1 CT)
        // Admin: default null = xem tất cả công trình
        if (list.length > 0 && !admin) {
          setSelectedCT(list[0])
        }
      })
      .catch(() => {})
      .finally(() => setCtLoading(false))
  }

  useEffect(() => { loadCongTrinh() }, [])

  return (
    <CongTrinhContext.Provider value={{ congTrinhs, selectedCT, setSelectedCT, isAdmin, ctLoading, loadCongTrinh, dateFrom, dateTo, setDateFrom, setDateTo }}>
      {children}
    </CongTrinhContext.Provider>
  )
}

export function useCongTrinh() {
  const ctx = useContext(CongTrinhContext)
  if (!ctx) return { congTrinhs: [], selectedCT: null, setSelectedCT: () => {}, isAdmin: false }
  return ctx
}
