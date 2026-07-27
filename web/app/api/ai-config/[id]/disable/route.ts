import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getAiConfigByCt, updateAiConfig } from "@/lib/data/ai-config";
import { apiError } from "@/lib/api-error";

// [Admin] Tạm ngưng AI cho công trình — giữ nguyên api_key_enc.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const congTrinhId = Number(id);
    const cfg = await getAiConfigByCt(congTrinhId);
    if (!cfg) return NextResponse.json({ detail: "Không tìm thấy cấu hình." }, { status: 404 });
    if (!cfg.is_active) {
      return NextResponse.json({ success: true, cong_trinh_id: congTrinhId, message: "AI đã ở trạng thái tắt rồi." });
    }
    await updateAiConfig(congTrinhId, { is_active: false });
    return NextResponse.json({
      success: true,
      cong_trinh_id: congTrinhId,
      message: "Đã tạm ngưng AI. Key vẫn được giữ — dùng /enable để bật lại.",
    });
  } catch (err) {
    return apiError(err);
  }
}
