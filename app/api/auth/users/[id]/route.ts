import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { deleteUser, listUsers } from "@/lib/data/permissions";
import { apiError } from "@/lib/api-error";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const targetId = Number(id);

    const users = await listUsers();
    const target = users.find((u) => u.id === targetId);
    if (target && target.email === session.email) {
      throw new Error("Không thể xóa tài khoản đang đăng nhập.");
    }

    await deleteUser(targetId);
    return NextResponse.json({ success: true, deleted_id: targetId });
  } catch (err) {
    return apiError(err);
  }
}
