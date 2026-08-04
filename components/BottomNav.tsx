"use client";

// Thanh điều hướng dưới cho Mobile (xem 08-navigation/bottom-navigation.md: cao
// 56-64px, tối đa 5 mục, icon 22-24px, nhãn 10-12px) — dùng chung cho App Tổng
// (AppShell/index.tsx) và App Con (ct/CTLayoutShell.tsx), mỗi nơi truyền `items`
// riêng. z-30 (thấp hơn overlay drawer z-40 đang dùng toàn app) để khi mở drawer,
// overlay che luôn cả thanh này, tránh bấm xuyên qua.
import { type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

export interface BottomNavItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  path: string;
  /** true nếu path này là trang gốc (vd "/" hoặc "/ct/5") — phải so khớp chính xác,
   * không dùng startsWith, nếu không nó sẽ luôn "active" trên mọi trang con. */
  exact?: boolean;
}

export function BottomNav({ items, onMoreClick }: { items: BottomNavItem[]; onMoreClick: () => void }) {
  const pathname = usePathname();
  const isActive = (item: BottomNavItem) => (item.exact ? pathname === item.path : pathname.startsWith(item.path));

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-hp-nav border-t border-hp-border flex items-stretch h-14"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.path}
            href={item.path}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent ${
              active ? "text-hp-accent" : "text-hp-sidebar-muted"
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-[11px] font-medium leading-none truncate max-w-full px-1">{item.label}</span>
          </Link>
        );
      })}
      <button
        onClick={onMoreClick}
        aria-label="Mở menu đầy đủ"
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-hp-sidebar-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hp-accent"
      >
        <Menu className="w-6 h-6" />
        <span className="text-[11px] font-medium leading-none">Thêm</span>
      </button>
    </nav>
  );
}
