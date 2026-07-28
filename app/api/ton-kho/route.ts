import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { computeTonKho } from "@/lib/data/ton-kho";
import { getCongTrinhByMa } from "@/lib/data/cong-trinh";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    let congTrinhId = sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined;
    const maCt = sp.get("ma_ct");
    if (maCt && !congTrinhId) {
      const ct = await getCongTrinhByMa(maCt);
      if (ct) congTrinhId = ct.id;
    }
    const rows = await computeTonKho(congTrinhId);
    return NextResponse.json({ data: rows, total: rows.length });
  } catch (err) {
    return apiError(err);
  }
}
