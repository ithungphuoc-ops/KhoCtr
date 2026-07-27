"use client";

// Port rút gọn từ frontend/src/components/Layout/Header.jsx (350 dòng). GĐ1 chỉ port
// khung sườn (breadcrumb, theme toggle, menu người dùng, hamburger mobile) — date-range
// picker + xuất Excel + số cảnh báo tồn thấp phụ thuộc dữ liệu nghiệp vụ chưa port
// (getPhieuList/getTonKho/exportExcel), sẽ nối lại khi port các trang liên quan ở GĐ2
// (xem openspec/changes/migrate-nextjs-stack/tasks.md mục 2).
import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, ChevronRight, Home, LogOut, Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
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
};

export function Header({ session, onMenuClick }: { session: Session; onMenuClick: () => void }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  const pageName = routeNames[pathname] || "Trang chủ";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "https://account.hpcore.vn/login";
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
        <span className="text-hp-text-muted">Trang chủ</span>
        <ChevronRight className="w-3 h-3 text-hp-text-disabled" />
        <span className="text-hp-text font-medium">{pageName}</span>
      </div>

      <div className="flex items-center gap-1.5 md:gap-3">
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
