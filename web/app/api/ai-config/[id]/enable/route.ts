import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getAiConfigByCt, updateAiConfig } from "@/lib/data/ai-config";
import { apiError } from "@/lib/api-error";

// [Admin] Bật lại AI cho công trình (sau khi đã disable) — yêu cầu còn api_key_enc.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const congTrinhId = Number(id);
    const cfg = await getAiConfigByCt(congTrinhId);
    if (!cfg) return NextResponse.json({ detail: "Không tìm thấy cấu hình." }, { status: 404 });
    if (!cfg.api_key_enc) {
      return NextResponse.json({ detail: "Không có API Key để bật lại. Thêm key mới qua POST /{id}." }, { status: 400 });
    }
    if (cfg.is_active) {
      return NextResponse.json({ success: true, cong_trinh_id: congTrinhId, message: "AI đã đang hoạt động rồi." });
    }
    await updateAiConfig(congTrinhId, { is_active: true });
    return NextResponse.json({
      success: true,
      cong_trinh_id: congTrinhId,
      message: "Đã bật lại AI. Khuyến nghị chạy /test-connection để xác nhận key còn hợp lệ.",
    });
  } catch (err) {
    return apiError(err);
  }
}
