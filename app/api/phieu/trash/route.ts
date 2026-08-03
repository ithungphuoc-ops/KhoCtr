import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getDeletedPhieuList } from "@/lib/data/phieu";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const rows = await getDeletedPhieuList({
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
      loai: sp.get("loai") ?? undefined,
    });
    return NextResponse.json({ data: rows, total: rows.length });
  } catch (err) {
    return apiError(err);
  }
}
