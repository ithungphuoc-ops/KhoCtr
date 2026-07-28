import "server-only";
import { select, insert, update } from "@/lib/firestore/client";
import { getAllHangHoa } from "@/lib/data/hang-hoa";
import { normalize, findBestMatch, classifyTab } from "@/lib/ai/fuzzy-match";

export const DEFAULT_GREEN = 90;
export const DEFAULT_YELLOW = 70;

export interface NameMapping {
  id: number | string;
  ten_ai_raw: string;
  ten_ai_normalized: string;
  ten_chuan: string;
  so_lan_dung: number;
  cong_trinh_id?: number | null;
  [key: string]: unknown;
}

export interface MatchClassification {
  ten_ai_raw: string;
  ten_chuan: string;
  score: number;
  tab: "green" | "yellow" | "red";
  source: "ct_mapping" | "global_mapping" | "catalog_fuzzy" | "none";
  matched_id: unknown;
}

/** Port từ mapping_service.py::get_ct_mappings */
export async function getCtMappings(congTrinhId: number): Promise<NameMapping[]> {
  try {
    return (await select("ai_name_mapping", { filters: `cong_trinh_id=eq.${congTrinhId}`, order: "so_lan_dung.desc" })) as NameMapping[];
  } catch {
    return [];
  }
}

/** Port từ get_global_mappings */
export async function getGlobalMappings(): Promise<NameMapping[]> {
  try {
    return (await select("ai_name_mapping", { filters: "cong_trinh_id=is.null", order: "so_lan_dung.desc" })) as NameMapping[];
  } catch {
    return [];
  }
}

/** Port từ upsert_name_mapping */
export async function upsertNameMapping(tenAiRaw: string, tenChuan: string, congTrinhId: number | null = null): Promise<NameMapping | null> {
  const tenNorm = normalize(tenAiRaw);

  const filters = congTrinhId
    ? `cong_trinh_id=eq.${congTrinhId}&ten_ai_normalized=eq.${encodeURIComponent(tenNorm)}`
    : `cong_trinh_id=is.null&ten_ai_normalized=eq.${encodeURIComponent(tenNorm)}`;
  const existing = (await select("ai_name_mapping", { filters })) as NameMapping[];

  if (existing.length > 0) {
    const row = existing[0];
    const updated = await update("ai_name_mapping", { ten_chuan: tenChuan, so_lan_dung: (row.so_lan_dung ?? 1) + 1 }, `id=eq.${row.id}`);
    return (updated[0] as NameMapping) ?? null;
  }

  const data: Record<string, unknown> = {
    ten_ai_raw: tenAiRaw,
    ten_ai_normalized: tenNorm,
    ten_chuan: tenChuan,
    so_lan_dung: 1,
  };
  if (congTrinhId !== null) data.cong_trinh_id = congTrinhId;
  const inserted = await insert("ai_name_mapping", data);
  return (inserted[0] as NameMapping) ?? null;
}

/** Port từ log_match_history */
export async function logMatchHistory(input: {
  congTrinhId: number;
  loaiPhieu: string;
  fileName: string;
  tongSoDong: number;
  khopXanh: number;
  khopVang: number;
  hangMoi: number;
  userId: number | null;
  userEmail: string | null;
  processingTimeMs: number;
  aiProvider: string;
  aiModel: string;
}): Promise<void> {
  try {
    await insert("ai_match_history", {
      cong_trinh_id: input.congTrinhId,
      loai_phieu: input.loaiPhieu,
      file_name: input.fileName,
      tong_so_dong: input.tongSoDong,
      khop_xanh: input.khopXanh,
      khop_vang: input.khopVang,
      hang_moi: input.hangMoi,
      user_id: input.userId,
      user_email: input.userEmail,
      processing_time_ms: input.processingTimeMs,
      ai_provider: input.aiProvider,
      ai_model: input.aiModel,
    });
  } catch (e) {
    console.error("[ai-mapping] logMatchHistory error:", e);
  }
}

/** Port từ classify_item */
export function classifyItem(
  tenAiRaw: string,
  ctMappings: NameMapping[],
  globalMappings: NameMapping[],
  catalog: { ma_hang: string; ten_hang: string }[],
  greenThreshold = DEFAULT_GREEN,
  yellowThreshold = DEFAULT_YELLOW,
): MatchClassification {
  const tenNorm = normalize(tenAiRaw);

  for (const m of ctMappings) {
    if (m.ten_ai_normalized === tenNorm) {
      return result(tenAiRaw, m.ten_chuan, 100, greenThreshold, yellowThreshold, "ct_mapping", m.id);
    }
  }
  for (const m of globalMappings) {
    if (m.ten_ai_normalized === tenNorm) {
      return result(tenAiRaw, m.ten_chuan, 100, greenThreshold, yellowThreshold, "global_mapping", m.id);
    }
  }

  const bestCt = findBestMatch(tenAiRaw, ctMappings, "ten_chuan", yellowThreshold);
  if (bestCt) {
    return result(tenAiRaw, bestCt.item.ten_chuan, bestCt.score, greenThreshold, yellowThreshold, "ct_mapping", bestCt.item.id);
  }

  const bestCat = findBestMatch(tenAiRaw, catalog, "ten_hang", yellowThreshold);
  if (bestCat) {
    return result(tenAiRaw, bestCat.item.ten_hang, bestCat.score, greenThreshold, yellowThreshold, "catalog_fuzzy", bestCat.item.ma_hang);
  }

  return result(tenAiRaw, "", 0, greenThreshold, yellowThreshold, "none", null);
}

function result(
  tenAiRaw: string,
  tenChuan: string,
  score: number,
  greenThreshold: number,
  yellowThreshold: number,
  source: MatchClassification["source"],
  matchedId: unknown,
): MatchClassification {
  return { ten_ai_raw: tenAiRaw, ten_chuan: tenChuan, score, tab: classifyTab(score, greenThreshold, yellowThreshold), source, matched_id: matchedId };
}

export interface BatchItemInput {
  ten_hang?: string;
  ten_ai_raw?: string;
  [key: string]: unknown;
}

export interface EnrichedItem extends BatchItemInput {
  _idx: number;
  _match: MatchClassification;
}

/** Port từ process_items_batch */
export async function processItemsBatch(
  items: BatchItemInput[],
  congTrinhId: number,
  greenThreshold = DEFAULT_GREEN,
  yellowThreshold = DEFAULT_YELLOW,
): Promise<{
  green: EnrichedItem[];
  yellow: EnrichedItem[];
  red: EnrichedItem[];
  stats: { tong: number; khop_xanh: number; khop_vang: number; hang_moi: number; processing_time_ms: number; green_threshold: number; yellow_threshold: number };
}> {
  const start = Date.now();

  const [ctMappings, globalMappings, catalog] = await Promise.all([
    getCtMappings(congTrinhId),
    getGlobalMappings(),
    getAllHangHoa({ congTrinhId, limit: 5000 }),
  ]);

  const green: EnrichedItem[] = [];
  const yellow: EnrichedItem[] = [];
  const red: EnrichedItem[] = [];

  items.forEach((item, idx) => {
    const tenAi = item.ten_hang || item.ten_ai_raw || "";
    if (!tenAi) return;

    const classification = classifyItem(tenAi, ctMappings, globalMappings, catalog, greenThreshold, yellowThreshold);
    const enriched: EnrichedItem = { ...item, _idx: idx, _match: classification };

    if (classification.tab === "green") green.push(enriched);
    else if (classification.tab === "yellow") yellow.push(enriched);
    else red.push(enriched);
  });

  return {
    green,
    yellow,
    red,
    stats: {
      tong: items.length,
      khop_xanh: green.length,
      khop_vang: yellow.length,
      hang_moi: red.length,
      processing_time_ms: Date.now() - start,
      green_threshold: greenThreshold,
      yellow_threshold: yellowThreshold,
    },
  };
}
