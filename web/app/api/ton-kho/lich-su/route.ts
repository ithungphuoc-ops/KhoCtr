import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getLichSuHang } from "@/lib/data/ton-kho";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const tenHang = sp.get("ten_hang");
    if (!tenHang) return NextResponse.json({ error: "Thiếu ten_hang" }, { status: 400 });
    const result = await getLichSuHang({
      tenHang,
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
