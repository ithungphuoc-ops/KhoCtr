import { requireSessionForPage } from "@/lib/session";
import { CTProvider } from "@/components/ct/CTProvider";
import { CTLayoutShell } from "@/components/ct/CTLayoutShell";

// Port từ frontend/src/pages/ct/CTLayout.jsx — "App Con" (theo 1 công trình cụ thể),
// route /ct/[id]/*. Vẫn cần đăng nhập SSO như App Tổng nhưng KHÔNG dùng chung
// AppShell/CongTrinhProvider — giao diện sidebar riêng.
export default async function CTLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSessionForPage(`/ct/${id}`);

  return (
    <CTProvider ctId={id}>
      <CTLayoutShell>{children}</CTLayoutShell>
    </CTProvider>
  );
}
