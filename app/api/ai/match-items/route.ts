import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAiConfigByCt } from "@/lib/data/ai-config";
import { processItemsBatch, DEFAULT_GREEN, DEFAULT_YELLOW, type BatchItemInput } from "@/lib/data/ai-mapping";
import { apiError } from "@/lib/api-error";

interface MatchItemsBody {
  cong_trinh_id: number;
  loai_phieu?: string;
  file_name?: string;
  items: BatchItemInput[];
}

/** Port từ ai_routes.py::_get_thresholds — đọc ngưỡng match từ project_ai_config, fallback 90/70. */
async function getThresholds(congTrinhId: number): Promise<[number, number]> {
  try {
    const cfg = await getAiConfigByCt(congTrinhId);
    const g = cfg?.match_green_threshold;
    const y = cfg?.match_yellow_threshold;
    if (typeof g === "number" && typeof y === "number" && y < g) return [g, y];
  } catch {
    /* ignore, dùng fallback */
  }
  return [DEFAULT_GREEN, DEFAULT_YELLOW];
}

/**
 * Nhận list items từ AI đọc PDF, phân loại theo 3 tab (🟢/🟡/🔴). Không ghi DB
 * — chỉ phân loại. Port từ ai_routes.py::match_items.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = (await req.json()) as MatchItemsBody;

    if (!body.items?.length) {
      return NextResponse.json({ green: [], yellow: [], red: [], stats: { tong: 0, khop_xanh: 0, khop_vang: 0, hang_moi: 0 } });
    }

    const [greenThreshold, yellowThreshold] = await getThresholds(body.cong_trinh_id);
    const result = await processItemsBatch(body.items, body.cong_trinh_id, greenThreshold, yellowThreshold);
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
