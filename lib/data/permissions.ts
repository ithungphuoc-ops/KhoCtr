import "server-only";
import { select, insert, del } from "@/lib/firestore/client";

export interface UserCongTrinh {
  id: number;
  user_id: number;
  cong_trinh_id: number;
  [key: string]: unknown;
}

export interface AppUser {
  id: number;
  email: string;
  ten: string;
  role: string;
  active: boolean;
  created_at?: string;
  [key: string]: unknown;
}

/** Port từ api/routers/auth.py::get_permissions */
export async function getPermissions(): Promise<UserCongTrinh[]> {
  return (await select("user_congtrinh")) as UserCongTrinh[];
}

/** Port từ api/routers/auth.py::save_permissions — xóa cũ, insert mới. */
export async function savePermissions(permissions: { user_id: number; cong_trinh_id: number }[]): Promise<number> {
  await del("user_congtrinh", "id=gte.0");
  if (permissions.length > 0) await insert("user_congtrinh", permissions);
  return permissions.length;
}

/** Port từ api/routers/auth.py::list_users */
export async function listUsers(): Promise<AppUser[]> {
  return (await select("app_users", { query: "id,email,ten,role,active,created_at", order: "id.asc" })) as AppUser[];
}

/**
 * Xóa 1 tài khoản khỏi danh sách nội bộ của KhoCtr (collection app_users +
 * user_congtrinh liên quan) — KHÔNG đụng gì tới tài khoản đăng nhập thật ở
 * HPCore (account.hpcore.vn/hpcons-portal). Nếu người này vẫn còn quyền
 * "warehouse" và đăng nhập lại, họ sẽ tự tạo lại bản ghi (xem
 * lib/session.ts::fetchCurrentUser) và xuất hiện lại trong danh sách.
 */
export async function deleteUser(id: number): Promise<void> {
  await del("user_congtrinh", `user_id=eq.${id}`);
  await del("app_users", `id=eq.${id}`);
}
