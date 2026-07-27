"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "@/lib/session";

const SessionContext = createContext<Session | null>(null);

/**
 * Port thay thế frontend/src/context/AuthContext.jsx — khác bản Vite: session đã xác
 * thực SẴN ở server (Server Component AppLayout gọi resolveSession) rồi truyền xuống
 * làm giá trị context tĩnh, không cần fetch /api/auth/me + loading state ở client nữa.
 */
export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/** Port thay thế useAuth() — trả về { user } để khớp cách gọi cũ (const { user } = useAuth()). */
export function useAuth(): { user: Session } {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useAuth must be inside SessionProvider");
  return { user: session };
}
