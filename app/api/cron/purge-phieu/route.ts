import { NextRequest, NextResponse } from "next/server";
import { getExpiredDeletedPhieu, purgePhieuPermanently } from "@/lib/data/phieu";

const RETENTION_DAYS = 30;

/**
 * Cron Vercel gọi mỗi ngày (xem vercel.json) — không có session người dùng, xác thực
 * bằng header Authorization: Bearer <CRON_SECRET> (biến môi trường tự cấu hình trên
 * Vercel). Xóa vĩnh viễn các phiếu đã nằm trong thùng rác quá RETENTION_DAYS ngày.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ detail: "Không có quyền." }, { status: 401 });
  }

  const beforeIso = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const expired = await getExpiredDeletedPhieu(beforeIso);

  let purged = 0;
  const errors: string[] = [];
  for (const p of expired) {
    try {
      await purgePhieuPermanently(p.id, "cron");
      purged++;
    } catch (e) {
      errors.push(`id=${p.id}: ${e instanceof Error ? e.message : "lỗi không xác định"}`);
    }
  }

  return NextResponse.json({ success: true, found: expired.length, purged, errors });
}
