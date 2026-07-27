import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getBieuDoNhapXuat } from "@/lib/data/bao-cao";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const period = (sp.get("period") as "day" | "week" | "month" | "year") ?? "month";
    const result = await getBieuDoNhapXuat({
      fromDate: sp.get("from_date") ?? undefined,
      toDate: sp.get("to_date") ?? undefined,
      period,
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
