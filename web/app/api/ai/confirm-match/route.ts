import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { upsertNameMapping, logMatchHistory } from "@/lib/data/ai-mapping";
import { apiError } from "@/lib/api-error";

interface ConfirmMappingItem {
  ten_ai_raw: string;
  ten_chuan: string;
  is_global?: boolean;
}

interface ConfirmMatchBody {
  cong_trinh_id: number;
  loai_phieu?: string;
  file_name?: string;
  mappings: ConfirmMappingItem[];
  khop_xanh?: number;
  khop_vang?: number;
  hang_moi?: number;
  ai_provider?: string;
  ai_model?: string;
  processing_time_ms?: number;
}

/**
 * Sau khi người dùng bấm Xác nhận trên BatchPhieuPopup: lưu/cập nhật mapping
 * đã confirm vào ai_name_mapping + ghi 1 bản ghi vào ai_match_history.
 * KHÔNG ghi phiếu nhập/xuất — bước đó do trang gọi createPhieu riêng.
 * Port từ ai_routes.py::confirm_match.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await req.json()) as ConfirmMatchBody;

    let savedCount = 0;
    const errors: string[] = [];

    for (const m of body.mappings || []) {
      if (!m.ten_ai_raw || !m.ten_chuan) continue;
      const ctId = m.is_global ? null : body.cong_trinh_id;
      try {
        await upsertNameMapping(m.ten_ai_raw, m.ten_chuan, ctId);
        savedCount++;
      } catch (e) {
        errors.push(`${m.ten_ai_raw}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await logMatchHistory({
      congTrinhId: body.cong_trinh_id,
      loaiPhieu: body.loai_phieu || "nhap",
      fileName: body.file_name || "",
      tongSoDong: (body.khop_xanh || 0) + (body.khop_vang || 0) + (body.hang_moi || 0),
      khopXanh: body.khop_xanh || 0,
      khopVang: body.khop_vang || 0,
      hangMoi: body.hang_moi || 0,
      userId: session.uid,
      userEmail: session.email,
      processingTimeMs: body.processing_time_ms || 0,
      aiProvider: body.ai_provider || "",
      aiModel: body.ai_model || "",
    });

    return NextResponse.json({ success: true, mappings_saved: savedCount, errors });
  } catch (err) {
    return apiError(err);
  }
}
