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
          <h1 className="text-2xl font-bold text-hp-text">QUẢN LÝ NGƯỜI DÙNG</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">Tạo và quản lý tài khoản đăng nhập vào hệ thống</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadUsers} disabled={loading}
            className="flex items-center gap-2 min-h-10 px-3 py-2 border border-hp-border text-hp-text-secondary rounded-hp-md text-sm hover:bg-hp-elevated transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 min-h-10 px-4 py-2 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
              Tạo tài khoản
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`flex items-center gap-3 p-4 rounded-hp-md border text-sm ${
          msg.type === 'ok'
            ? 'bg-hp-primary/15 border-hp-primary/30 text-hp-primary'
            : 'bg-hp-danger/15 border-hp-danger/30 text-hp-danger'
        }`}>
          {msg.type === 'ok' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-hp-card rounded-hp-md border border-hp-border p-4">
          <div className="text-xs text-hp-text-muted mb-1">Tổng tài khoản</div>
          <div className="text-2xl font-bold text-hp-text">{users.length}</div>
        </div>
        <div className="bg-hp-card rounded-hp-md border border-hp-border p-4">
          <div className="text-xs text-hp-text-muted mb-1">Đang hoạt động</div>
          <div className="text-2xl font-bold text-hp-primary">{users.filter(u => u.active).length}</div>
        </div>
        <div className="bg-hp-card rounded-hp-md border border-hp-border p-4">
          <div className="text-xs text-hp-text-muted mb-1">Admin</div>
          <div className="text-2xl font-bold text-hp-accent">{users.filter(u => u.role === 'admin').length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-hp-card rounded-hp-md border border-hp-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-hp-surface border-b border-hp-border">
            <tr>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">#</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Tên</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Email</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Quyền</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Trạng thái</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Ngày tạo</th>
              {isAdmin && <th className="text-center px-4 py-3 text-hp-text-secondary font-medium">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-hp-border">
            {loading
              ? <tr><td colSpan={7} className="py-10 text-center text-hp-text-muted">Đang tải...</td></tr>
              : users.length === 0
                ? <tr><td colSpan={7} className="py-10 text-center text-hp-text-muted">Chưa có tài khoản nào</td></tr>
                : users.map((u, i) => (
                    <tr key={u.id} className="hover:bg-hp-elevated">
                      <td className="px-4 py-3 text-hp-text-muted text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-hp-text">{u.ten}</td>
                      <td className="px-4 py-3 text-hp-text-secondary text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.role === 'admin' ? 'bg-hp-primary/15 text-hp-primary' : 'bg-hp-muted/20 text-hp-text-secondary'
                        }`}>{u.role === 'admin' ? 'Admin' : 'User'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.active ? 'bg-hp-primary/15 text-hp-primary' : 'bg-hp-danger/15 text-hp-danger'
                        }`}>{u.active ? 'Hoạt động' : 'Khóa'}</span>
                      </td>
                      <td className="px-4 py-3 text-hp-text-muted text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setResetTarget(u); setResetPw(''); setShowResetPw(false) }}
                              title="Reset mật khẩu"
                              className="p-1.5 hover:bg-hp-accent/15 text-hp-text-muted hover:text-hp-accent rounded-hp-sm transition-colors">
                              <KeyRound className="w-4 h-4" />
                            </button>
                            {u.id !== currentUser?.uid && (
                              <button onClick={() => handleDelete(u.id, u.email)}
                                title="Xóa tài khoản"
                                className="p-1.5 hover:bg-hp-danger/15 text-hp-text-muted hover:text-hp-danger rounded-hp-sm transition-colors">
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
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setResetTarget(null) }}>
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-hp-text text-lg">Reset mật khẩu</h3>
                <p className="text-sm text-hp-text-muted mt-0.5">{resetTarget.ten} — {resetTarget.email}</p>
              </div>
              <button onClick={() => setResetTarget(null)} className="p-1 hover:bg-hp-card rounded-hp-sm text-hp-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Mật khẩu mới *</label>
                <div className="relative">
                  <input
                    type={showResetPw ? 'text' : 'password'}
                    value={resetPw}
                    onChange={e => setResetPw(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full min-h-10 bg-hp-surface text-hp-text placeholder:text-hp-text-muted border border-hp-border rounded-hp-md px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent"
                  />
                  <button type="button" onClick={() => setShowResetPw(!showResetPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-hp-text-muted">
                    {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setResetTarget(null)}
                  className="flex-1 min-h-10 py-2.5 border border-hp-border text-hp-text-secondary rounded-hp-md text-sm hover:bg-hp-card">
                  Hủy
                </button>
                <button onClick={handleResetPassword} disabled={resetSaving}
                  className="flex-1 min-h-10 py-2.5 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50">
                  {resetSaving ? 'Đang reset...' : 'Reset mật khẩu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal tao user */}
      {showForm && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-hp-text text-lg">Tạo tài khoản mới</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-hp-card rounded-hp-sm text-hp-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Ho ten *</label>
                <input value={form.ten} onChange={e => setForm({...form, ten: e.target.value})}
                  placeholder="Nguyen Van A"
                  className="w-full min-h-10 bg-hp-surface text-hp-text placeholder:text-hp-text-muted border border-hp-border rounded-hp-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  placeholder="email@hpcons.com.vn"
                  className="w-full min-h-10 bg-hp-surface text-hp-text placeholder:text-hp-text-muted border border-hp-border rounded-hp-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Mat khau *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Mat khau..."
                    className="w-full min-h-10 bg-hp-surface text-hp-text placeholder:text-hp-text-muted border border-hp-border rounded-hp-md px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-hp-text-muted">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-hp-text-secondary mb-1.5 block">Quyen</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full min-h-10 bg-hp-surface text-hp-text border border-hp-border rounded-hp-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-hp-accent">
                  <option value="user">User - Xem du lieu</option>
                  <option value="admin">Admin - Quan tri he thong</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 min-h-10 py-2.5 border border-hp-border text-hp-text-secondary rounded-hp-md text-sm hover:bg-hp-card">
                  Huy
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 min-h-10 py-2.5 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50">
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
