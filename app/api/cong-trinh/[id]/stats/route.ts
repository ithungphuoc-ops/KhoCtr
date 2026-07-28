import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getCongTrinhStats } from "@/lib/data/cong-trinh";
import { apiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const stats = await getCongTrinhStats(Number(id));
    return NextResponse.json(stats);
  } catch (err) {
    return apiError(err);
  }
}
