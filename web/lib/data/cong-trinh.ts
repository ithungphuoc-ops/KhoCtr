import "server-only";
import { select } from "@/lib/firestore/client";
import type { Session } from "@/lib/session";

export interface CongTrinh {
  id: number;
  ma_ct: string;
  ten_ct: string;
  dia_chi?: string;
  ghi_chu?: string;
  [key: string]: unknown;
}

/** Port từ api/firestore_client.py::get_all_cong_trinh() */
export async function getAllCongTrinh(): Promise<CongTrinh[]> {
  return (await select("cong_trinh", { order: "ten_ct.asc" })) as CongTrinh[];
}

/**
 * Port từ api/routers/auth.py::my_congtrinh — admin thấy toàn bộ công trình,
 * user (thủ kho) chỉ thấy công trình được cấp quyền qua user_congtrinh.
 */
export async function getMyCongTrinh(
  session: Session,
): Promise<{ congTrinhs: CongTrinh[]; isAdmin: boolean }> {
  if (session.role === "admin") {
    return { congTrinhs: await getAllCongTrinh(), isAdmin: true };
  }
  const perms = await select("user_congtrinh", { filters: `user_id=eq.${session.uid}` });
  const ctIds = perms.map((p) => p.cong_trinh_id as number);
  if (ctIds.length === 0) return { congTrinhs: [], isAdmin: false };

  const ctList: CongTrinh[] = [];
  for (const ctId of ctIds) {
    const rows = await select("cong_trinh", { filters: `id=eq.${ctId}` });
    ctList.push(...(rows as CongTrinh[]));
  }
  return { congTrinhs: ctList, isAdmin: false };
}
