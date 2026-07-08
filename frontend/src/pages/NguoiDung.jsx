import React, { useState, useEffect } from 'react'
import { Users, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Eye, EyeOff, X, KeyRound } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function NguoiDung() {
  const { user: currentUser } = useAuth()
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState(null)  // { type: 'ok'|'err', text }
  const [showPw, setShowPw]   = useState(false)
  const [form, setForm] = useState({ email: '', ten: '', password: '', role: 'user' })
  // Reset password state
  const [resetTarget, setResetTarget] = useState(null)  // { id, ten, email }
  const [resetPw, setResetPw]         = useState('')
  const [showResetPw, setShowResetPw] = useState(false)
  const [resetSaving, setResetSaving] = useState(false)

  const loadUsers = () => {
    setLoading(true)
    api.get('/auth/users')
      .then(res => setUsers(res.data?.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.email || !form.ten || !form.password) {
      setMsg({ type: 'err', text: 'Vui lòng nhập đầy đủ thông tin' }); return
    }
    setSaving(true)
    setMsg(null)
    try {
      await api.post('/auth/create-user', form)
      setMsg({ type: 'ok', text: `Tạo tài khoản ${form.email} thành công!` })
      setForm({ email: '', ten: '', password: '', role: 'user' })
      setShowForm(false)
      loadUsers()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Lỗi tạo tài khoản' })
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetPw || resetPw.length < 6) {
      setMsg({ type: 'err', text: 'Mật khẩu phải từ 6 ký tự trở lên' }); return
    }
    setResetSaving(true)
    try {
      await api.put(`/auth/users/${resetTarget.id}/reset-password`, { new_password: resetPw })
      setMsg({ type: 'ok', text: `Đã reset mật khẩu cho ${resetTarget.email}` })
      setResetTarget(null)
      setResetPw('')
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Lỗi reset mật khẩu' })
    } finally {
      setResetSaving(false)
    }
  }

  const handleDelete = async (id, email) => {
    if (!window.confirm(`Xóa tài khoản ${email}?`)) return
    try {
      await api.delete(`/auth/users/${id}`)
      setMsg({ type: 'ok', text: `Đã xóa tài khoản ${email}` })
      loadUsers()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Lỗi xóa tài khoản' })
    }
  }

  const isAdmin = currentUser?.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">QUẢN LÝ NGƯỜI DÙNG</h1>
          <p className="text-gray-500 mt-1 text-sm">Tạo và quản lý tài khoản đăng nhập vào hệ thống</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadUsers} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
              <Plus className="w-4 h-4" />
              Tạo tài khoản
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${
          msg.type === 'ok'
            ? 'bg-green-50 border-green-100 text-green-700'
            : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {msg.type === 'ok' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 mb-1">Tổng tài khoản</div>
          <div className="text-2xl font-bold text-gray-800">{users.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 mb-1">Đang hoạt động</div>
          <div className="text-2xl font-bold text-green-600">{users.filter(u => u.active).length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 mb-1">Admin</div>
          <div className="text-2xl font-bold text-blue-600">{users.filter(u => u.role === 'admin').length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Tên</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Quyền</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Trạng thái</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Ngày tạo</th>
              {isAdmin && <th className="text-center px-4 py-3 text-gray-500 font-medium">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">Đang tải...</td></tr>
              : users.length === 0
                ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">Chưa có tài khoản nào</td></tr>
                : users.map((u, i) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{u.ten}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>{u.role === 'admin' ? 'Admin' : 'User'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>{u.active ? 'Hoạt động' : 'Khóa'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setResetTarget(u); setResetPw(''); setShowResetPw(false) }}
                              title="Reset mật khẩu"
                              className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-500 rounded-lg transition-colors">
                              <KeyRound className="w-4 h-4" />
                            </button>
                            {u.id !== currentUser?.uid && (
                              <button onClick={() => handleDelete(u.id, u.email)}
                                title="Xóa tài khoản"
                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>

      {/* Modal Reset mật khẩu */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setResetTarget(null) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Reset mật khẩu</h3>
                <p className="text-sm text-gray-400 mt-0.5">{resetTarget.ten} — {resetTarget.email}</p>
              </div>
              <button onClick={() => setResetTarget(null)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Mật khẩu mới *</label>
                <div className="relative">
                  <input
                    type={showResetPw ? 'text' : 'password'}
                    value={resetPw}
                    onChange={e => setResetPw(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <button type="button" onClick={() => setShowResetPw(!showResetPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setResetTarget(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  Hủy
                </button>
                <button onClick={handleResetPassword} disabled={resetSaving}
                  className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
                  {resetSaving ? 'Đang reset...' : 'Reset mật khẩu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal tao user */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 text-lg">Tạo tài khoản mới</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Ho ten *</label>
                <input value={form.ten} onChange={e => setForm({...form, ten: e.target.value})}
                  placeholder="Nguyen Van A"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  placeholder="email@hpcons.com.vn"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Mat khau *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Mat khau..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-blue-400" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Quyen</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400">
                  <option value="user">User - Xem du lieu</option>
                  <option value="admin">Admin - Quan tri he thong</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  Huy
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
                  {saving ? 'Dang tao...' : 'Tao tai khoan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
