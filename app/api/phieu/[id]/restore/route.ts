import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { restorePhieu } from "@/lib/data/phieu";
import { apiError } from "@/lib/api-error";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await restorePhieu(Number(id), session.email);
    return NextResponse.json({ success: true, restored_id: Number(id) });
  } catch (err) {
    return apiError(err);
  }
}
