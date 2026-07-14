import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api'

const AuthContext = createContext(null)

const HPCORE_LOGIN_URL = 'https://account.hpcore.vn/login'

function redirectToHpcoreLogin() {
  const next = encodeURIComponent(window.location.href)
  window.location.href = `${HPCORE_LOGIN_URL}?next=${next}`
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied]   = useState(false) // dang nhap hpcore roi nhung chua duoc cap quyen app nay

  // Lay thong tin user hien tai qua cookie session hpcore (tu dong gui kem)
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(err => {
        setUser(null)
        if (err.response?.status === 403) setDenied(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    try { await api.post('/auth/logout') } catch { /* bo qua */ }
    setUser(null)
    window.location.href = HPCORE_LOGIN_URL
  }

  return (
    <AuthContext.Provider value={{ user, loading, denied, logout, redirectToHpcoreLogin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
