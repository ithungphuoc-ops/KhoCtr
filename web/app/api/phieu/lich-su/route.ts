import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getLichSuGiaoDich } from "@/lib/data/phieu";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const result = await getLichSuGiaoDich({
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
      loai: sp.get("loai") ?? undefined,
      tenHang: sp.get("ten_hang") ?? undefined,
      dateFrom: sp.get("date_from") ?? undefined,
      dateTo: sp.get("date_to") ?? undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
      offset: sp.get("offset") ? Number(sp.get("offset")) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
