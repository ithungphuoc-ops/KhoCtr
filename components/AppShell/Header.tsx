"use client";

// Port đầy đủ từ frontend/src/components/Layout/Header.jsx — nối lại date-range
// picker + xuất Excel + số cảnh báo tồn thấp (GĐ1 chỉ port khung sườn, phần này
// phụ thuộc getPhieuList/getTonKho/exportExcel — đã port xong ở GĐ2/GĐ3).
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, HelpCircle, Calendar, Download, ChevronRight, Home, LogOut, Loader, Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useCongTrinh } from "@/components/CongTrinhProvider";
import { getPhieuList, getTonKho } from "@/lib/api-client";
import { exportBaoCaoTongHop, exportPhieuList } from "@/lib/export-excel";
import type { Phieu } from "@/lib/data/phieu";
import type { TonKhoRow } from "@/lib/data/ton-kho";
import type { Session } from "@/lib/session";

const routeNames: Record<string, string> = {
  "/": "Báo cáo tổng hợp",
  "/phieu-nhap": "Phiếu nhập kho",
  "/phieu-xuat": "Phiếu xuất kho",
  "/ton-kho": "Tồn kho",
  "/danh-muc": "Vật tư - Hàng hóa",
  "/bao-cao": "Báo cáo chi tiết",
  "/cong-trinh": "Danh sách công trình",
  "/nha-cung-cap": "Nhà cung cấp",
  "/ai-reader": "Nhập kho AI",
  "/cai-dat": "Cấu hình",
  "/canh-bao": "Cảnh báo tồn kho",
  "/phan-quyen": "Phân quyền",
  "/thung-rac": "Thùng rác",
};

const formatVN = (d: string) => {
  if (!d) return "?";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const PRESETS = [
  { label: "T10-12/2025", from: "2025-10-01", to: "2025-12-31" },
  { label: "Năm 2025", from: "2025-01-01", to: "2025-12-31" },
  { label: "Năm 2026", from: "2026-01-01", to: new Date().toISOString().split("T")[0] },
  { label: "Tất cả", from: "2025-01-01", to: new Date().toISOString().split("T")[0] },
];

export function Header({ session, onMenuClick }: { session: Session; onMenuClick: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { dateFrom, dateTo, setDateFrom, setDateTo, selectedCT, congTrinhs } = useCongTrinh();
  const [showMenu, setShowMenu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [tempFrom, setTempFrom] = useState(dateFrom);
  const [tempTo, setTempTo] = useState(dateTo);
  const [exporting, setExporting] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [seenCount, setSeenCount] = useState(0);

  useEffect(() => {
    setSeenCount(parseInt(localStorage.getItem("canh_bao_seen") || "0", 10));
  }, []);

  useEffect(() => {
    const params = selectedCT ? { cong_trinh_id: selectedCT.id } : {};
    getTonKho(params)
      .then((res) => {
        const rows = ((res.data as { data?: TonKhoRow[] })?.data || []) as TonKhoRow[];
        setAlertCount(rows.filter((r) => (r.ton_cuoi ?? 0) <= 20).length);
      })
      .catch(() => {});
  }, [selectedCT]);

  const unreadCount = alertCount > seenCount ? alertCount : 0;

  const handleBellClick = () => {
    setSeenCount(alertCount);
    localStorage.setItem("canh_bao_seen", String(alertCount));
    router.push("/canh-bao");
  };

  const pickerRef = useRef<HTMLDivElement>(null);
  const pageName = routeNames[pathname] || "Trang chủ";

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const openPicker = () => {
    setTempFrom(dateFrom);
    setTempTo(dateTo);
    setShowPicker((v) => !v);
  };

  const applyDate = () => {
    if (tempFrom) setDateFrom(tempFrom);
    if (tempTo) setDateTo(tempTo);
    setShowPicker(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "https://account.hpcore.vn/login";
  };

  const exportLabel = pathname === "/phieu-nhap" ? "Xuất NK" : pathname === "/phieu-xuat" ? "Xuất XK" : "Xuất báo cáo";

  const handleExport = async () => {
    setExporting(true);
    try {
      const ctId = selectedCT?.id;
      const params: Record<string, string | number> = { limit: 2000 };
      if (ctId) params.cong_trinh_id = ctId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      if (pathname === "/phieu-nhap") {
        const res = await getPhieuList({ ...params, loai: "NK" });
        await exportPhieuList({
          phieuList: ((res.data as { data?: Phieu[] })?.data || []) as Phieu[],
          loai: "NK",
          ctName: selectedCT?.ten_ct || "",
          dateFrom,
          dateTo,
          congTrinhs,
        });
      } else if (pathname === "/phieu-xuat") {
        const res = await getPhieuList({ ...params, loai: "XK" });
        await exportPhieuList({
          phieuList: ((res.data as { data?: Phieu[] })?.data || []) as Phieu[],
          loai: "XK",
          ctName: selectedCT?.ten_ct || "",
          dateFrom,
          dateTo,
          congTrinhs,
        });
      } else {
        const [resNK, resXK, resTK] = await Promise.all([
          getPhieuList({ ...params, loai: "NK" }),
          getPhieuList({ ...params, loai: "XK" }),
          getTonKho(ctId ? { cong_trinh_id: ctId } : {}),
        ]);
        await exportBaoCaoTongHop({
          nkList: ((resNK.data as { data?: Phieu[] })?.data || []) as Phieu[],
          xkList: ((resXK.data as { data?: Phieu[] })?.data || []) as Phieu[],
          tonKhoList: ((resTK.data as { data?: TonKhoRow[] })?.data || []) as TonKhoRow[],
          ctName: selectedCT?.ten_ct || "",
          dateFrom,
          dateTo,
          congTrinhs,
        });
      }
    } catch (e) {
      alert("Lỗi xuất báo cáo: " + (e instanceof Error ? e.message : "Thử lại."));
    } finally {
      setExporting(false);
    }
  };

  const initials = (session.ten || session.email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="bg-hp-surface border-b border-hp-border px-4 md:px-6 flex items-center justify-between h-[60px] flex-shrink-0">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Mở menu điều hướng"
          className="md:hidden min-w-11 min-h-11 -ml-2 flex items-center justify-center text-hp-text-secondary hover:text-hp-text flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Home className="w-4 h-4 text-hp-text-muted flex-shrink-0 hidden sm:block" />
        <span className="text-hp-text-muted hidden sm:inline whitespace-nowrap">Trang chủ</span>
        <ChevronRight className="w-3 h-3 text-hp-text-disabled hidden sm:block flex-shrink-0" />
        <span className="text-hp-text font-medium min-w-0 truncate">{pageName}</span>
      </div>

      <div className="flex items-center gap-1.5 md:gap-3">
        <div className="relative" ref={pickerRef}>
          <button
            onClick={openPicker}
            aria-label="Chọn khoảng thời gian"
            className={`flex items-center gap-2 px-2.5 md:px-3 min-h-10 border rounded-hp-md text-sm transition-colors bg-hp-card
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent
              ${showPicker ? "border-hp-accent text-hp-accent" : "border-hp-border text-hp-text-secondary hover:border-hp-accent hover:text-hp-accent"}`}
          >
            <Calendar className="w-4 h-4 text-hp-accent" />
            <span className="font-medium hidden md:inline">{formatVN(dateFrom)}</span>
            <span className="text-hp-text-muted mx-0.5 hidden md:inline">–</span>
            <span className="font-medium hidden md:inline">{formatVN(dateTo)}</span>
          </button>

          {showPicker && (
            <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-72 bg-hp-elevated border border-hp-border rounded-hp-lg shadow-md z-50">
              <div className="px-4 pt-3 pb-2 border-b border-hp-divider">
                <span className="text-sm font-semibold text-hp-text">Chọn khoảng thời gian</span>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-hp-text-secondary mb-1 block">Từ ngày</label>
                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    className="w-full bg-hp-card border border-hp-border rounded-hp-md px-3 min-h-10 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary mb-1 block">Đến ngày</label>
                  <input
                    type="date"
                    value={tempTo}
                    onChange={(e) => setTempTo(e.target.value)}
                    className="w-full bg-hp-card border border-hp-border rounded-hp-md px-3 min-h-10 text-sm text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent"
                  />
                </div>

                <div>
                  <div className="text-xs text-hp-text-muted mb-1.5">Chọn nhanh</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => {
                          setTempFrom(p.from);
                          setTempTo(p.to);
                        }}
                        className="text-xs px-2.5 py-1 bg-hp-card text-hp-text-secondary rounded-full hover:bg-hp-accent/15 hover:text-hp-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={applyDate}
                    className="flex-1 bg-hp-primary text-white text-sm min-h-10 rounded-hp-md hover:bg-hp-primary/90 transition-colors font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
                  >
                    Áp dụng
                  </button>
                  <button
                    onClick={() => setShowPicker(false)}
                    className="flex-1 border border-hp-border text-hp-text-secondary text-sm min-h-10 rounded-hp-md hover:bg-hp-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          aria-label={exporting ? "Đang xuất..." : exportLabel}
          className="flex items-center gap-2 px-2.5 md:px-4 min-h-10 bg-hp-primary text-white rounded-hp-md text-sm font-medium hover:bg-hp-primary/90 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
        >
          {exporting ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden md:inline">{exporting ? "Đang xuất..." : exportLabel}</span>
        </button>

        <div className="hidden md:block w-px h-6 bg-hp-border" />

        <button
          onClick={handleBellClick}
          title="Cảnh báo tồn kho thấp"
          className="relative p-2.5 rounded-hp-md hover:bg-hp-elevated text-hp-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-hp-danger text-white text-xs rounded-full flex items-center justify-center leading-none animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Chuyển sang Light Mode" : "Chuyển sang Dark Mode"}
          className="p-2.5 rounded-hp-md hover:bg-hp-elevated text-hp-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button
          title="Trợ giúp"
          className="hidden md:flex p-2.5 rounded-hp-md hover:bg-hp-elevated text-hp-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 pl-2 hover:bg-hp-elevated rounded-hp-md px-2 py-1 min-h-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
          >
            {session.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.avatar}
                alt={session.ten || session.email}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-hp-accent rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="text-left hidden md:block">
              <div className="text-sm font-medium text-hp-text leading-tight">{session.ten}</div>
              <div className="text-xs text-hp-text-muted leading-tight capitalize">{session.role}</div>
            </div>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-hp-elevated rounded-hp-lg shadow-md border border-hp-border z-50 py-1">
                <div className="px-4 py-2.5 border-b border-hp-divider">
                  <div className="text-sm font-semibold text-hp-text">{session.ten}</div>
                  <div className="text-xs text-hp-text-muted truncate">{session.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 min-h-11 text-sm text-hp-danger hover:bg-hp-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
