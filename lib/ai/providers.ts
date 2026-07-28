// Port từ api/ai_providers.py — registry các nhà cung cấp AI được hỗ trợ.
export interface ProviderMeta {
  name: string;
  label: string;
  defaultModel: string;
  models: string[];
  keyPrefixes: string[];
  keyMinLength: number;
  description: string;
}

export const PROVIDER_REGISTRY: Record<string, ProviderMeta> = {
  gemini: {
    name: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-1.5-flash",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
    keyPrefixes: ["AIza", "AQ."],
    keyMinLength: 20,
    description: "Google AI — miễn phí quota, đọc phiếu nhanh",
  },
  claude: {
    name: "claude",
    label: "Anthropic Claude",
    defaultModel: "claude-sonnet-4-6",
    models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-8"],
    keyPrefixes: ["sk-ant-"],
    keyMinLength: 40,
    description: "Anthropic — chất lượng cao, hỗ trợ tiếng Việt tốt",
  },
  openai: {
    name: "openai",
    label: "OpenAI GPT",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
    keyPrefixes: ["sk-"],
    keyMinLength: 40,
    description: "OpenAI GPT — đa năng, hỗ trợ nhiều ngôn ngữ",
  },
};

export function getProvider(name: string): ProviderMeta | undefined {
  return PROVIDER_REGISTRY[name];
}

export function listProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

export function listProvidersInfo() {
  return Object.values(PROVIDER_REGISTRY).map((p) => ({
    name: p.name,
    label: p.label,
    default_model: p.defaultModel,
    models: p.models,
    description: p.description,
  }));
}

export function isValidProvider(name: string): boolean {
  return name in PROVIDER_REGISTRY;
}

/** Port từ validate_api_key_format — chỉ check định dạng (prefix + độ dài), không gọi API thật. */
export function validateApiKeyFormat(provider: string, apiKey: string): { ok: boolean; message: string } {
  if (!provider) return { ok: false, message: "Provider không được để trống." };
  if (!apiKey) return { ok: false, message: "API Key không được để trống." };

  const meta = PROVIDER_REGISTRY[provider];
  if (!meta) {
    const supported = Object.keys(PROVIDER_REGISTRY)
      .map((p) => `"${p}"`)
      .join(", ");
    return { ok: false, message: `Provider '${provider}' không được hỗ trợ. Chọn: ${supported}.` };
  }

  const key = apiKey.trim();
  if (key.length < meta.keyMinLength) {
    return {
      ok: false,
      message: `API Key của ${meta.label} quá ngắn (tối thiểu ${meta.keyMinLength} ký tự, đang có ${key.length} ký tự).`,
    };
  }

  const prefixes = meta.keyPrefixes.filter(Boolean);
  if (prefixes.length > 0 && !prefixes.some((p) => key.startsWith(p))) {
    const display = prefixes.map((p) => `"${p}..."`).join(" hoặc ");
    return { ok: false, message: `API Key của ${meta.label} phải bắt đầu bằng ${display}.` };
  }

  return { ok: true, message: "OK" };
}
