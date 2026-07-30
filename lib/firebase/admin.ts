import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * App Admin SDK MẶC ĐỊNH của KhoCtr (Firestore nghiệp vụ kho: cong_trinh,
 * phieu, chi_tiet_phieu, hang_hoa, ...) — TÁCH RIÊNG khỏi app "hpcore" dùng
 * để xác minh SSO (xem lib/hpcore.ts), project Firebase khác nhau
 * (`hpcons-khoctr` chứ không phải `hpcons-portal`). Khởi tạo lười (proxy)
 * để `next build` không crash khi chưa có credential thật trong .env.local.
 */

let app: App | undefined;

function getAdminApp(): App {
  if (app) return app;
  const existing = getApps().find((a) => a.name === "[DEFAULT]");
  if (existing) {
    app = existing;
    return app;
  }

  const raw = process.env.KHOCTR_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("Thiếu KHOCTR_FIREBASE_SERVICE_ACCOUNT trong environment");
  }
  app = initializeApp({ credential: cert(JSON.parse(raw)) });
  return app;
}

function lazyProxy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const real = resolve();
      const value = Reflect.get(real as object, prop);
      return typeof value === "function" ? value.bind(real) : value;
    },
  });
}

let firestoreInstance: Firestore | undefined;

function getAdminFirestore(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getAdminApp());
    try {
      firestoreInstance.settings({ ignoreUndefinedProperties: true });
    } catch (err) {
      // Next.js dev-mode hot-reload nạp lại module này trong khi app "[DEFAULT]"
      // của SDK vẫn còn sống từ trước — getFirestore() trả về ĐÚNG instance cũ
      // đã settings() rồi, gọi lại chỉ ném lỗi vô hại, bỏ qua để không crash request.
      if (!(err instanceof Error) || !err.message.includes("already been initialized")) {
        throw err;
      }
    }
  }
  return firestoreInstance;
}

export const adminDb: Firestore = lazyProxy(getAdminFirestore);
