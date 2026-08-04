"use client";

// Port từ frontend/src/pages/PhanQuyen.jsx.
import { useState, useEffect } from "react";
import { Shield, RefreshCw, CheckCircle, XCircle, Save, X, Trash2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api-client";
import { useCongTrinh } from "@/components/CongTrinhProvider";
import { useAuth } from "@/components/SessionProvider";
import { CardListItem } from "@/components/ui/CardListItem";
import type { AppUser } from "@/lib/data/permissions";

function errDetail(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: string } } };
  return e.response?.data?.detail || fallback;
}

export default function PhanQuyenPage() {
  const { user: currentUser } = useAuth();
  const { congTrinhs } = useCongTrinh();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [perms, setPerms] = useState<Record<number, Set<number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const isAdmin = currentUser?.role === "admin";

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, permsRes] = await Promise.all([api.get<{ users?: AppUser[] }>("/auth/users"), api.get<{ permissions?: { user_id: number; cong_trinh_id: number }[] }>("/auth/permissions")]);
      const userList = usersRes.data?.users || [];
      setUsers(userList);

      const permList = permsRes.data?.permissions || [];
      const map: Record<number, Set<number>> = {};
      userList.forEach((u) => {
        map[u.id] = new Set();
      });
      permList.forEach((p) => {
        if (map[p.user_id]) map[p.user_id].add(p.cong_trinh_id);
      });
      setPerms(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const togglePerm = (userId: number, ctId: number) => {
    if (!isAdmin) return;
    setPerms((prev) => {
      const next = { ...prev, [userId]: new Set(prev[userId] || []) };
      if (next[userId].has(ctId)) next[userId].delete(ctId);
      else next[userId].add(ctId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const permList: { user_id: number; cong_trinh_id: number }[] = [];
      Object.entries(perms).forEach(([userId, ctSet]) => {
        ctSet.forEach((ctId) => permList.push({ user_id: parseInt(userId), cong_trinh_id: ctId }));
      });
      await api.post("/auth/permissions", { permissions: permList });
      setMsg({ type: "ok", text: "Lưu phân quyền thành công!" });
    } catch (err) {
      setMsg({ type: "err", text: errDetail(err, "Lỗi lưu phân quyền") });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    setDeletingUser(true);
    setMsg(null);
    try {
      await api.delete(`/auth/users/${confirmDeleteUser.id}`);
      setConfirmDeleteUser(null);
      setMsg({ type: "ok", text: `Đã xóa "${confirmDeleteUser.ten}" khỏi danh sách.` });
      await loadData();
    } catch (err) {
      setMsg({ type: "err", text: errDetail(err, "Xóa tài khoản thất bại.") });
    } finally {
      setDeletingUser(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">PHÂN QUYỀN</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">Quản lý quyền truy cập của từng tài khoản</p>
        </div>
        <div className="bg-hp-card rounded-hp-md border border-hp-border p-16 text-center">
          <Shield className="w-16 h-16 text-hp-text-disabled mx-auto mb-4" />
          <div className="text-hp-text-secondary font-medium">Chỉ admin mới truy cập được trang này</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">PHÂN QUYỀN CÔNG TRÌNH</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">Chọn công trình mà từng người dùng được truy cập</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} disabled={loading} className="min-h-10 p-2 border border-hp-border text-hp-text-secondary rounded-hp-md hover:bg-hp-elevated transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={handleSave} disabled={saving || loading} className="flex items-center gap-2 min-h-10 px-4 py-2 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? "Đang lưu..." : "Lưu phân quyền"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-3 p-4 rounded-hp-md border text-sm ${msg.type === "ok" ? "bg-hp-success/15 border-hp-success/30 text-hp-success" : "bg-hp-danger/15 border-hp-danger/30 text-hp-danger"}`}>
          {msg.type === "ok" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-hp-accent/15 rounded-hp-md p-4 border border-hp-accent/30 text-sm text-hp-accent">
        <strong>Cách dùng:</strong> Tick ô tích tương ứng giữa Người dùng và Công trình để cấp quyền xem. Admin luôn có quyền xem tất cả. Nhấn &quot;Lưu phân quyền&quot; để lưu thay đổi.
      </div>

      {loading ? (
        <div className="bg-hp-card rounded-hp-md border border-hp-border p-16 text-center text-hp-text-muted">Đang tải...</div>
      ) : users.length === 0 ? (
        <div className="bg-hp-card rounded-hp-md border border-hp-border p-16 text-center text-hp-text-muted">Chưa có tài khoản nào. Tạo tài khoản trước trong trang Người dùng.</div>
      ) : (
        <div className="hidden md:block bg-hp-card rounded-hp-md border border-hp-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-hp-surface border-b border-hp-border">
              <tr>
                <th className="text-left px-4 py-3 text-hp-text-secondary font-medium w-48">Người dùng</th>
                {congTrinhs.map((ct) => (
                  <th key={ct.id} className="text-center px-3 py-3 text-hp-text-secondary font-medium text-xs max-w-[120px]">
                    <div className="truncate" title={ct.ten_ct}>
                      {ct.ten_ct}
                    </div>
                  </th>
                ))}
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hp-border">
              {users.map((u) => {
                const userPerms = perms[u.id] || new Set<number>();
                const isCurrentAdmin = u.role === "admin";
                const isSelf = u.email === currentUser?.email;

                return (
                  <tr key={u.id} className="hover:bg-hp-elevated">
                    <td className="px-4 py-3">
                      <div className="font-medium text-hp-text text-sm">{u.ten}</div>
                      <div className="text-xs text-hp-text-muted">{u.email}</div>
                      {isCurrentAdmin && <span className="text-xs bg-hp-primary/15 text-hp-primary px-1.5 py-0.5 rounded font-semibold">ADMIN</span>}
                    </td>
                    {congTrinhs.map((ct) => (
                      <td key={ct.id} className="text-center px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isCurrentAdmin || userPerms.has(ct.id)}
                          disabled={isCurrentAdmin}
                          onChange={() => togglePerm(u.id, ct.id)}
                          className="w-4 h-4 accent-hp-primary cursor-pointer disabled:cursor-default"
                        />
                      </td>
                    ))}
                    <td className="text-center px-3 py-3">
                      {!isSelf && (
                        <button
                          onClick={() => setConfirmDeleteUser(u)}
                          title="Xóa khỏi danh sách"
                          className="p-1.5 text-hp-text-muted hover:text-hp-danger hover:bg-hp-danger/10 rounded-hp-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="md:hidden space-y-3">
          {users.map((u) => {
            const userPerms = perms[u.id] || new Set<number>();
            const isCurrentAdmin = u.role === "admin";
            const isSelf = u.email === currentUser?.email;
            return (
              <CardListItem key={u.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-hp-text text-sm flex items-center gap-2">
                      {u.ten}
                      {isCurrentAdmin && <span className="text-xs bg-hp-primary/15 text-hp-primary px-1.5 py-0.5 rounded font-semibold">ADMIN</span>}
                    </div>
                    <div className="text-xs text-hp-text-muted">{u.email}</div>
                  </div>
                  {!isSelf && (
                    <button
                      onClick={() => setConfirmDeleteUser(u)}
                      title="Xóa khỏi danh sách"
                      className="min-w-11 min-h-11 flex items-center justify-center flex-shrink-0 text-hp-text-muted hover:text-hp-danger hover:bg-hp-danger/10 rounded-hp-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="pt-1 border-t border-hp-divider space-y-1">
                  {congTrinhs.map((ct) => (
                    <label key={ct.id} className="flex items-center justify-between gap-3 min-h-11 text-sm cursor-pointer">
                      <span className="text-hp-text-secondary truncate">{ct.ten_ct}</span>
                      <input
                        type="checkbox"
                        checked={isCurrentAdmin || userPerms.has(ct.id)}
                        disabled={isCurrentAdmin}
                        onChange={() => togglePerm(u.id, ct.id)}
                        className="w-5 h-5 accent-hp-primary cursor-pointer disabled:cursor-default flex-shrink-0"
                      />
                    </label>
                  ))}
                </div>
              </CardListItem>
            );
          })}
        </div>
      )}

      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-hp-elevated border border-hp-border rounded-hp-lg shadow-md w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-hp-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-hp-text">Xóa &quot;{confirmDeleteUser.ten}&quot; khỏi danh sách?</h3>
                <p className="text-sm text-hp-text-secondary mt-1">
                  Chỉ xóa khỏi danh sách Phân quyền của KhoCtr, không ảnh hưởng tài khoản đăng nhập ở HPCore. Nếu người này vẫn còn quyền dùng app Kho và đăng nhập lại, họ sẽ tự xuất hiện lại (mất hết công trình đã cấp trước đó, cần cấp lại).
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteUser(null)} disabled={deletingUser} className="px-4 py-2 min-h-10 text-sm text-hp-text-secondary hover:bg-hp-muted/20 rounded-hp-md">
                Hủy
              </button>
              <button onClick={handleDeleteUser} disabled={deletingUser} className="px-4 py-2 min-h-10 text-sm font-medium text-white bg-hp-danger hover:bg-hp-danger/90 rounded-hp-md disabled:opacity-50">
                {deletingUser ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
