import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * SSO với app tổng (account.hpcore.vn) — cùng quy ước với hpcons-quatang/
 * pkd_crm-next/ITAsset. KhoCtr không tự đăng nhập: chỉ xác minh cookie phiên
 * chung "session" (domain .hpcore.vn) bằng service account của project
 * hpcons-portal. App Admin SDK tên "hpcore" TÁCH RIÊNG khỏi app mặc định
 * của chính app này (Firestore nghiệp vụ kho, xem lib/firebase/admin.ts).
 * Port từ api/hpcore_auth.py — giữ đúng HPCORE_APP_ID = "warehouse".
 */

const APP_NAME = "hpcore";
export const SSO_COOKIE_NAME = "session";
export const HPCORE_APP_ID = "warehouse";
const HPCORE_LOGIN_URL = "https://account.hpcore.vn/login";

function loadCred(): object {
  const raw = process.env.HPCORE_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "Thiếu HPCORE_FIREBASE_SERVICE_ACCOUNT (service account project hpcons-portal).",
    );
  }
  return JSON.parse(raw);
}

function getHpcoreApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  return initializeApp(
    { credential: cert(loadCred() as Parameters<typeof cert>[0]) },
    APP_NAME,
  );
}

const g = globalThis as unknown as { __hpcoreAuth?: Auth; __hpcoreDb?: Firestore };

export function getHpcoreAuth(): Auth {
  return (g.__hpcoreAuth ??= getAuth(getHpcoreApp()));
}

/** Firestore của app tổng — đọc app_permissions/{uid}.warehouse + users/{uid} (avatar/tên) */
export function getHpcoreDb(): Firestore {
  return (g.__hpcoreDb ??= getFirestore(getHpcoreApp()));
}

/** URL đăng nhập app tổng kèm đường quay lại (chỉ *.hpcore.vn) */
export function hpcoreLoginUrl(returnTo: string): string {
  return `${HPCORE_LOGIN_URL}?next=${encodeURIComponent(returnTo)}`;
}

export interface HpcoreIdentity {
  uid: string;
  email: string;
}

/** Xác minh cookie phiên app tổng → { uid, email } hoặc null */
export async function verifyHpcore(
  cookie: string | undefined,
): Promise<HpcoreIdentity | null> {
  if (!cookie) return null;
  try {
    const decoded = await getHpcoreAuth().verifySessionCookie(cookie, true);
    const email = (decoded.email ?? "").trim().toLowerCase();
    if (!email) return null;
    return { uid: decoded.uid, email };
  } catch {
    return null;
  }
}

/** Vai trò của user cho app này, đọc từ app_permissions/{uid}.warehouse (giống api/hpcore_auth.py::get_app_role) */
export async function getAppRole(uid: string): Promise<string | null> {
  const snap = await getHpcoreDb().collection("app_permissions").doc(uid).get();
  const role = snap.data()?.[HPCORE_APP_ID];
  return typeof role === "string" ? role : null;
}
