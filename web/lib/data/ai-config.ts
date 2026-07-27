import "server-only";
import { select, insert, update } from "@/lib/firestore/client";

export interface AiConfig {
  cong_trinh_id: number;
  provider: string;
  api_key_enc?: string;
  model?: string;
  max_tokens: number;
  system_prompt?: string;
  is_active: boolean;
  last_test_at?: string | null;
  last_test_status?: string | null;
  last_error?: string | null;
  match_green_threshold?: number;
  match_yellow_threshold?: number;
  [key: string]: unknown;
}

/** Port từ api/firestore_client.py::get_ai_config_by_ct */
export async function getAiConfigByCt(congTrinhId: number): Promise<AiConfig | null> {
  const rows = await select("project_ai_config", { filters: `cong_trinh_id=eq.${congTrinhId}` });
  return (rows[0] as AiConfig) ?? null;
}

/** Port từ get_all_ai_configs */
export async function getAllAiConfigs(): Promise<AiConfig[]> {
  return (await select("project_ai_config", { order: "cong_trinh_id.asc" })) as AiConfig[];
}

/** Port từ create_ai_config */
export async function createAiConfig(input: {
  congTrinhId: number;
  provider?: string;
  apiKeyEnc?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  isActive?: boolean;
}): Promise<AiConfig> {
  const data: Record<string, unknown> = {
    cong_trinh_id: input.congTrinhId,
    provider: input.provider || "gemini",
    is_active: input.isActive ?? false,
    max_tokens: input.maxTokens ?? 4096,
  };
  if (input.apiKeyEnc) data.api_key_enc = input.apiKeyEnc;
  if (input.model) data.model = input.model;
  if (input.systemPrompt) data.system_prompt = input.systemPrompt;
  const rows = await insert("project_ai_config", data);
  return rows[0] as AiConfig;
}

/** Port từ update_ai_config_test_result */
export async function updateAiConfigTestResult(congTrinhId: number, status: string, errorMsg = ""): Promise<AiConfig | null> {
  const data: Record<string, unknown> = {
    last_test_at: new Date().toISOString(),
    last_test_status: status,
    last_error: status !== "ok" ? errorMsg : null,
  };
  if (status === "ok") data.is_active = true;
  const rows = await update("project_ai_config", data, `cong_trinh_id=eq.${congTrinhId}`);
  return (rows[0] as AiConfig) ?? null;
}

/** Port từ update_ai_config */
export async function updateAiConfig(congTrinhId: number, data: Record<string, unknown>): Promise<AiConfig | null> {
  const rows = await update("project_ai_config", data, `cong_trinh_id=eq.${congTrinhId}`);
  return (rows[0] as AiConfig) ?? null;
}

/** Port từ ensure_ai_config_exists — gọi khi tạo công trình mới (nuốt lỗi, không chặn luồng tạo CT). */
export async function ensureAiConfigExists(congTrinhId: number): Promise<AiConfig | null> {
  try {
    const existing = await getAiConfigByCt(congTrinhId);
    if (existing) return existing;
    return await createAiConfig({ congTrinhId, isActive: false });
  } catch {
    return null;
  }
}
