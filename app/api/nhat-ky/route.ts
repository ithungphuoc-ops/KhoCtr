import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getActivityLog } from "@/lib/data/nhat-ky";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const rows = await getActivityLog({
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
      offset: sp.get("offset") ? Number(sp.get("offset")) : undefined,
      action: sp.get("action") ?? undefined,
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
    });
    return NextResponse.json({ data: rows, total: rows.length });
  } catch (err) {
    return apiError(err);
  }
}
