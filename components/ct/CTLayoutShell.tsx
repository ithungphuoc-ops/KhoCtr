"use client";

// Port từ frontend/src/pages/ct/CTLayout.jsx — sidebar riêng cho App Con (theo công trình).
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Download, Upload, Package, Cpu, ChevronLeft, ChevronRight, ArrowLeft, Warehouse, BookOpen, FileUp, StickyNote, Menu, X } from "lucide-react";
import { useCT } from "./CTProvider";

const menuItems = [
  { icon: LayoutDashboard, label: "Tổng quan", path: "" },
  { icon: Download, label: "Nhập kho", path: "nhap-kho" },
  { icon: Upload, label: "Xuất kho", path: "xuat-kho" },
  { icon: Package, label: "Tồn kho", path: "ton-kho" },
  { icon: BookOpen, label: "Danh mục hàng", path: "danh-muc" },
  { icon: Cpu, label: "AI đọc PDF", path: "ai-reader" },
  { icon: FileUp, label: "Import dữ liệu", path: "import-data" },
  { icon: StickyNote, label: "Ghi chú", path: "ghi-chu" },
];

export function CTLayoutShell({ children }: { children: ReactNode }) {
  const { congTrinh, ctId } = useCT();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const showLabels = !collapsed || mobileOpen;
  const closeOnMobile = () => {
    if (mobileOpen) setMobileOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const base = `/ct/${ctId}`;

  return (
    <div className="flex h-screen overflow-hidden bg-hp-bg">
      {mobileOpen && <div className="md:hidden fixed inset-0 bg-hp-overlay z-40" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      <aside
        className={`flex flex-col h-screen bg-hp-nav border-r border-hp-border transition-all duration-300 overflow-hidden flex-shrink-0
          fixed inset-y-0 left-0 z-50 w-[260px] min-w-[260px]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:translate-x-0
          ${collapsed ? "md:w-[72px] md:min-w-[72px]" : "md:w-[260px] md:min-w-[260px]"}`}
      >
        <div className="flex items-center justify-between px-3 py-4 border-b border-hp-border min-h-[64px]">
          {showLabels && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-hp-primary rounded-hp-md flex items-center justify-center flex-shrink-0">
                <Warehouse className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-hp-text leading-tight truncate">{congTrinh?.ten_ct || "Công trình"}</div>
                <div className="text-xs text-hp-text-muted leading-tight font-mono">{congTrinh?.ma_ct || ""}</div>
              </div>
            </div>
          )}
          {!showLabels && (
            <div className="w-8 h-8 bg-hp-primary rounded-hp-md flex items-center justify-center mx-auto">
              <Warehouse className="w-4 h-4 text-white" />
            </div>
          )}
          <button onClick={() => setMobileOpen(false)} aria-label="Đóng menu" className="md:hidden min-w-11 min-h-11 flex items-center justify-center rounded-hp-sm hover:bg-white/5 text-hp-text-muted flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className={`hidden md:flex p-1 rounded-hp-sm hover:bg-white/5 text-hp-text-muted flex-shrink-0 ${collapsed ? "mx-auto" : ""}`}>
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 py-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const to = item.path ? `${base}/${item.path}` : base;
            const isActive = item.path === "" ? pathname === base : pathname.startsWith(to);
            return (
              <Link
                key={item.label}
                href={to}
                onClick={closeOnMobile}
                title={!showLabels ? item.label : undefined}
                className={`flex items-center gap-2 mx-3 px-3 py-2.5 min-h-11 rounded-hp-md text-sm transition-all duration-150 relative group
                  ${isActive ? "bg-hp-primary text-white font-medium" : "text-hp-text-secondary hover:bg-white/5"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {showLabels && <span className="truncate">{item.label}</span>}
                {!showLabels && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-hp-elevated border border-hp-border text-hp-text text-xs rounded-hp-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">{item.label}</div>
                )}
              </Link>
            );
          })}
        </div>

        <div className="p-3 border-t border-hp-border">
          <button onClick={() => router.push("/")} title={!showLabels ? "Về Web Tổng" : undefined} className="flex items-center gap-2 w-full px-3 py-2 min-h-11 rounded-hp-md text-sm text-hp-text-secondary hover:bg-white/5 hover:text-hp-text transition-colors">
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            {showLabels && <span>Về Web Tổng</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="bg-hp-surface border-b border-hp-border h-[60px] px-4 md:px-6 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} aria-label="Mở menu điều hướng" className="md:hidden min-w-11 min-h-11 -ml-2 flex items-center justify-center text-hp-text-secondary hover:text-hp-text flex-shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-2 h-2 rounded-full bg-hp-primary flex-shrink-0 hidden sm:block" />
          <span className="text-sm font-semibold text-hp-text truncate">{congTrinh?.ten_ct || "Đang tải..."}</span>
          {congTrinh?.dia_chi && <span className="text-xs text-hp-text-muted truncate hidden sm:inline">&nbsp;·&nbsp; {String(congTrinh.dia_chi)}</span>}
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-hp-bg">{children}</main>
      </div>
    </div>
  );
}
