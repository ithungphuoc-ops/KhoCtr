import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, Eye, EyeOff, Loader, HelpCircle, X, Phone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [showForgot, setShowForgot] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Vui lòng nhập đầy đủ email và mật khẩu'); return }
    setLoading(true)
    setError('')
    try {
      await login(email, password, rememberMe)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-hp-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <img src="/logo-hpcons.png" alt="HP Cons" className="h-16 w-auto object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-hp-text">HPCons AppTong</h1>
          <p className="text-hp-text-muted text-sm mt-1">Hệ thống quản lý kho v2.0</p>
        </div>

        <div className="bg-hp-card rounded-hp-lg shadow-lg border border-hp-border p-8">
          <h2 className="text-lg font-bold text-hp-text mb-6">Đăng nhập</h2>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <div>
              <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@hpcons.com.vn"
                  autoComplete="email"
                  className="w-full min-h-10 pl-10 pr-4 py-2.5 bg-hp-surface text-hp-text placeholder:text-hp-text-muted border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full min-h-10 pl-10 pr-10 py-2.5 bg-hp-surface text-hp-text placeholder:text-hp-text-muted border border-hp-border rounded-hp-md text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-hp-text-muted hover:text-hp-text transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-hp-border accent-hp-primary focus:ring-hp-accent cursor-pointer"
                />
                <span className="text-sm text-hp-text-secondary">Ghi nhớ tài khoản</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm text-hp-accent hover:text-hp-accent/80 transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            {error && (
              <div className="text-sm text-hp-danger bg-hp-danger/15 rounded-hp-md px-4 py-2.5 border border-hp-danger/30">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-11 py-2.5 bg-hp-primary hover:bg-hp-primary/90 text-white rounded-hp-md font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><Loader className="w-4 h-4 animate-spin" /> Đang đăng nhập...</>
                : 'Đăng nhập'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-hp-text-muted mt-4">© 2026 HP Construction Việt Nam</p>
      </div>

      {showForgot && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowForgot(false) }}>
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-hp-accent" />
                <h3 className="font-bold text-hp-text">Quên mật khẩu</h3>
              </div>
              <button onClick={() => setShowForgot(false)}
                className="p-1 hover:bg-hp-card rounded-hp-sm text-hp-text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-hp-text-secondary mb-5 leading-relaxed">
              Vui lòng liên hệ <strong className="text-hp-text">Quản trị viên</strong> để được reset mật khẩu.
            </p>
            <div className="bg-hp-accent/15 rounded-hp-md p-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-hp-accent flex-shrink-0" />
                <span className="text-sm text-hp-text">nguyenhuuphuoc@hpcons.com.vn</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-hp-accent flex-shrink-0" />
                <span className="text-sm text-hp-text">HP Construction Việt Nam</span>
              </div>
            </div>
            <button onClick={() => setShowForgot(false)}
              className="w-full min-h-10 mt-4 py-2.5 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 transition-colors">
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
