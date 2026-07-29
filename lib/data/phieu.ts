import "server-only";
import { select, insert, update, del } from "@/lib/firestore/client";
import { logActivity } from "@/lib/data/nhat-ky";

export interface Phieu {
  id: number;
  cong_trinh_id: number;
  loai: "NK" | "XK";
  so_phieu: string;
  ngay: string;
  doi_tac: string;
  ghi_chu: string;
  tong_tien: number;
  nguon: string;
  anh_urls?: string[];
  [key: string]: unknown;
}

export interface ChiTietPhieu {
  phieu_id: number;
  ma_hang?: string;
  ten_hang: string;
  dvt: string;
  so_luong: number;
  don_gia: number;
  thanh_tien: number;
  ghi_chu?: string;
  [key: string]: unknown;
}

export interface PhieuItemInput {
  ma_hang?: string;
  ten_hang: string;
  dvt?: string;
  so_luong?: number;
  don_gia?: number;
  thanh_tien?: number;
  ghi_chu?: string;
}

/** Port từ api/firestore_client.py::get_phieu_list */
export async function getPhieuList(opts: {
  congTrinhId?: number;
  loai?: string;
  search?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<Phieu[]> {
  const { congTrinhId, loai, search, limit = 200, offset = 0, dateFrom, dateTo } = opts;
  let extra = "";
  if (congTrinhId) extra += `&cong_trinh_id=eq.${congTrinhId}`;
  if (loai) extra += `&loai=eq.${loai}`;
  if (search) extra += `&or=(so_phieu.ilike.*${search}*,doi_tac.ilike.*${search}*)`;
  if (dateFrom) extra += `&ngay=gte.${dateFrom}`;
  if (dateTo) extra += `&ngay=lte.${dateTo}`;
  return (await select("phieu", {
    filters: `limit=${limit}&offset=${offset}${extra}`,
    order: "ngay.desc",
  })) as Phieu[];
}

export async function getChiTietPhieu(phieuId: number): Promise<ChiTietPhieu[]> {
  return (await select("chi_tiet_phieu", { filters: `phieu_id=eq.${phieuId}` })) as ChiTietPhieu[];
}

async function pushChiTiet(phieuId: number, items: PhieuItemInput[]): Promise<void> {
  if (!items.length) return;
  const data = items.map((it) => ({
    phieu_id: phieuId,
    ten_hang: it.ten_hang || "",
    dvt: it.dvt || "cái",
    so_luong: it.so_luong || 0,
    don_gia: it.don_gia || 0,
    thanh_tien: it.thanh_tien || (it.so_luong || 0) * (it.don_gia || 0),
    ghi_chu: it.ghi_chu || "",
    ma_hang: it.ma_hang || "",
  }));
  await insert("chi_tiet_phieu", data);
}

/** Port từ api/routers/phieu.py::create_phieu (kiểm tra trùng số phiếu + tạo + chi tiết + log). */
export async function createPhieu(input: {
  congTrinhId: number;
  loai: "NK" | "XK";
  soPhieu: string;
  ngay: string;
  doiTac?: string;
  ghiChu?: string;
  tongTien?: number;
  items?: PhieuItemInput[];
  userEmail?: string;
}): Promise<{ phieuId: number; phieu: Phieu }> {
  const existing = await select("phieu", {
    filters: `cong_trinh_id=eq.${input.congTrinhId}&so_phieu=eq.${input.soPhieu}`,
  });
  if (existing.length > 0) {
    throw new Error(`Số phiếu '${input.soPhieu}' đã tồn tại trong công trình này`);
  }

  let tongTien = input.tongTien || 0;
  if (!tongTien && input.items?.length) {
    tongTien = input.items.reduce((sum, it) => sum + (it.thanh_tien || (it.so_luong || 0) * (it.don_gia || 0)), 0);
  }

  const rows = await insert("phieu", {
    cong_trinh_id: input.congTrinhId,
    loai: input.loai,
    so_phieu: input.soPhieu,
    ngay: input.ngay,
    doi_tac: input.doiTac || "",
    ghi_chu: input.ghiChu || "",
    tong_tien: tongTien,
    nguon: "web",
  });
  const phieu = rows[0] as Phieu;
  if (!phieu) throw new Error("Không thể tạo phiếu");

  if (input.items?.length) await pushChiTiet(phieu.id, input.items);

  await logActivity({
    action: `create_${input.loai.toLowerCase()}`,
    entityType: "phieu",
    entityId: String(phieu.id),
    details: `${input.loai} ${input.soPhieu} | ${input.ngay} | ${input.doiTac || ""} | ${(tongTien || 0).toLocaleString("vi-VN")} VND`,
    userEmail: input.userEmail,
    congTrinhId: input.congTrinhId,
  });

  return { phieuId: phieu.id, phieu };
}

/** Port từ api/routers/phieu.py::update_phieu */
export async function updatePhieu(
  id: number,
  input: {
    ngay: string;
    doiTac?: string;
    ghiChu?: string;
    tongTien?: number;
    items?: PhieuItemInput[];
    userEmail?: string;
    loai?: string;
    soPhieu?: string;
    congTrinhId?: number;
  },
): Promise<void> {
  let tongTien = input.tongTien || 0;
  if (!tongTien && input.items?.length) {
    tongTien = input.items.reduce((sum, it) => sum + (it.thanh_tien || (it.so_luong || 0) * (it.don_gia || 0)), 0);
  }

  await update("phieu", { ngay: input.ngay, doi_tac: input.doiTac || "", ghi_chu: input.ghiChu || "", tong_tien: tongTien }, `id=eq.${id}`);

  await del("chi_tiet_phieu", `phieu_id=eq.${id}`);
  if (input.items?.length) await pushChiTiet(id, input.items);

  await logActivity({
    action: `update_${(input.loai || "nk").toLowerCase()}`,
    entityType: "phieu",
    entityId: String(id),
    details: `Cập nhật ${input.loai || "NK"} ${input.soPhieu || ""} | ${input.ngay} | ${input.doiTac || ""} | ${tongTien.toLocaleString("vi-VN")} VND`,
    userEmail: input.userEmail,
    congTrinhId: input.congTrinhId,
  });
}

/** Port từ api/firestore_client.py::delete_phieu + router log */
export async function deletePhieu(id: number, userEmail?: string): Promise<void> {
  await del("chi_tiet_phieu", `phieu_id=eq.${id}`);
  await del("phieu", `id=eq.${id}`);
  await logActivity({
    action: "delete_phieu",
    entityType: "phieu",
    entityId: String(id),
    details: `Xoa phieu id=${id}`,
    userEmail,
  });
}

/** Port từ api/firestore_client.py::get_lich_su */
export async function getLichSu(phieuList: Phieu[], limit = 20000) {
  if (!phieuList.length) return [];
  const phieuMap = new Map(phieuList.filter((p) => p.id).map((p) => [p.id, p]));
  if (phieuMap.size === 0) return [];

  const allChiTiets = (await select("chi_tiet_phieu", {
    query: "phieu_id,ten_hang,dvt,so_luong,don_gia,thanh_tien,ghi_chu",
  })) as ChiTietPhieu[];

  const result = allChiTiets
    .filter((r) => phieuMap.has(r.phieu_id))
    .map((r) => {
      const p = phieuMap.get(r.phieu_id)!;
      return {
        ten_hang: r.ten_hang || "",
        dvt: r.dvt || "",
        so_luong: r.so_luong || 0,
        don_gia: r.don_gia || 0,
        thanh_tien: r.thanh_tien || 0,
        ghi_chu: r.ghi_chu || "",
        loai: p.loai || "",
        so_phieu: p.so_phieu || "",
        ngay: p.ngay || "",
        doi_tac: p.doi_tac || "",
        cong_trinh_id: p.cong_trinh_id,
      };
    });

  return result.slice(0, limit);
}

/** Port từ api/routers/phieu.py::get_lich_su_giao_dich */
export async function getLichSuGiaoDich(opts: {
  congTrinhId?: number;
  loai?: string;
  tenHang?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { congTrinhId, loai, tenHang, dateFrom, dateTo, limit = 500, offset = 0 } = opts;
  const phieuList = await getPhieuList({ congTrinhId, loai, dateFrom, dateTo, limit: 10000 });
  let lichSu = await getLichSu(phieuList, 50000);
  if (tenHang) {
    const needle = tenHang.toLowerCase();
    lichSu = lichSu.filter((r) => (r.ten_hang || "").toLowerCase().includes(needle));
  }
  lichSu.sort((a, b) => (b.ngay || "").localeCompare(a.ngay || ""));
  return { data: lichSu.slice(offset, offset + limit), total: lichSu.length };
}

/** Port từ api/firestore_client.py::get_phieu_ids_by_ct + delete_chi_tiet_by_hang */
export async function deleteChiTietByHang(congTrinhId: number, tenHang: string): Promise<number> {
  const rows = await select("phieu", { query: "id", filters: `cong_trinh_id=eq.${congTrinhId}` });
  const ids = rows.map((r) => String(r.id));
  if (ids.length === 0) return 0;
  const deleted = await del("chi_tiet_phieu", `phieu_id=in.(${ids.join(",")})&ten_hang=eq.${tenHang}`);
  return deleted.length;
}

/** Port từ api/firestore_client.py::get_thong_ke_tong */
export async function getThongKeTong() {
  const cts = await select("cong_trinh", { order: "ten_ct.asc" });
  const phieus = (await select("phieu", { query: "loai,cong_trinh_id,tong_tien,ngay", filters: "limit=100000" })) as Phieu[];
  const nk = phieus.filter((p) => p.loai === "NK");
  const xk = phieus.filter((p) => p.loai === "XK");
  return {
    so_cong_trinh: cts.length,
    so_phieu_nk: nk.length,
    so_phieu_xk: xk.length,
    tong_phieu: nk.length + xk.length,
    tong_tien_nk: nk.reduce((s, p) => s + Number(p.tong_tien || 0), 0),
    tong_tien_xk: xk.reduce((s, p) => s + Number(p.tong_tien || 0), 0),
  };
}

/** Dùng cho cascade delete công trình (routers/cong_trinh.py::delete_cong_trinh) và stats. */
export async function createPhieuForAdjustment(input: {
  congTrinhId: number;
  loai: "NK" | "XK";
  soPhieu: string;
  ngay: string;
  doiTac: string;
  ghiChu?: string;
  tongTien?: number;
  nguon: string;
}): Promise<Phieu> {
  const rows = await insert("phieu", {
    cong_trinh_id: input.congTrinhId,
    loai: input.loai,
    so_phieu: input.soPhieu,
    ngay: input.ngay,
    doi_tac: input.doiTac,
    ghi_chu: input.ghiChu || "",
    tong_tien: input.tongTien || 0,
    nguon: input.nguon,
  });
  return rows[0] as Phieu;
}

export async function getPhieuById(id: number): Promise<Phieu | null> {
  const rows = await select("phieu", { filters: `id=eq.${id}` });
  return (rows[0] as Phieu) ?? null;
}

/** Gắn thêm ảnh chứng từ (nhập kho) vào phiếu — cộng dồn vào danh sách hiện có. */
export async function addAnhPhieu(id: number, urls: string[]): Promise<Phieu> {
  const phieu = await getPhieuById(id);
  if (!phieu) throw new Error(`Không tìm thấy phiếu id=${id}`);
  const anhUrls = [...(phieu.anh_urls || []), ...urls];
  const rows = await update("phieu", { anh_urls: anhUrls }, `id=eq.${id}`);
  return rows[0] as Phieu;
}

/** Gỡ 1 ảnh chứng từ khỏi phiếu (chỉ cập nhật Firestore — xóa file thật do route gọi riêng). */
export async function removeAnhPhieu(id: number, url: string): Promise<Phieu> {
  const phieu = await getPhieuById(id);
  if (!phieu) throw new Error(`Không tìm thấy phiếu id=${id}`);
  const anhUrls = (phieu.anh_urls || []).filter((u) => u !== url);
  const rows = await update("phieu", { anh_urls: anhUrls }, `id=eq.${id}`);
  return rows[0] as Phieu;
}

export { pushChiTiet as pushChiTietPhieu };
