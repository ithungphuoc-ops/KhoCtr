import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getAiConfigByCt, updateAiConfigTestResult } from "@/lib/data/ai-config";
import { decryptApiKey } from "@/lib/crypto/fernet";
import { getProvider } from "@/lib/ai/providers";
import { apiError } from "@/lib/api-error";

const TEST_PROMPT = "Trả lời đúng 1 từ: OK";
const TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * [Admin] Kiểm tra kết nối API thật của công trình — gọi API nhẹ nhất của
 * provider, lưu kết quả, tự set is_active=true nếu OK.
 * Port từ api/routers/ai_config.py::test_connection.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const congTrinhId = Number(id);

    const cfg = await getAiConfigByCt(congTrinhId);
    if (!cfg) return NextResponse.json({ detail: "Chưa có cấu hình AI cho công trình này." }, { status: 404 });
    if (!cfg.api_key_enc) {
      return NextResponse.json({ detail: "Chưa có API Key. Thêm key trước khi kiểm tra kết nối." }, { status: 400 });
    }

    let plainKey: string;
    try {
      plainKey = decryptApiKey(cfg.api_key_enc);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await updateAiConfigTestResult(congTrinhId, "error", msg);
      return NextResponse.json({ detail: `Lỗi giải mã key: ${msg}` }, { status: 500 });
    }

    const provider = cfg.provider || "gemini";
    const meta = getProvider(provider);
    const model = cfg.model || meta?.defaultModel || "gemini-1.5-flash";

    let status = "error";
    let errorMsg = "";

    try {
      if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${plainKey}`;
        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: TEST_PROMPT }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        });
        if (res.ok) {
          status = "ok";
        } else {
          const raw = await res.text();
          if (res.status === 429) {
            status = "quota_exceeded";
            errorMsg = `Hết quota (${model}). Thử lại sau hoặc đổi model.`;
          } else {
            status = "error";
            errorMsg = `HTTP ${res.status}: ${raw.slice(0, 200)}`;
          }
        }
      } else if (provider === "claude") {
        const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": plainKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: "user", content: TEST_PROMPT }] }),
        });
        if (res.ok) {
          status = "ok";
        } else {
          const raw = await res.text();
          status = res.status === 429 ? "quota_exceeded" : "error";
          errorMsg = `HTTP ${res.status}: ${raw.slice(0, 200)}`;
        }
      } else if (provider === "openai") {
        const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${plainKey}` },
          body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: "user", content: TEST_PROMPT }] }),
        });
        if (res.ok) {
          status = "ok";
        } else {
          const raw = await res.text();
          status = res.status === 429 ? "quota_exceeded" : "error";
          errorMsg = `HTTP ${res.status}: ${raw.slice(0, 200)}`;
        }
      } else {
        status = "error";
        errorMsg = `Provider '${provider}' chưa có handler test.`;
      }
    } catch (e) {
      status = "error";
      errorMsg = e instanceof Error ? e.message : String(e);
    }

    await updateAiConfigTestResult(congTrinhId, status, errorMsg);

    return NextResponse.json({
      cong_trinh_id: congTrinhId,
      provider,
      model,
      status,
      message: status === "ok" ? "Kết nối thành công!" : errorMsg,
    });
  } catch (err) {
    return apiError(err);
  }
}
