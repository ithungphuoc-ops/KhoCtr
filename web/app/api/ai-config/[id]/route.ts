import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSession } from "@/lib/session";
import { createAiConfig, getAiConfigByCt, updateAiConfig } from "@/lib/data/ai-config";
import { safeConfig } from "@/lib/ai/safe-config";
import { encryptApiKey } from "@/lib/crypto/fernet";
import { isValidProvider, listProviders, validateApiKeyFormat } from "@/lib/ai/providers";
import { apiError } from "@/lib/api-error";

/**
 * [Admin: đầy đủ config + api_key_masked. User: chỉ trạng thái.]
 * Port từ api/routers/ai_config.py::get_config.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const congTrinhId = Number(id);
    const row = await getAiConfigByCt(congTrinhId);
    if (!row) {
      return NextResponse.json({
        configured: false,
        cong_trinh_id: congTrinhId,
        message: "Công trình này chưa được cấu hình API AI. Liên hệ Admin để thêm vào.",
      });
    }
    const safe = safeConfig(row);
    if (session.role !== "admin") {
      return NextResponse.json({
        configured: safe.api_key_set ?? false,
        cong_trinh_id: congTrinhId,
        provider: safe.provider,
        model: safe.model,
        is_active: safe.is_active,
        last_test_status: safe.last_test_status,
        last_test_at: safe.last_test_at,
      });
    }
    return NextResponse.json({ configured: safe.api_key_set ?? false, ...safe });
  } catch (err) {
    return apiError(err);
  }
}

interface ConfigBody {
  provider?: string;
  api_key?: string;
  model?: string | null;
  max_tokens?: number;
  system_prompt?: string | null;
}

/**
 * [Admin] Tạo hoặc cập nhật cấu hình AI. api_key nhận plaintext → validate
 * format → encrypt → lưu DB. Đổi key → reset is_active về false.
 * Port từ create_or_update_config.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const congTrinhId = Number(id);
    const body = (await req.json()) as ConfigBody;
    const provider = body.provider || "gemini";

    if (!isValidProvider(provider)) {
      return NextResponse.json({ detail: `Provider không hợp lệ. Chọn: ${listProviders()}` }, { status: 400 });
    }
    if (body.api_key) {
      const { ok, message } = validateApiKeyFormat(provider, body.api_key);
      if (!ok) return NextResponse.json({ detail: message }, { status: 400 });
    }

    const apiKeyEnc = body.api_key ? encryptApiKey(body.api_key) : "";
    const existing = await getAiConfigByCt(congTrinhId);

    let row;
    if (existing) {
      const updateData: Record<string, unknown> = {
        provider,
        max_tokens: body.max_tokens ?? 4096,
      };
      if (apiKeyEnc) {
        updateData.api_key_enc = apiKeyEnc;
        updateData.is_active = false;
        updateData.last_test_status = null;
        updateData.last_test_at = null;
        updateData.last_error = null;
      }
      if (body.model !== undefined) updateData.model = body.model;
      if (body.system_prompt !== undefined) updateData.system_prompt = body.system_prompt;
      row = await updateAiConfig(congTrinhId, updateData);
    } else {
      row = await createAiConfig({
        congTrinhId,
        provider,
        apiKeyEnc,
        model: body.model || "",
        maxTokens: body.max_tokens ?? 4096,
        systemPrompt: body.system_prompt || "",
        isActive: false,
      });
    }

    return NextResponse.json({ success: true, data: safeConfig(row) });
  } catch (err) {
    return apiError(err);
  }
}

/** [Admin] Cập nhật một phần cấu hình (PATCH-style). Port từ update_config. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const congTrinhId = Number(id);
    const body = (await req.json()) as ConfigBody;

    if (body.provider && !isValidProvider(body.provider)) {
      return NextResponse.json({ detail: `Provider không hợp lệ. Chọn: ${listProviders()}` }, { status: 400 });
    }
    if (body.api_key && body.provider) {
      const { ok, message } = validateApiKeyFormat(body.provider, body.api_key);
      if (!ok) return NextResponse.json({ detail: message }, { status: 400 });
    }

    const existing = await getAiConfigByCt(congTrinhId);
    if (!existing) {
      return NextResponse.json({ detail: "Chưa có cấu hình AI cho công trình này." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.provider !== undefined) updateData.provider = body.provider;
    if (body.max_tokens !== undefined) updateData.max_tokens = body.max_tokens;
    if (body.model !== undefined) updateData.model = body.model;
    if (body.system_prompt !== undefined) updateData.system_prompt = body.system_prompt;
    if (body.api_key) {
      updateData.api_key_enc = encryptApiKey(body.api_key);
      updateData.is_active = false;
      updateData.last_test_status = null;
      updateData.last_test_at = null;
      updateData.last_error = null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ detail: "Không có trường nào để cập nhật." }, { status: 400 });
    }

    const row = await updateAiConfig(congTrinhId, updateData);
    return NextResponse.json({ success: true, data: safeConfig(row) });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * [Admin] Xóa API Key (giữ lại bản ghi + lịch sử test). Port từ delete_config.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const congTrinhId = Number(id);
    const existing = await getAiConfigByCt(congTrinhId);
    if (!existing) {
      return NextResponse.json({ detail: "Không tìm thấy cấu hình." }, { status: 404 });
    }
    await updateAiConfig(congTrinhId, { api_key_enc: null, is_active: false });
    return NextResponse.json({
      success: true,
      cong_trinh_id: congTrinhId,
      message: "Đã xóa API Key. Lịch sử test được giữ lại. Thêm key mới để kích hoạt lại.",
    });
  } catch (err) {
    return apiError(err);
  }
}
