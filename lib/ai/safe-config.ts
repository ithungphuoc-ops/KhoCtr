import "server-only";
import { decryptApiKey, maskApiKey } from "@/lib/crypto/fernet";
import type { AiConfig } from "@/lib/data/ai-config";

/**
 * Port từ api/routers/ai_config.py::_safe_config — loại bỏ api_key_enc khỏi
 * response, thay bằng api_key_masked. KHÔNG BAO GIỜ trả api_key_enc hoặc
 * plaintext về client.
 */
export function safeConfig(row: AiConfig | null | undefined): Record<string, unknown> {
  if (!row) return {};
  const { api_key_enc, ...rest } = row;
  const result: Record<string, unknown> = { ...rest };
  if (api_key_enc) {
    try {
      const plain = decryptApiKey(api_key_enc);
      result.api_key_masked = maskApiKey(plain);
      result.api_key_set = true;
    } catch {
      result.api_key_masked = "****[lỗi giải mã]";
      result.api_key_set = false;
    }
  } else {
    result.api_key_masked = "";
    result.api_key_set = false;
  }
  return result;
}
