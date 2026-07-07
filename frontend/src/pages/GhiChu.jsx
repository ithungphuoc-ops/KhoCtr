import React, { useState } from 'react'
import { StickyNote, Plus, X } from 'lucide-react'

const NOTE_COLORS = [
  { key: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-200', btn: 'bg-yellow-400' },
  { key: 'blue',   bg: 'bg-blue-50',   border: 'border-blue-200',   btn: 'bg-blue-400'   },
  { key: 'green',  bg: 'bg-green-50',  border: 'border-green-200',  btn: 'bg-green-400'  },
  { key: 'pink',   bg: 'bg-pink-50',   border: 'border-pink-200',   btn: 'bg-pink-400'   },
]
const colorMap = Object.fromEntries(NOTE_COLORS.map(c => [c.key, c]))

export default function GhiChu() {
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('khounice_ghi_chu') || '[]') }
    catch { return [] }
  })
  const [draft, setDraft]               = useState('')
  const [color, setColor]               = useState('yellow')
  const [deadline, setDeadline]         = useState('')
  const [editId, setEditId]             = useState(null)
  const [editText, setEditText]         = useState('')
  const [editDeadline, setEditDeadline] = useState('')

  const save = (next) => {
    setNotes(next)
    localStorage.setItem('khounice_ghi_chu', JSON.stringify(next))
  }

  const todayMidnight = () => { const d = new Date(); d.setHours(0,0,0,0); return d }
  const in3Days = () => { const d = todayMidnight(); d.setDate(d.getDate() + 3); return d }

  const dlStatus = (dl) => {
    if (!dl) return null
    const d = new Date(dl); d.setHours(0,0,0,0)
    if (d < todayMidnight())  return 'overdue'
    if (d <= in3Days())       return 'soon'
    return 'ok'
  }

  const fmtDeadline = (dl) => {
    if (!dl) return null
    return new Date(dl).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const overdueCount = notes.filter(n => dlStatus(n.deadline) === 'overdue').length
  const soonCount    = notes.filter(n => dlStatus(n.deadline) === 'soon').length

  const dlBorderMap = { overdue: 'border-red-400', soon: 'border-amber-400', ok: 'border-transparent' }
  const dlBadgeMap  = { overdue: 'bg-red-100 text-red-700', soon: 'bg-amber-100 text-amber-700', ok: 'bg-green-100 text-green-700' }
  const dlLabelMap  = { overdue: '⚠ Quá hạn', soon: '⏰ Sắp đến', ok: '✓' }

  const addNote = () => {
    if (!draft.trim()) return
    save([{ id: Date.now(), noi_dung: draft.trim(), mau: color, deadline: deadline || null, created_at: new Date().toLocaleString('vi-VN') }, ...notes])
    setDraft('')
    setDeadline('')
  }

  const deleteNote = (id) => save(notes.filter(n => n.id !== id))

  const startEdit = (n) => { setEditId(n.id); setEditText(n.noi_dung); setEditDeadline(n.deadline || '') }
  const saveEdit  = (id) => {
    save(notes.map(n => n.id === id ? { ...n, noi_dung: editText, deadline: editDeadline || null } : n))
    setEditId(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">GHI CHÚ CÔNG VIỆC</h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-gray-500 text-sm">Ghi chú, nhắc việc và theo dõi deadline</p>
          {overdueCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
              {overdueCount} quá hạn!
            </span>
          )}
          {soonCount > 0 && overdueCount === 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              {soonCount} sắp đến hạn
            </span>
          )}
        </div>
      </div>

      {/* Form thêm ghi chú */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-500" />
          Thêm ghi chú mới
        </h3>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addNote() }}
              placeholder="Nhập nội dung ghi chú... (Ctrl+Enter để lưu)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-300 resize-none"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 whitespace-nowrap">Deadline:</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="flex-1 max-w-[200px] border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:border-blue-300" />
              {deadline && (
                <button onClick={() => setDeadline('')} className="text-gray-300 hover:text-gray-500">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5">
              {NOTE_COLORS.map(c => (
                <button key={c.key} onClick={() => setColor(c.key)}
                  className={`w-6 h-6 rounded-full ${c.btn} transition-transform ${color === c.key ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`} />
              ))}
            </div>
            <button onClick={addNote} disabled={!draft.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
              <Plus className="w-4 h-4" /> Thêm
            </button>
          </div>
        </div>
      </div>

      {/* Danh sách ghi chú */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" />
            Danh sách ghi chú
          </h3>
          <span className="text-xs text-gray-400">{notes.length} ghi chú</span>
        </div>

        {notes.length === 0
          ? <div className="text-center text-gray-300 py-12 text-sm">Chưa có ghi chú nào</div>
          : <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {notes.map(n => {
                const c   = colorMap[n.mau] || colorMap.yellow
                const dls = dlStatus(n.deadline)
                const borderExtra = dls ? dlBorderMap[dls] : c.border
                return (
                  <div key={n.id} className={`rounded-xl border-2 p-4 text-sm ${c.bg} ${borderExtra} relative group`}>
                    {editId === n.id
                      ? <div className="space-y-2">
                          <textarea value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={4}
                            className="w-full bg-transparent border-none outline-none text-gray-800 text-sm resize-none" />
                          <div className="flex items-center gap-2 mb-1">
                            <label className="text-xs text-gray-400">Deadline:</label>
                            <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                              className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs" />
                            {editDeadline && <button onClick={() => setEditDeadline('')} className="text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">Hủy</button>
                            <button onClick={() => saveEdit(n.id)} className="text-xs text-blue-600 font-medium hover:text-blue-800">Lưu</button>
                          </div>
                        </div>
                      : <>
                          <p className="text-gray-800 whitespace-pre-wrap cursor-pointer leading-relaxed" onClick={() => startEdit(n)}>{n.noi_dung}</p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <p className="text-xs text-gray-400">{n.created_at}</p>
                            {n.deadline && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${dlBadgeMap[dls] || 'bg-gray-100 text-gray-500'}`}>
                                {dlLabelMap[dls]} {fmtDeadline(n.deadline)}
                              </span>
                            )}
                          </div>
                          <button onClick={() => deleteNote(n.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white rounded-full text-gray-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </>
                    }
                  </div>
                )
              })}
            </div>
        }
      </div>
    </div>
  )
}
