import "server-only";
import { getAiConfigByCt } from "@/lib/data/ai-config";
import { decryptApiKey } from "@/lib/crypto/fernet";

/**
 * Port từ api/routers/ai_routes.py::_resolve_api_key — thứ tự ưu tiên:
 * 1. Config công trình trong DB (nếu có congTrinhId)
 * 2. Query param / header (tương thích ngược)
 * 3. .env (fallback cuối)
 */
export async function resolveApiKey(
  provider: string,
  apiKeyFallback: string | null | undefined,
  congTrinhId: number | null | undefined,
): Promise<{ apiKey: string; model: string }> {
  if (congTrinhId) {
    try {
      const cfg = await getAiConfigByCt(congTrinhId);
      if (cfg?.api_key_enc) {
        const key = decryptApiKey(cfg.api_key_enc);
        const model = cfg.model || defaultModelFor(provider);
        return { apiKey: key, model };
      }
    } catch {
      // Fallback xuống bước sau nếu decrypt lỗi hoặc không đọc được config CT.
    }
  }

  if (apiKeyFallback) {
    const model = provider === "openai" ? (process.env.OPENAI_MODEL || "gpt-4o-mini") : (process.env.GEMINI_MODEL || "gemini-1.5-flash");
    return { apiKey: apiKeyFallback, model };
  }

  const envKey =
    provider === "gemini" ? process.env.GEMINI_API_KEY : provider === "openai" ? process.env.OPENAI_API_KEY : process.env.CLAUDE_API_KEY;
  const model = provider === "openai" ? (process.env.OPENAI_MODEL || "gpt-4o-mini") : (process.env.GEMINI_MODEL || "gemini-1.5-flash");

  if (!envKey) {
    throw new Error("Công trình này chưa được cấu hình API AI. Admin vui lòng thêm key trong Thiết lập API.");
  }
  return { apiKey: envKey, model };
}

function defaultModelFor(provider: string): string {
  if (provider === "openai") return process.env.OPENAI_MODEL || "gpt-4o-mini";
  return process.env.GEMINI_MODEL || "gemini-1.5-flash";
}
