import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { updatePhieu, deletePhieu } from "@/lib/data/phieu";
import { apiError } from "@/lib/api-error";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await req.json();
    await updatePhieu(Number(id), {
      ngay: body.ngay,
      doiTac: body.doi_tac,
      ghiChu: body.ghi_chu,
      tongTien: body.tong_tien,
      items: body.items,
      userEmail: body.user_email || session.email,
      loai: body.loai,
      soPhieu: body.so_phieu,
      congTrinhId: body.cong_trinh_id,
    });
    return NextResponse.json({ success: true, phieu_id: Number(id) });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const userEmail = req.nextUrl.searchParams.get("user_email") || session.email;
    await deletePhieu(Number(id), userEmail);
    return NextResponse.json({ success: true, deleted_id: Number(id) });
  } catch (err) {
    return apiError(err);
  }
}
