import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getBaoCaoThoTang } from "@/lib/data/bao-cao";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const year = Number(sp.get("year"));
    const month = Number(sp.get("month"));
    const result = await getBaoCaoThoTang({
      year,
      month,
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
