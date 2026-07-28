import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getChiTietPhieu } from "@/lib/data/phieu";
import { apiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const items = await getChiTietPhieu(Number(id));
    return NextResponse.json({ phieu_id: Number(id), items, total: items.length });
  } catch (err) {
    return apiError(err);
  }
}
