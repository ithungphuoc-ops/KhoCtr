import { redirect } from "next/navigation";
import { hpcoreLoginUrl } from "@/lib/hpcore";
import { resolveSession } from "@/lib/session";
import { getMyCongTrinh } from "@/lib/data/cong-trinh";
import { CongTrinhProvider } from "@/components/CongTrinhProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { AppShell } from "@/components/AppShell";

/**
 * Port từ frontend/src/App.jsx (PrivateRoute + CongTrinhProvider + Layout). Phân biệt
 * đúng 2 trường hợp không có phiên (khớp PrivateRoute cũ): chưa đăng nhập hpcore →
 * redirect; đã đăng nhập hpcore nhưng chưa được cấp quyền app "warehouse" → hiện
 * thông báo tại chỗ, KHÔNG redirect (tránh vòng lặp vô hạn).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const result = await resolveSession();

  if (result.status === "unauthenticated") {
    redirect(hpcoreLoginUrl("https://khoct.hpcore.vn/"));
  }

  if (result.status === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hp-bg p-4">
        <div className="text-center max-w-sm">
          <p className="text-hp-text font-semibold text-lg mb-2">Chưa được cấp quyền truy cập</p>
          <p className="text-sm text-hp-text-muted">
            Tài khoản của bạn đã đăng nhập hpcore nhưng chưa được cấp quyền vào KhoCtr. Liên hệ
            quản trị viên để được cấp quyền trong mục &quot;Cài đặt&quot; của hpcore.
          </p>
        </div>
      </div>
    );
  }

  const { session } = result;
  const { congTrinhs, isAdmin } = await getMyCongTrinh(session);

  return (
    <SessionProvider session={session}>
      <CongTrinhProvider initialCongTrinhs={congTrinhs} initialIsAdmin={isAdmin}>
        <AppShell session={session}>{children}</AppShell>
      </CongTrinhProvider>
    </SessionProvider>
  );
}
