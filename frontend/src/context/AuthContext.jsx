import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api'

const AuthContext = createContext(null)

const TOKEN_KEY  = 'hpcons_token'
const USER_KEY   = 'hpcons_user'
const REMEMBER_KEY = 'hpcons_remember'

// Helper: doc token tu localStorage hoac sessionStorage
function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null
}
function getStoredUser() {
  try {
    const s = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(() => getStoredUser())
  const [token, setToken]   = useState(() => getStoredToken())
  const [loading, setLoading] = useState(true)

  // Gan Bearer token vao moi request
  useEffect(() => {
    const id = api.interceptors.request.use(cfg => {
      const t = getStoredToken()
      if (t) cfg.headers = { ...cfg.headers, Authorization: `Bearer ${t}` }
      return cfg
    })
    return () => api.interceptors.request.eject(id)
  }, [])

  // Verify token khi khoi dong
  useEffect(() => {
    const t = getStoredToken()
    if (!t) { setLoading(false); return }
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY)
        sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY)
        setToken(null); setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password, rememberMe = false) => {
    const res = await api.post('/auth/login', { email, password })
    const { access_token, user: u } = res.data
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, '1')
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem(TOKEN_KEY, access_token)
    storage.setItem(USER_KEY, JSON.stringify(u))
    setToken(access_token)
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY)
    localStorage.removeItem(REMEMBER_KEY)
    sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY)
    setToken(null); setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
