import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { xoaHangTonKho } from "@/lib/data/ton-kho";
import { apiError } from "@/lib/api-error";

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession();
    const sp = req.nextUrl.searchParams;
    const tenHang = sp.get("ten_hang");
    const congTrinhId = sp.get("cong_trinh_id");
    if (!tenHang || !congTrinhId) {
      return NextResponse.json({ detail: "Thiếu ten_hang hoặc cong_trinh_id" }, { status: 400 });
    }
    const deleted = await xoaHangTonKho({
      congTrinhId: Number(congTrinhId),
      tenHang,
      userEmail: sp.get("user_email") || session.email,
    });
    return NextResponse.json({ success: true, deleted_rows: deleted });
  } catch (err) {
    return apiError(err);
  }
}
