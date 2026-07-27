import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getPhieuList, createPhieu } from "@/lib/data/phieu";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const limit = Number(sp.get("limit") ?? 100);
    const offset = Number(sp.get("offset") ?? 0);
    const rows = await getPhieuList({
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
      loai: sp.get("loai") ?? undefined,
      search: sp.get("search") ?? undefined,
      dateFrom: sp.get("date_from") ?? undefined,
      dateTo: sp.get("date_to") ?? undefined,
      limit,
      offset,
    });
    return NextResponse.json({ data: rows, total: rows.length, limit, offset });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const { phieuId, phieu } = await createPhieu({
      congTrinhId: body.cong_trinh_id,
      loai: body.loai,
      soPhieu: body.so_phieu,
      ngay: body.ngay,
      doiTac: body.doi_tac,
      ghiChu: body.ghi_chu,
      tongTien: body.tong_tien,
      items: body.items,
      userEmail: body.user_email || session.email,
    });
    return NextResponse.json({ success: true, phieu_id: phieuId, phieu, so_items: body.items?.length || 0 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("đã tồn tại")) {
      return NextResponse.json({ detail: err.message }, { status: 409 });
    }
    return apiError(err);
  }
}
