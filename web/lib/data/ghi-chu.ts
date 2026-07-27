import "server-only";
import { select, insert, update } from "@/lib/firestore/client";
import type { Session } from "@/lib/session";

export const VALID_MAU = ["warning", "success", "danger", "info", "primary"] as const;
export const VALID_UU_TIEN = ["thap", "binh_thuong", "cao", "khan"] as const;
export const VALID_TRANG_THAI = ["mo", "dang_lam", "tam_dung", "hoan_thanh", "huy"] as const;

export interface GhiChu {
  id: number;
  cong_trinh_id: number;
  tieu_de: string;
  noi_dung: string;
  mau: string;
  uu_tien: string;
  trang_thai: string;
  deadline?: string | null;
  created_by: string;
  updated_by?: string;
  created_at: string;
  completed_at?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
}

export class AccessDeniedError extends Error {}

/** Port từ api/routers/ghi_chu.py::_check_ct_access */
async function checkCtAccess(session: Session, congTrinhId: number): Promise<void> {
  if (session.role === "admin") return;
  const rows = await select("user_congtrinh", { query: "id", filters: `user_id=eq.${session.uid}&cong_trinh_id=eq.${congTrinhId}` });
  if (rows.length === 0) throw new AccessDeniedError("Bạn không có quyền truy cập công trình này.");
}

/** Port từ api/firestore_client.py::get_ghi_chu_list */
export async function getGhiChuList(opts: {
  congTrinhId?: number;
  trangThai?: string;
  uuTien?: string;
  search?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<GhiChu[]> {
  const { congTrinhId, trangThai, uuTien, search, deadlineFrom, deadlineTo, includeDeleted = false, limit = 200, offset = 0 } = opts;
  let extra = "";
  if (!includeDeleted) extra += "&deleted_at=is.null";
  if (congTrinhId) extra += `&cong_trinh_id=eq.${congTrinhId}`;
  if (trangThai) extra += `&trang_thai=eq.${trangThai}`;
  if (uuTien) extra += `&uu_tien=eq.${uuTien}`;
  if (search) extra += `&or=(tieu_de.ilike.*${search}*,noi_dung.ilike.*${search}*)`;
  if (deadlineFrom) extra += `&deadline=gte.${deadlineFrom}`;
  if (deadlineTo) extra += `&deadline=lte.${deadlineTo}`;
  return (await select("ghi_chu", { filters: `limit=${limit}&offset=${offset}${extra}`, order: "created_at.desc" })) as GhiChu[];
}

/** Port từ api/routers/ghi_chu.py::list_ghi_chu (bọc quyền truy cập theo vai trò). */
export async function listGhiChuForSession(
  session: Session,
  opts: {
    congTrinhId?: number;
    trangThai?: string;
    uuTien?: string;
    search?: string;
    deadlineFrom?: string;
    deadlineTo?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ data: GhiChu[]; total: number; page: number; limit: number }> {
  const { page = 1, limit = 50, congTrinhId, ...rest } = opts;
  if (session.role !== "admin") {
    if (!congTrinhId) throw new Error("User phải chỉ định cong_trinh_id.");
    await checkCtAccess(session, congTrinhId);
  }
  const offset = (page - 1) * limit;
  const rows = await getGhiChuList({ ...rest, congTrinhId, limit, offset });
  return { data: rows, total: rows.length, page, limit };
}

export async function getGhiChuById(id: number): Promise<GhiChu | null> {
  const rows = await select("ghi_chu", { filters: `id=eq.${id}&deleted_at=is.null` });
  return (rows[0] as GhiChu) ?? null;
}

export async function createGhiChuForSession(
  session: Session,
  input: {
    congTrinhId: number;
    tieuDe: string;
    noiDung?: string;
    mau?: string;
    uuTien?: string;
    trangThai?: string;
    deadline?: string | null;
  },
): Promise<GhiChu> {
  await checkCtAccess(session, input.congTrinhId);
  const tieuDe = input.tieuDe.trim();
  if (!tieuDe) throw new Error("Tiêu đề không được để trống.");

  const data: Record<string, unknown> = {
    cong_trinh_id: input.congTrinhId,
    tieu_de: tieuDe,
    noi_dung: input.noiDung || "",
    mau: input.mau || "warning",
    uu_tien: input.uuTien || "binh_thuong",
    trang_thai: input.trangThai || "mo",
    created_by: session.email,
    updated_by: session.email,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };
  if (input.deadline) data.deadline = input.deadline;
  const rows = await insert("ghi_chu", data);
  const row = rows[0] as GhiChu;
  if (!row) throw new Error("Không thể tạo ghi chú.");
  return row;
}

export async function updateGhiChuForSession(
  session: Session,
  id: number,
  patch: {
    tieuDe?: string;
    noiDung?: string;
    mau?: string;
    uuTien?: string;
    trangThai?: string;
    deadline?: string | null;
  },
): Promise<GhiChu | null> {
  const existing = await getGhiChuById(id);
  if (!existing) throw new Error("Không tìm thấy ghi chú.");
  await checkCtAccess(session, existing.cong_trinh_id);

  const updateData: Record<string, unknown> = { updated_by: session.email };
  if (patch.tieuDe !== undefined) updateData.tieu_de = patch.tieuDe.trim();
  if (patch.noiDung !== undefined) updateData.noi_dung = patch.noiDung;
  if (patch.mau !== undefined) updateData.mau = patch.mau;
  if (patch.uuTien !== undefined) updateData.uu_tien = patch.uuTien;
  if (patch.trangThai !== undefined) {
    updateData.trang_thai = patch.trangThai;
    if (patch.trangThai === "hoan_thanh" && !existing.completed_at) {
      updateData.completed_at = new Date().toISOString();
    } else if (patch.trangThai !== "hoan_thanh") {
      updateData.completed_at = null;
    }
  }
  if (patch.deadline !== undefined) updateData.deadline = patch.deadline || null;

  const rows = await update("ghi_chu", updateData, `id=eq.${id}&deleted_at=is.null`);
  return (rows[0] as GhiChu) ?? null;
}

export async function softDeleteGhiChuForSession(session: Session, id: number): Promise<void> {
  const existing = await getGhiChuById(id);
  if (!existing) throw new Error("Không tìm thấy ghi chú.");
  await checkCtAccess(session, existing.cong_trinh_id);
  const rows = await update("ghi_chu", { deleted_at: new Date().toISOString(), updated_by: session.email }, `id=eq.${id}&deleted_at=is.null`);
  if (rows.length === 0) throw new Error("Xóa thất bại.");
}

export async function completeGhiChuForSession(session: Session, id: number): Promise<GhiChu | null> {
  const existing = await getGhiChuById(id);
  if (!existing) throw new Error("Không tìm thấy ghi chú.");
  await checkCtAccess(session, existing.cong_trinh_id);
  if (existing.trang_thai === "hoan_thanh") return existing;
  const rows = await update(
    "ghi_chu",
    { trang_thai: "hoan_thanh", completed_at: new Date().toISOString(), updated_by: session.email },
    `id=eq.${id}&deleted_at=is.null`,
  );
  return (rows[0] as GhiChu) ?? null;
}
