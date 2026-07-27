import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { themHangTonKho } from "@/lib/data/ton-kho";
import { apiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const result = await themHangTonKho({
      congTrinhId: body.cong_trinh_id,
      tenHang: body.ten_hang,
      dvt: body.dvt,
      soLuong: body.so_luong,
      donGia: body.don_gia,
      ghiChu: body.ghi_chu,
      userEmail: body.user_email || session.email,
    });
    return NextResponse.json({ success: true, so_phieu: result.soPhieu, phieu_id: result.phieuId });
  } catch (err) {
    if (err instanceof Error && (err.message.includes("Chưa nhập") || err.message.includes("lớn hơn 0"))) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return apiError(err);
  }
}
