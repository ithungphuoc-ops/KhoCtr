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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <img src="/logo-hpcons.png" alt="HP Cons" className="h-16 w-auto object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-800">HPCons AppTong</h1>
          <p className="text-gray-400 text-sm mt-1">Hệ thống quản lý kho v2.0</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-6">Đăng nhập</h2>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@hpcons.com.vn"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
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
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400 cursor-pointer"
                />
                <span className="text-sm text-gray-500">Ghi nhớ tài khoản</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm text-blue-500 hover:text-blue-700 transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><Loader className="w-4 h-4 animate-spin" /> Đang đăng nhập...</>
                : 'Đăng nhập'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">© 2026 HP Construction Việt Nam</p>
      </div>

      {showForgot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowForgot(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-gray-800">Quên mật khẩu</h3>
              </div>
              <button onClick={() => setShowForgot(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              Vui lòng liên hệ <strong className="text-gray-700">Quản trị viên</strong> để được reset mật khẩu.
            </p>
            <div className="bg-blue-50 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-700">nguyenhuuphuoc@hpcons.com.vn</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-700">HP Construction Việt Nam</span>
              </div>
            </div>
            <button onClick={() => setShowForgot(false)}
              className="w-full mt-4 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors">
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
