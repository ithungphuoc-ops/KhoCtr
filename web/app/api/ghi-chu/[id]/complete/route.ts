import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { completeGhiChuForSession } from "@/lib/data/ghi-chu";
import { apiError } from "@/lib/api-error";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const row = await completeGhiChuForSession(session, Number(id));
    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    return apiError(err);
  }
}
