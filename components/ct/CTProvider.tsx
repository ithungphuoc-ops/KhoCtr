"use client";

// Thay thế cách dùng useOutletContext() của react-router trong bản Vite (CTLayout.jsx
// truyền { congTrinh, ctId } qua <Outlet context={...}>). Next.js App Router không có
// khái niệm outlet context, dùng React Context thường thay thế.
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getCongTrinh } from "@/lib/api-client";
import type { CongTrinh } from "@/lib/data/cong-trinh";

interface CTContextValue {
  congTrinh: CongTrinh | null;
  ctId: string;
}

const CTContext = createContext<CTContextValue | null>(null);

export function CTProvider({ ctId, children }: { ctId: string; children: ReactNode }) {
  const [congTrinh, setCongTrinh] = useState<CongTrinh | null>(null);

  useEffect(() => {
    getCongTrinh()
      .then((res) => {
        const list = (res.data as { data?: CongTrinh[] })?.data || [];
        const ct = list.find((c) => String(c.id) === String(ctId));
        setCongTrinh(ct || null);
      })
      .catch(() => {});
  }, [ctId]);

  return <CTContext.Provider value={{ congTrinh, ctId }}>{children}</CTContext.Provider>;
}

export function useCT() {
  const ctx = useContext(CTContext);
  if (!ctx) throw new Error("useCT must be inside CTProvider");
  return ctx;
}
