"use client";

// Port từ frontend/src/components/Layout/Sidebar.jsx — HPCons Design System V1.1:
// nav-base #4B4F55, mở 260px / thu gọn 72px, menu cấp 1 cao 44px. Mobile (<768px):
// Drawer full-width theo 08-navigation/sidebar.md.
import { useState, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart2, Bell, StickyNote, Download, Upload, Package, Box, Building2,
  Shield, ChevronLeft, ChevronRight, X, Database, CheckCircle, Cpu,
  ChevronDown, ChevronUp, Layers, ClipboardList, History,
} from "lucide-react";
import { useCongTrinh } from "@/components/CongTrinhProvider";
import type { Session } from "@/lib/session";
import { AppLauncher } from "./AppLauncher";

interface NavItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: boolean;
  adminOnly?: boolean;
  userOnly?: boolean;
}

const groupTongQuan = {
  label: "TỔNG QUAN",
  items: [
    { icon: BarChart2, label: "Báo cáo tổng hợp", path: "/" },
    { icon: Bell, label: "Cảnh báo", path: "/canh-bao", badge: true },
    { icon: StickyNote, label: "Ghi chú công việc", path: "/ghi-chu" },
  ] as NavItem[],
};

const groupQuanLy = {
  label: "QUẢN LÝ DỮ LIỆU",
  items: [
    { icon: Upload, label: "Xuất kho", path: "/phieu-xuat" },
    { icon: Download, label: "Nhập kho", path: "/phieu-nhap" },
    { icon: Package, label: "Tồn kho", path: "/ton-kho" },
    { icon: Box, label: "Danh mục hàng hóa", path: "/danh-muc" },
    { icon: BarChart2, label: "Báo cáo", path: "/bao-cao" },
    { icon: History, label: "Lịch sử GD", path: "/lich-su" },
    { icon: StickyNote, label: "Ghi chú CV", path: "/ghi-chu", userOnly: true },
    { icon: ClipboardList, label: "Nhật ký HĐ", path: "/nhat-ky", adminOnly: true },
  ] as NavItem[],
};

const groupHeThong = {
  label: "HỆ THỐNG",
  items: [
    { icon: Building2, label: "Công trình", path: "/cong-trinh" },
    { icon: Shield, label: "Phân quyền", path: "/phan-quyen" },
    { icon: Cpu, label: "Thiết lập API AI", path: "/thiet-lap-api", adminOnly: true },
  ] as NavItem[],
};

export function Sidebar({
  session,
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: {
  session: Session;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const { congTrinhs, selectedCT, setSelectedCT, isAdmin } = useCongTrinh();
  const isAdminUser = session.role === "admin" || isAdmin;
  const [ctCollapsed, setCtCollapsed] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);

  const showLabels = !collapsed || mobileOpen;
  const closeOnMobile = () => {
    if (mobileOpen) onMobileClose();
  };

  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  const renderGroup = (group: { label: string; items: NavItem[] }) => (
    <div key={group.label} className="mb-1">
      {showLabels && (
        <div className="px-4 pt-3 pb-1">
          <span className="text-xs font-bold text-hp-sidebar-muted tracking-widest uppercase">{group.label}</span>
        </div>
      )}
      {!showLabels && <div className="border-t border-hp-divider mx-2 my-2" />}
      {group.items
        .filter((item) => (!item.adminOnly || isAdminUser) && (!item.userOnly || !isAdminUser))
        .map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={closeOnMobile}
              title={!showLabels ? item.label : undefined}
              className={`flex items-center gap-2 mx-3 px-3 min-h-11 rounded-hp-md text-sm transition-all duration-150 relative group
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent
                ${active ? "bg-hp-primary text-white font-semibold" : "text-hp-sidebar-muted hover:bg-white/5 hover:text-hp-sidebar-text"}`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-white" : "text-hp-sidebar-muted"}`} />
              {showLabels && <span className="flex-1 truncate">{item.label}</span>}
              {!showLabels && item.badge && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-hp-danger rounded-full" />
              )}
              {!showLabels && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-hp-elevated border border-hp-border text-hp-text text-xs rounded-hp-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-hp-overlay z-40" onClick={onMobileClose} aria-hidden="true" />
      )}

      <aside
        className={`flex flex-col h-screen bg-hp-nav border-r border-hp-border transition-all duration-300 overflow-hidden flex-shrink-0
          fixed inset-y-0 left-0 z-50 w-[260px]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:translate-x-0
          ${collapsed ? "md:w-[72px]" : "md:w-[260px]"}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-hp-divider min-h-16">
          {showLabels && (
            <button
              type="button"
              onClick={() => setLauncherOpen(true)}
              title="Mở danh sách ứng dụng"
              className="flex items-center gap-2 min-w-0 text-left rounded-hp-md -mx-1 px-1 py-1 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
            >
              <Image src="/logo-hpcons.png" alt="HP Cons" width={36} height={36} className="h-9 w-auto object-contain flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-hp-sidebar-text text-sm leading-tight">HPCons</div>
                <div className="text-xs text-hp-sidebar-muted leading-tight truncate">Construction</div>
              </div>
            </button>
          )}
          {!showLabels && (
            <button
              type="button"
              onClick={() => setLauncherOpen(true)}
              title="Mở danh sách ứng dụng"
              className="mx-auto rounded-hp-md p-0.5 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
            >
              <Image src="/logo-hpcons.png" alt="HP Cons" width={32} height={32} className="h-8 w-auto object-contain" />
            </button>
          )}
          <button
            onClick={onMobileClose}
            aria-label="Đóng menu"
            className="md:hidden min-w-11 min-h-11 flex items-center justify-center rounded-hp-sm hover:bg-white/10 text-hp-sidebar-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={onToggle}
            aria-label="Thu gọn menu"
            className={`hidden md:flex p-2 rounded-hp-sm hover:bg-white/10 text-hp-sidebar-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent ${collapsed ? "md:hidden" : ""}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {collapsed && (
            <button
              onClick={onToggle}
              aria-label="Mở rộng menu"
              className="hidden md:flex absolute top-5 -right-3 w-6 h-6 bg-hp-elevated border border-hp-border rounded-full items-center justify-center hover:bg-hp-card z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
            >
              <ChevronRight className="w-3 h-3 text-hp-sidebar-muted" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {isAdminUser && renderGroup(groupTongQuan)}

          {isAdminUser && (
            <div className="mb-1">
              {showLabels && (
                <button
                  onClick={() => setCtCollapsed(!ctCollapsed)}
                  className="w-full flex items-center justify-between px-4 pt-3 pb-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent rounded-hp-sm"
                >
                  <span className="text-xs font-bold text-hp-sidebar-muted tracking-widest uppercase">Danh sách công trình</span>
                  {ctCollapsed ? (
                    <ChevronDown className="w-3 h-3 text-hp-sidebar-muted" />
                  ) : (
                    <ChevronUp className="w-3 h-3 text-hp-sidebar-muted" />
                  )}
                </button>
              )}
              {!showLabels && <div className="border-t border-hp-divider mx-2 my-2" />}

              {!ctCollapsed && (
                <button
                  onClick={() => {
                    setSelectedCT(null);
                    closeOnMobile();
                  }}
                  title={!showLabels ? "Tất cả công trình" : undefined}
                  className={`flex items-center gap-2 mx-3 px-3 min-h-11 rounded-hp-md text-sm transition-all duration-150 relative group w-[calc(100%-16px)]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent
                    ${selectedCT === null ? "bg-hp-primary text-white font-semibold" : "text-hp-sidebar-muted hover:bg-white/5 hover:text-hp-sidebar-text"}`}
                >
                  <div className="w-5 h-5 bg-hp-accent rounded-hp-sm flex items-center justify-center flex-shrink-0">
                    <Layers className="w-3 h-3 text-white" />
                  </div>
                  {showLabels && <span className="flex-1 truncate text-left font-medium">Tất cả công trình</span>}
                  {!showLabels && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-hp-elevated border border-hp-border text-hp-text text-xs rounded-hp-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">
                      Tất cả công trình
                    </div>
                  )}
                </button>
              )}

              {!ctCollapsed &&
                congTrinhs.map((ct, i) => {
                  const active = selectedCT?.id === ct.id;
                  return (
                    <button
                      key={ct.id}
                      onClick={() => {
                        setSelectedCT(ct);
                        closeOnMobile();
                      }}
                      title={!showLabels ? ct.ten_ct : undefined}
                      className={`flex items-center gap-2 mx-3 px-3 min-h-11 rounded-hp-md text-sm transition-all duration-150 relative group w-[calc(100%-16px)]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent
                        ${active ? "bg-hp-primary text-white font-semibold" : "text-hp-sidebar-muted hover:bg-white/5 hover:text-hp-sidebar-text"}`}
                    >
                      <div className="w-5 h-5 bg-hp-accent rounded-hp-sm flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{i + 1}</span>
                      </div>
                      {showLabels && <span className="flex-1 truncate text-left">{ct.ten_ct}</span>}
                      {!showLabels && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-hp-elevated border border-hp-border text-hp-text text-xs rounded-hp-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                          {ct.ten_ct}
                        </div>
                      )}
                    </button>
                  );
                })}

              {!ctCollapsed && congTrinhs.length === 0 && showLabels && (
                <div className="mx-2 px-3 py-2 text-xs text-hp-sidebar-muted italic">Chưa có công trình</div>
              )}
            </div>
          )}

          {renderGroup(groupQuanLy)}
          {isAdminUser && renderGroup(groupHeThong)}
        </div>

        {showLabels && (
          <div className="mx-3 mb-3 p-3 bg-white/5 rounded-hp-lg border border-hp-border">
            <div className="text-xs font-bold text-hp-sidebar-muted uppercase tracking-widest mb-2">Kết nối hệ thống</div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-hp-sidebar-muted" />
                  <span className="text-xs text-hp-sidebar-muted">Database tổng</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-hp-success inline-block" />
                  <span className="text-xs text-hp-success font-medium">Online</span>
                </div>
              </div>
              {isAdminUser ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-hp-sidebar-muted" />
                    <span className="text-xs text-hp-sidebar-muted">App con</span>
                  </div>
                  <span className="text-xs text-hp-accent font-medium">{congTrinhs.length} công trình</span>
                </div>
              ) : selectedCT ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-hp-sidebar-muted" />
                    <span className="text-xs text-hp-sidebar-muted">Công trình</span>
                  </div>
                  <span className="text-xs text-hp-accent font-medium truncate max-w-28">{selectedCT.ten_ct}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 text-hp-sidebar-muted" />
                  <span className="text-xs text-hp-sidebar-muted">Đồng bộ</span>
                </div>
                <span className="text-xs text-hp-success font-medium">Thành công</span>
              </div>
            </div>
          </div>
        )}

        {showLabels && (
          <div className="px-4 py-3 border-t border-hp-divider">
            <p className="text-xs text-hp-sidebar-muted text-center">© 2026 HPC Warehouse</p>
            <p className="text-xs text-hp-sidebar-muted text-center">Phiên bản 2.0.0 (Next.js)</p>
          </div>
        )}
      </aside>

      {launcherOpen && <AppLauncher user={session} onClose={() => setLauncherOpen(false)} />}
    </>
  );
}
