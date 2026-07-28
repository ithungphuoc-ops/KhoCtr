"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { CongTrinh } from "@/lib/data/cong-trinh";
import { getMyCongTrinh as fetchMyCongTrinh } from "@/lib/api-client";

interface CongTrinhContextValue {
  congTrinhs: CongTrinh[];
  selectedCT: CongTrinh | null;
  setSelectedCT: (ct: CongTrinh | null) => void;
  isAdmin: boolean;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (d: string) => void;
  setDateTo: (d: string) => void;
  loadCongTrinh: () => void;
}

const CongTrinhContext = createContext<CongTrinhContextValue | null>(null);

/**
 * Port từ frontend/src/context/CongTrinhContext.jsx. Khác bản Vite: congTrinhs/isAdmin
 * fetch SẴN ở server (Server Component AppLayout gọi getMyCongTrinh) rồi truyền xuống
 * làm initial props — không cần fetch client-side lúc mount. loadCongTrinh() vẫn giữ
 * lại (gọi /api/auth/my-congtrinh) để refresh sau khi trang Công trình tạo/xóa CT.
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
  const [congTrinhs, setCongTrinhs] = useState<CongTrinh[]>(initialCongTrinhs);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [selectedCT, setSelectedCT] = useState<CongTrinh | null>(
    !initialIsAdmin && initialCongTrinhs.length > 0 ? initialCongTrinhs[0] : null,
  );
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState("2025-01-01");
  const [dateTo, setDateTo] = useState(today);

  const loadCongTrinh = useCallback(() => {
    fetchMyCongTrinh()
      .then((res) => {
        const data = res.data as { congtrinhs?: CongTrinh[]; is_admin?: boolean };
        const list = data.congtrinhs || [];
        const admin = data.is_admin || false;
        setCongTrinhs(list);
        setIsAdmin(admin);
        if (list.length > 0 && !admin) setSelectedCT(list[0]);
      })
      .catch(() => {});
  }, []);

  return (
    <CongTrinhContext.Provider
      value={{ congTrinhs, selectedCT, setSelectedCT, isAdmin, dateFrom, dateTo, setDateFrom, setDateTo, loadCongTrinh }}
    >
      {children}
    </CongTrinhContext.Provider>
  );
}

export function useCongTrinh() {
  const ctx = useContext(CongTrinhContext);
  if (!ctx) {
    return {
      congTrinhs: [] as CongTrinh[],
      selectedCT: null as CongTrinh | null,
      setSelectedCT: () => {},
      isAdmin: false,
      dateFrom: "",
      dateTo: "",
      setDateFrom: () => {},
      setDateTo: () => {},
      loadCongTrinh: () => {},
    };
  }
  return ctx;
}
