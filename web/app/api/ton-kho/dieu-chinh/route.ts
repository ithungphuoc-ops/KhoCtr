import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { dieuChinhTonKho } from "@/lib/data/ton-kho";
import { apiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const result = await dieuChinhTonKho({
      congTrinhId: body.cong_trinh_id,
      tenHang: body.ten_hang,
      dvt: body.dvt,
      tonHienTai: body.ton_hien_tai ?? 0,
      tonMoi: body.ton_moi ?? 0,
      ghiChu: body.ghi_chu,
      userEmail: body.user_email || session.email,
    });
    if ("delta" in result && result.delta === 0) {
      return NextResponse.json({ success: true, message: "Tồn không thay đổi", delta: 0 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Chưa có tên hàng")) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    return apiError(err);
  }
}
