import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { listGhiChuForSession, createGhiChuForSession } from "@/lib/data/ghi-chu";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const sp = req.nextUrl.searchParams;
    const result = await listGhiChuForSession(session, {
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
      trangThai: sp.get("trang_thai") ?? undefined,
      uuTien: sp.get("uu_tien") ?? undefined,
      search: sp.get("search") ?? undefined,
      deadlineFrom: sp.get("deadline_from") ?? undefined,
      deadlineTo: sp.get("deadline_to") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const row = await createGhiChuForSession(session, {
      congTrinhId: body.cong_trinh_id,
      tieuDe: body.tieu_de,
      noiDung: body.noi_dung,
      mau: body.mau,
      uuTien: body.uu_tien,
      trangThai: body.trang_thai,
      deadline: body.deadline,
    });
    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    return apiError(err);
  }
}
