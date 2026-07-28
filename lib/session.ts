import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SSO_COOKIE_NAME, getAppRole, getHpcoreDb, hpcoreLoginUrl, verifyHpcore } from "@/lib/hpcore";
import { select, insert, update } from "@/lib/firestore/client";

/**
 * Port TypeScript của api/routers/auth.py::get_current_user — giữ ĐÚNG shape
 * cũ (uid = id nội bộ trong app_users, không phải Firebase uid) để
 * user_congtrinh/permissions không phải đổi gì (xem design.md Decisions).
 */
export interface Session {
  uid: number;
  email: string;
  ten: string;
  role: "admin" | "user";
  avatar: string | null;
}

/** Đọc avatar hiện tại của user từ users/{uid}.avatarUrl trên Firestore hpcons-portal (app tổng). */
async function fetchAvatarUrl(hpcoreUid: string): Promise<string | null> {
  try {
    const snap = await getHpcoreDb().collection("users").doc(hpcoreUid).get();
    const avatar = snap.data()?.avatarUrl;
    return typeof avatar === "string" && avatar ? avatar : null;
  } catch {
    return null;
  }
}

/**
 * Verify cookie session hpcore + lấy vai trò từ app_permissions + đồng bộ
 * app_users nội bộ — port nguyên logic get_current_user() (auth.py dòng 28-70).
 */
async function fetchCurrentUser(hpcoreUid: string, email: string): Promise<Session | null> {
  const role = await getAppRole(hpcoreUid);
  if (!role || (role !== "admin" && role !== "user")) return null; // có đăng nhập hpcore nhưng chưa cấp quyền app này

  const avatarUrl = await fetchAvatarUrl(hpcoreUid);
  const existing = await select("app_users", { filters: `email=eq.${encodeURIComponent(email)}` });
  const ten = email.split("@")[0];

  if (existing.length > 0) {
    let user = existing[0];
    const avatar = avatarUrl ?? (user.avatar as string | null | undefined) ?? null;
    if (user.role !== role || !user.active || user.avatar !== avatar) {
      const rows = await update(
        "app_users",
        { role, active: true, avatar },
        `email=eq.${encodeURIComponent(email)}`,
      );
      user = rows[0] ?? user;
    }
    return {
      uid: Number(user.id),
      email,
      ten: (user.ten as string) ?? ten,
      role: role as "admin" | "user",
      avatar: (user.avatar as string | null) ?? avatar,
    };
  }

  // password_hash không còn dùng (đăng nhập qua SSO hpcore) nhưng cột DB đang NOT NULL
  // trên bản Postgres gốc — giữ giá trị cố định để tương thích, không phải mật khẩu thật.
  const rows = await insert("app_users", {
    email,
    ten,
    role,
    active: true,
    avatar: avatarUrl,
    password_hash: "SSO_HPCORE_NO_PASSWORD",
  });
  const user = rows[0];
  return {
    uid: Number(user?.id),
    email,
    ten: (user?.ten as string) ?? ten,
    role: role as "admin" | "user",
    avatar: (user?.avatar as string | null) ?? avatarUrl,
  };
}

export type SessionResult =
  | { status: "ok"; session: Session }
  | { status: "unauthenticated" } // chưa đăng nhập hpcore (401 ở bản Python — frontend redirect)
  | { status: "denied" }; // đã đăng nhập hpcore nhưng chưa được cấp quyền app này (403 — KHÔNG redirect)

/**
 * Phân biệt rõ 2 trường hợp không có phiên — khớp đúng App.jsx::PrivateRoute
 * (401 → redirect sang hpcore login; 403 → hiện thông báo "chưa được cấp quyền",
 * KHÔNG redirect, tránh vòng lặp redirect vô hạn cho user đã đăng nhập hpcore
 * nhưng chưa được admin cấp quyền app "warehouse").
 */
export async function resolveSession(): Promise<SessionResult> {
  const jar = await cookies();
  const identity = await verifyHpcore(jar.get(SSO_COOKIE_NAME)?.value);
  if (!identity) return { status: "unauthenticated" };
  const session = await fetchCurrentUser(identity.uid, identity.email);
  if (!session) return { status: "denied" };
  return { status: "ok", session };
}

/** Phiên hiện tại, hoặc null nếu chưa đăng nhập hpcore / chưa được cấp quyền app này. */
export async function getSession(): Promise<Session | null> {
  const result = await resolveSession();
  return result.status === "ok" ? result.session : null;
}

export class AuthError extends Error {}
export class ForbiddenError extends Error {}

/** Dùng trong Route Handler: ném lỗi thay vì chuyển hướng, route tự map ra HTTP status. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError("Chưa đăng nhập hoặc chưa được cấp quyền.");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "admin") throw new ForbiddenError("Chỉ admin mới thực hiện được thao tác này.");
  return session;
}

/**
 * Dùng trong Server Component (trang) khi KHÔNG cần phân biệt denied/unauthenticated
 * — cả 2 trường hợp đều redirect về hpcore login. Nơi cần hiện thông báo "chưa được
 * cấp quyền" riêng (không redirect, tránh vòng lặp) phải gọi resolveSession() trực
 * tiếp thay vì hàm này — xem app/(app)/layout.tsx.
 */
export async function requireSessionForPage(returnPath: string): Promise<Session> {
  const session = await getSession();
  if (session) return session;
  redirect(hpcoreLoginUrl(`https://khoct.hpcore.vn${returnPath}`));
}
