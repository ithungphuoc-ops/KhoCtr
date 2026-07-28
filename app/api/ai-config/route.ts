import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getAllAiConfigs } from "@/lib/data/ai-config";
import { safeConfig } from "@/lib/ai/safe-config";
import { apiError } from "@/lib/api-error";

// [Admin] Xem cấu hình AI của tất cả công trình.
export async function GET() {
  try {
    await requireAdmin();
    const rows = await getAllAiConfigs();
    return NextResponse.json({ data: rows.map(safeConfig), total: rows.length });
  } catch (err) {
    return apiError(err);
  }
}
