import "server-only";
import { select, insert, update, del } from "@/lib/firestore/client";
import type { Session } from "@/lib/session";

export interface CongTrinh {
  id: number;
  ma_ct: string;
  ten_ct: string;
  dia_chi?: string;
  ghi_chu?: string;
  trang_thai?: string;
  [key: string]: unknown;
}

/** Port từ api/firestore_client.py::get_all_cong_trinh() */
export async function getAllCongTrinh(): Promise<CongTrinh[]> {
  return (await select("cong_trinh", { order: "ten_ct.asc" })) as CongTrinh[];
}

export async function getCongTrinhById(id: number): Promise<CongTrinh | null> {
  const rows = await select("cong_trinh", { filters: `id=eq.${id}` });
  return (rows[0] as CongTrinh) ?? null;
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

/** Port từ api/routers/cong_trinh.py::create_cong_trinh (gọi upsert_cong_trinh). */
export async function createCongTrinh(input: {
  maCt: string;
  tenCt: string;
  diaChi?: string;
  ghiChu?: string;
}): Promise<CongTrinh> {
  const existingRows = await select("cong_trinh", { filters: `ma_ct=eq.${input.maCt}` });
  let row: CongTrinh;
  if (existingRows.length > 0) {
    const rows = await update("cong_trinh", { ten_ct: input.tenCt, dia_chi: input.diaChi || "" }, `ma_ct=eq.${input.maCt}`);
    row = rows[0] as CongTrinh;
  } else {
    const rows = await insert("cong_trinh", {
      ma_ct: input.maCt,
      ten_ct: input.tenCt,
      dia_chi: input.diaChi || "",
      ghi_chu: input.ghiChu || "",
    });
    row = rows[0] as CongTrinh;
  }
  // TODO(GĐ4): port ensure_ai_config_exists(ct_id) — tự tạo config AI rỗng cho CT mới.
  // Bản Python bọc try/except nuốt lỗi (không ảnh hưởng luồng tạo CT), giữ nguyên khi port ai_config.ts.
  return row;
}

export async function updateCongTrinh(id: number, data: { tenCt?: string; diaChi?: string; ghiChu?: string }): Promise<CongTrinh | null> {
  const payload: Record<string, unknown> = {};
  if (data.tenCt !== undefined) payload.ten_ct = data.tenCt;
  if (data.diaChi !== undefined) payload.dia_chi = data.diaChi;
  if (data.ghiChu !== undefined) payload.ghi_chu = data.ghiChu;
  if (Object.keys(payload).length === 0) throw new Error("Không có trường nào để cập nhật");
  const rows = await update("cong_trinh", payload, `id=eq.${id}`);
  return (rows[0] as CongTrinh) ?? null;
}

export async function updateTrangThaiCongTrinh(id: number, trangThai: "hoat_dong" | "hoan_thanh"): Promise<void> {
  await update("cong_trinh", { trang_thai: trangThai }, `id=eq.${id}`);
}

/** Port từ api/routers/cong_trinh.py::get_cong_trinh_stats — đếm records sẽ bị xóa khi xóa CT. */
export async function getCongTrinhStats(id: number): Promise<{ phieu_count: number; hang_hoa_count: number; chi_tiet_count: number }> {
  const existing = await select("cong_trinh", { filters: `id=eq.${id}` });
  if (existing.length === 0) throw new Error(`Không tìm thấy id=${id}`);

  const phieuList = await select("phieu", { filters: `limit=100000&cong_trinh_id=eq.${id}` });
  const phieuIds = phieuList.map((p) => p.id);

  let chiTietCount = 0;
  if (phieuIds.length > 0) {
    const idsStr = phieuIds.join(",");
    const rows = await select("chi_tiet_phieu", { query: "id", filters: `phieu_id=in.(${idsStr})` });
    chiTietCount = rows.length;
  }

  const hangHoaList = await select("hang_hoa", { filters: `limit=100000&cong_trinh_id=eq.${id}` });

  return { phieu_count: phieuList.length, hang_hoa_count: hangHoaList.length, chi_tiet_count: chiTietCount };
}

/** Port từ api/routers/cong_trinh.py::delete_cong_trinh — cascade delete đúng thứ tự. */
export async function deleteCongTrinh(id: number): Promise<void> {
  const existing = await select("cong_trinh", { filters: `id=eq.${id}` });
  if (existing.length === 0) throw new Error(`Không tìm thấy id=${id}`);

  const phieuList = await select("phieu", { filters: `limit=100000&cong_trinh_id=eq.${id}` });
  const phieuIds = phieuList.map((p) => p.id);

  if (phieuIds.length > 0) {
    const idsStr = phieuIds.join(",");
    await del("chi_tiet_phieu", `phieu_id=in.(${idsStr})`);
  }
  await del("phieu", `cong_trinh_id=eq.${id}`);
  await del("hang_hoa", `cong_trinh_id=eq.${id}`);
  await del("cong_trinh", `id=eq.${id}`);
}
