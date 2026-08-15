"use client";

// Port từ frontend/src/components/Layout/AppLauncher.jsx — danh sách ứng dụng công ty
// (giống hệt PKD/app tổng), lấy từ account.hpcore.vn/api/apps. Tự chứa, không phụ thuộc
// backend KhoCtr nên port gần như nguyên vẹn.
import { useEffect, useState } from "react";
import {
  Clock, MapPin, FileCheck, Send, CalendarClock, BarChart3, Settings,
  Warehouse, Briefcase, Receipt, Workflow, Heart, Laptop, PenTool,
  LayoutGrid, Search, X, AppWindow, type LucideIcon,
} from "lucide-react";
import type { Session } from "@/lib/session";

const APPS_API = "https://account.hpcore.vn/api/apps";
const HPCORE_PROFILE_URL = "https://account.hpcore.vn/profile";

const ICONS: Record<string, LucideIcon> = {
  Clock, MapPin, FileCheck, Send, CalendarClock, BarChart3, Settings,
  Warehouse, Briefcase, Receipt, Workflow, Heart, Laptop, PenTool,
};

const ROLE_LABEL: Record<string, string> = { admin: "Quản trị viên", user: "Thủ kho" };

interface AppEntry {
  name: string;
  href?: string;
  iconKey?: string;
  category?: "ops" | "business";
  image?: string;
  color?: string;
  comingSoon?: boolean;
}

/** Tô sáng phần chữ khớp với từ khoá tìm kiếm — plain-match, khớp đúng luật lọc ở dưới. */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-green-500/20 px-0.5 font-semibold text-green-300">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

function Tile({ app, onNavigate, query }: { app: AppEntry; onNavigate: () => void; query: string }) {
  const Icon = (app.iconKey && ICONS[app.iconKey]) || AppWindow;
  const current = !!app.href && app.href.includes("khoct.hpcore.vn");
  const inner = (
    <>
      <div
        className={`flex size-14 items-center justify-center overflow-hidden rounded-hp-xl transition-transform group-hover:scale-105
        ${app.image ? "bg-white" : app.color} ${app.comingSoon ? "opacity-50" : ""}`}
      >
        {app.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={app.image} alt={app.name} className="size-full scale-[1.15] object-cover" />
        ) : (
          <Icon className="size-6 text-white" aria-hidden />
        )}
      </div>
      <span
        className={`text-center text-xs font-medium leading-tight ${app.comingSoon ? "text-hp-text-disabled" : "text-hp-text"}`}
      >
        <HighlightMatch text={app.name} query={query} />
      </span>
      {current && (
        <span className="rounded-full bg-hp-primary/15 px-1.5 py-0.5 text-[9px] text-hp-primary">Đang dùng</span>
      )}
      {app.comingSoon && (
        <span className="rounded-full bg-hp-warning/15 px-1.5 py-0.5 text-[9px] text-hp-warning">Sắp ra mắt</span>
      )}
    </>
  );
  const cls = "group flex flex-col items-center gap-2 rounded-hp-lg p-3 transition-colors hover:bg-white/5";
  if (app.comingSoon || !app.href)
    return (
      <div className={`${cls} cursor-default`} title="Sắp ra mắt">
        {inner}
      </div>
    );
  if (current) return <div className={cls}>{inner}</div>;
  return (
    <a href={app.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={cls}>
      {inner}
    </a>
  );
}

export function AppLauncher({ user, onClose }: { user: Session | null; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [apps, setApps] = useState<AppEntry[] | null>(null);

  useEffect(() => {
    let ok = true;
    fetch(APPS_API)
      .then((r) => r.json())
      .then((d) => {
        if (ok) setApps(Array.isArray(d.apps) ? d.apps : []);
      })
      .catch(() => {
        if (ok) setApps([]);
      });
    return () => {
      ok = false;
    };
  }, []);

  const ql = q.trim().toLowerCase();
  const list = (apps ?? []).filter((a) => !ql || a.name.toLowerCase().includes(ql));
  const groups = [
    {
      title: "Nhân sự & Vận hành",
      subtitle: "Chấm công, đơn từ, đặt phòng, báo cáo...",
      apps: list.filter((a) => a.category !== "business"),
    },
    {
      title: "Ứng dụng nghiệp vụ",
      subtitle: "Kinh doanh, kho, tài sản, quy trình...",
      apps: list.filter((a) => a.category === "business"),
    },
  ].filter((g) => g.apps.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-start overflow-y-auto bg-hp-overlay p-3 sm:py-4 sm:pl-[calc(260px+12px)] sm:pr-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-hp-xl border border-hp-border bg-hp-surface text-hp-text shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-hp-border p-5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="truncate font-bold">{user?.ten || user?.email || "Người dùng"}</p>
            <p className="text-xs text-hp-text-muted">
              {(user?.role && ROLE_LABEL[user.role]) || user?.role} ·{" "}
              <a href={HPCORE_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="text-hp-accent hover:underline">
                Tài khoản
              </a>
            </p>
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-hp-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="Tìm kiếm ứng dụng"
              className="h-9 w-full rounded-hp-md border border-hp-border bg-hp-bg pl-9 pr-3 text-sm text-hp-text outline-none focus:ring-2 focus:ring-hp-accent"
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="hidden size-8 items-center justify-center rounded-hp-md text-hp-text-muted hover:bg-white/8 sm:flex"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5">
          <a
            href="https://account.hpcore.vn/dashboard"
            className="inline-flex items-center gap-2 text-sm text-hp-accent hover:underline"
          >
            <LayoutGrid className="size-4" /> Tổng quan HPCons App Tổng
          </a>

          {apps === null ? (
            <p className="py-8 text-center text-sm text-hp-text-muted">Đang tải danh sách ứng dụng…</p>
          ) : groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-hp-text-muted">Không có ứng dụng phù hợp</p>
          ) : (
            groups.map((g) => (
              <div key={g.title}>
                <p className="font-semibold">{g.title}</p>
                <p className="mb-3 text-xs text-hp-text-muted">{g.subtitle}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {g.apps.map((app) => (
                    <Tile key={app.name} app={app} onNavigate={onClose} query={ql} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
