import "server-only";
import { select, insert, update, del } from "@/lib/firestore/client";

export interface HangHoa {
  ma_hang: string;
  ten_hang: string;
  dvt: string;
  nhom: string;
  cong_trinh_id: number | null;
  [key: string]: unknown;
}

/** Port từ api/firestore_client.py::get_all_hang_hoa — giữ nguyên logic filter/native-prefilter đã vá 2026-07-27. */
export async function getAllHangHoa(opts: {
  congTrinhId?: number;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<HangHoa[]> {
  const { congTrinhId, search, limit = 10000, offset = 0 } = opts;
  let extra = "";
  if (congTrinhId) extra += `&cong_trinh_id=eq.${congTrinhId}`;
  if (search) extra += `&or=(ten_hang.ilike.*${search}*,ma_hang.ilike.*${search}*)`;
  return (await select("hang_hoa", {
    query: "ma_hang,ten_hang,dvt,nhom,cong_trinh_id",
    filters: `limit=${limit}&offset=${offset}${extra}`,
    order: "nhom.asc,ten_hang.asc",
  })) as HangHoa[];
}

export async function createHangHoa(data: Record<string, unknown>): Promise<HangHoa | null> {
  const rows = await insert("hang_hoa", data);
  return (rows[0] as HangHoa) ?? null;
}

export async function updateHangHoa(maHang: string, data: Record<string, unknown>): Promise<HangHoa | null> {
  const rows = await update("hang_hoa", data, `ma_hang=eq.${maHang}`);
  return (rows[0] as HangHoa) ?? null;
}

export async function deleteHangHoa(maHang: string): Promise<void> {
  await del("hang_hoa", `ma_hang=eq.${maHang}`);
}
