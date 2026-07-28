import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getBaoCaoTongHop } from "@/lib/data/bao-cao";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const result = await getBaoCaoTongHop({
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
      dateFrom: sp.get("date_from") ?? undefined,
      dateTo: sp.get("date_to") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
