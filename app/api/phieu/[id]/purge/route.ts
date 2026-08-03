import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getPhieuById, purgePhieuPermanently } from "@/lib/data/phieu";
import { apiError } from "@/lib/api-error";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const phieu = await getPhieuById(Number(id));
    if (!phieu) throw new Error(`Không tìm thấy phiếu id=${id}`);
    if (!phieu.deleted_at) throw new Error("Phiếu đang hoạt động, chưa ở thùng rác — không thể xóa vĩnh viễn.");
    await purgePhieuPermanently(Number(id), session.email);
    return NextResponse.json({ success: true, purged_id: Number(id) });
  } catch (err) {
    return apiError(err);
  }
}
