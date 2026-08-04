"use client";

// Port từ frontend/src/components/Layout/index.jsx.
import { useEffect, useState, type ReactNode } from "react";
import { BarChart2, Download, Upload, Package } from "lucide-react";
import type { Session } from "@/lib/session";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav, type BottomNavItem } from "@/components/BottomNav";

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { icon: BarChart2, label: "Trang chủ", path: "/", exact: true },
  { icon: Download, label: "Nhập kho", path: "/phieu-nhap" },
  { icon: Upload, label: "Xuất kho", path: "/phieu-xuat" },
  { icon: Package, label: "Tồn kho", path: "/ton-kho" },
];

export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Khóa cuộn nền khi Drawer mobile đang mở (13-overlays/drawer-bottom-sheet.md)
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-hp-bg">
      <Sidebar
        session={session}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header session={session} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 bg-hp-bg">{children}</main>
      </div>
      <BottomNav items={BOTTOM_NAV_ITEMS} onMoreClick={() => setMobileOpen(true)} />
    </div>
  );
}
