"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { CongTrinh } from "@/lib/data/cong-trinh";

interface CongTrinhContextValue {
  congTrinhs: CongTrinh[];
  selectedCT: CongTrinh | null;
  setSelectedCT: (ct: CongTrinh | null) => void;
  isAdmin: boolean;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (d: string) => void;
  setDateTo: (d: string) => void;
}

const CongTrinhContext = createContext<CongTrinhContextValue | null>(null);

/**
 * Port từ frontend/src/context/CongTrinhContext.jsx. Khác bản Vite: congTrinhs/isAdmin
 * được fetch SẴN ở server (Server Component AppShell gọi getMyCongTrinh) rồi truyền
 * xuống làm initial props — không cần fetch client-side + loading state riêng nữa.
 */
export function CongTrinhProvider({
  initialCongTrinhs,
  initialIsAdmin,
  children,
}: {
  initialCongTrinhs: CongTrinh[];
  initialIsAdmin: boolean;
  children: ReactNode;
}) {
  const [selectedCT, setSelectedCT] = useState<CongTrinh | null>(
    !initialIsAdmin && initialCongTrinhs.length > 0 ? initialCongTrinhs[0] : null,
  );
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState("2025-01-01");
  const [dateTo, setDateTo] = useState(today);

  return (
    <CongTrinhContext.Provider
      value={{
        congTrinhs: initialCongTrinhs,
        selectedCT,
        setSelectedCT,
        isAdmin: initialIsAdmin,
        dateFrom,
        dateTo,
        setDateFrom,
        setDateTo,
      }}
    >
      {children}
    </CongTrinhContext.Provider>
  );
}

export function useCongTrinh() {
  const ctx = useContext(CongTrinhContext);
  if (!ctx) {
    return {
      congTrinhs: [],
      selectedCT: null,
      setSelectedCT: () => {},
      isAdmin: false,
      dateFrom: "",
      dateTo: "",
      setDateFrom: () => {},
      setDateTo: () => {},
    };
  }
  return ctx;
}
