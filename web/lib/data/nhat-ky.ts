import "server-only";
import { select, insert } from "@/lib/firestore/client";

export interface ActivityLogEntry {
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  user_email: string;
  cong_trinh_id?: number;
  created_at: string;
  [key: string]: unknown;
}

/** Port từ api/firestore_client.py::log_activity — không throw để không ảnh hưởng luồng chính. */
export async function logActivity(entry: {
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  userEmail?: string;
  congTrinhId?: number | null;
}): Promise<void> {
  try {
    const data: Record<string, unknown> = {
      action: entry.action,
      entity_type: entry.entityType || "phieu",
      entity_id: entry.entityId ? String(entry.entityId) : "",
      details: entry.details || "",
      user_email: entry.userEmail || "",
      created_at: new Date().toISOString(),
    };
    if (entry.congTrinhId) data.cong_trinh_id = entry.congTrinhId;
    await insert("activity_log", data);
  } catch {
    // im lặng — nhật ký không được làm hỏng luồng chính
  }
}

/** Port từ api/firestore_client.py::get_activity_log */
export async function getActivityLog(opts: {
  limit?: number;
  offset?: number;
  action?: string;
  congTrinhId?: number;
} = {}): Promise<ActivityLogEntry[]> {
  const { limit = 100, offset = 0, action, congTrinhId } = opts;
  let extra = "";
  if (action) extra += `&action=eq.${action}`;
  if (congTrinhId) extra += `&cong_trinh_id=eq.${congTrinhId}`;
  try {
    return (await select("activity_log", {
      filters: `limit=${limit}&offset=${offset}${extra}`,
      order: "created_at.desc",
    })) as ActivityLogEntry[];
  } catch {
    return [];
  }
}
