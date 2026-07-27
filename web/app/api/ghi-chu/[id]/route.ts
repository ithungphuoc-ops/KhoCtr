import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getGhiChuById, updateGhiChuForSession, softDeleteGhiChuForSession } from "@/lib/data/ghi-chu";
import { apiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const row = await getGhiChuById(Number(id));
    if (!row) return NextResponse.json({ error: "Không tìm thấy ghi chú." }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await req.json();
    const row = await updateGhiChuForSession(session, Number(id), {
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await softDeleteGhiChuForSession(session, Number(id));
    return NextResponse.json({ success: true, message: "Đã xóa ghi chú (soft delete)." });
  } catch (err) {
    return apiError(err);
  }
}
