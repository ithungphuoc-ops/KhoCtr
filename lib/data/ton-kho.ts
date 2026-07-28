import "server-only";
import { select } from "@/lib/firestore/client";
import { getPhieuList, getLichSu, createPhieuForAdjustment, pushChiTietPhieu, deleteChiTietByHang } from "@/lib/data/phieu";
import { getAllHangHoa } from "@/lib/data/hang-hoa";
import { getAllCongTrinh } from "@/lib/data/cong-trinh";
import { logActivity } from "@/lib/data/nhat-ky";

export interface TonKhoRow {
  ma_hang: string;
  ten_hang: string;
  dvt: string;
  nhom: string;
  cong_trinh_id: number;
  ma_ct: string;
  tong_nhap: number;
  tong_xuat: number;
  ton_cuoi: number;
}

/**
 * Port từ api/firestore_client.py::compute_ton_kho — tính tồn kho trực tiếp từ
 * phieu + chi_tiet_phieu, group theo (ma_hang hoặc ten_hang, cong_trinh_id).
 */
export async function computeTonKho(congTrinhId?: number): Promise<TonKhoRow[]> {
  const phieuList = await getPhieuList({ congTrinhId, limit: 10000 });
  if (phieuList.length === 0) return [];

  const phieuMap = new Map(phieuList.map((p) => [p.id, p]));
  const phieuIdSet = new Set(phieuMap.keys());

  // Port 1:1 từ compute_ton_kho() — đọc chi_tiet_phieu THÔ (giữ ma_hang gốc của dòng chi
  // tiết) để enrich đúng thứ tự ưu tiên: khớp theo ma_hang trước, rồi mới theo tên hàng.
  const allChiTiets = (await select("chi_tiet_phieu", {
    query: "phieu_id,ten_hang,dvt,so_luong,ma_hang",
  })) as { phieu_id: number; ten_hang: string; dvt: string; so_luong: number; ma_hang: string }[];
  const chiTiets = allChiTiets.filter((r) => phieuIdSet.has(r.phieu_id));
  if (chiTiets.length === 0) return [];

  const ctList = await getAllCongTrinh();
  const ctMap = new Map(ctList.map((ct) => [ct.id, ct]));

  const hhList = await getAllHangHoa({ congTrinhId, limit: 10000 });
  const hhByName = new Map<string, (typeof hhList)[number]>();
  const hhByMa = new Map<string, (typeof hhList)[number]>();
  for (const hh of hhList) {
    const nameKey = `${(hh.ten_hang || "").trim().toLowerCase()}::${hh.cong_trinh_id}`;
    hhByName.set(nameKey, hh);
    if (hh.ma_hang) hhByMa.set(`${hh.ma_hang}::${hh.cong_trinh_id}`, hh);
  }

  const groups = new Map<string, TonKhoRow>();
  for (const row of chiTiets) {
    const pid = row.phieu_id;
    const p = phieuMap.get(pid);
    const ctId = p?.cong_trinh_id;
    if (!ctId) continue;
    const tenHang = (row.ten_hang || "").trim();
    const maHangRow = (row.ma_hang || "").trim();
    if (!tenHang && !maHangRow) continue;

    const hhInfo = maHangRow
      ? hhByMa.get(`${maHangRow}::${ctId}`) ?? hhByName.get(`${tenHang.toLowerCase()}::${ctId}`)
      : hhByName.get(`${tenHang.toLowerCase()}::${ctId}`);

    const maHang = hhInfo?.ma_hang || maHangRow;
    const groupKey = `${maHang || tenHang}::${ctId}`;

    if (!groups.has(groupKey)) {
      const ctInfo = ctMap.get(ctId);
      groups.set(groupKey, {
        ma_hang: maHang,
        ten_hang: hhInfo?.ten_hang || tenHang,
        dvt: hhInfo?.dvt || row.dvt || "",
        nhom: hhInfo?.nhom || "",
        cong_trinh_id: ctId,
        ma_ct: ctInfo?.ma_ct || "",
        tong_nhap: 0,
        tong_xuat: 0,
        ton_cuoi: 0,
      });
    }
    const g = groups.get(groupKey)!;
    const sl = Number(row.so_luong || 0);
    const loai = p?.loai;
    if (loai === "NK") g.tong_nhap += sl;
    else if (loai === "XK") g.tong_xuat += sl;
  }

  const result = [...groups.values()].map((g) => ({ ...g, ton_cuoi: g.tong_nhap - g.tong_xuat }));
  result.sort((a, b) => (a.nhom || "").localeCompare(b.nhom || "") || (a.ten_hang || "").localeCompare(b.ten_hang || ""));
  return result;
}

/** Port từ api/routers/ton_kho.py::them_hang_ton_kho — tạo phiếu NK "TD-..." để giữ dấu vết. */
export async function themHangTonKho(input: {
  congTrinhId: number;
  tenHang: string;
  dvt?: string;
  soLuong: number;
  donGia?: number;
  ghiChu?: string;
  userEmail?: string;
}): Promise<{ soPhieu: string; phieuId: number }> {
  if (!input.tenHang.trim()) throw new Error("Chưa nhập tên hàng");
  if (input.soLuong <= 0) throw new Error("Số lượng phải lớn hơn 0");

  const now = new Date();
  const soPhieu = `TD-${formatCompactDate(now)}`;
  const thanhTien = input.soLuong * (input.donGia || 0);

  const phieu = await createPhieuForAdjustment({
    congTrinhId: input.congTrinhId,
    loai: "NK",
    soPhieu,
    ngay: now.toISOString().slice(0, 10),
    doiTac: "Them hang vao kho",
    ghiChu: input.ghiChu || "Them hang truc tiep tu trang Ton kho",
    tongTien: thanhTien,
    nguon: "ton_kho",
  });
  if (!phieu) throw new Error("Không tạo được phiếu");

  await pushChiTietPhieu(phieu.id, [
    {
      ten_hang: input.tenHang.trim(),
      dvt: input.dvt || "cái",
      so_luong: input.soLuong,
      don_gia: input.donGia || 0,
      thanh_tien: thanhTien,
      ghi_chu: input.ghiChu || "",
    },
  ]);

  await logActivity({
    action: "them_hang_ton_kho",
    entityType: "ton_kho",
    entityId: soPhieu,
    details: `Them '${input.tenHang}' SL ${input.soLuong} ${input.dvt || ""} vao ton kho (phieu ${soPhieu})`,
    userEmail: input.userEmail,
    congTrinhId: input.congTrinhId,
  });

  return { soPhieu, phieuId: phieu.id };
}

/** Port từ api/routers/ton_kho.py::dieu_chinh_ton_kho — tự tạo phiếu điều chỉnh DC-... */
export async function dieuChinhTonKho(input: {
  congTrinhId: number;
  tenHang: string;
  dvt?: string;
  tonHienTai: number;
  tonMoi: number;
  ghiChu?: string;
  userEmail?: string;
}): Promise<{ soPhieu: string; loai: "NK" | "XK"; delta: number } | { delta: 0 }> {
  if (!input.tenHang.trim()) throw new Error("Chưa có tên hàng");
  const delta = input.tonMoi - input.tonHienTai;
  if (delta === 0) return { delta: 0 };

  const loai: "NK" | "XK" = delta > 0 ? "NK" : "XK";
  const now = new Date();
  const soPhieu = `DC-${formatCompactDate(now)}`;
  const ghiChu = input.ghiChu || `Dieu chinh ton: ${input.tonHienTai} -> ${input.tonMoi}`;

  const phieu = await createPhieuForAdjustment({
    congTrinhId: input.congTrinhId,
    loai,
    soPhieu,
    ngay: now.toISOString().slice(0, 10),
    doiTac: "Dieu chinh ton kho",
    ghiChu,
    tongTien: 0,
    nguon: "dieu_chinh",
  });
  if (!phieu) throw new Error("Không tạo được phiếu điều chỉnh");

  await pushChiTietPhieu(phieu.id, [
    {
      ten_hang: input.tenHang.trim(),
      dvt: input.dvt || "cái",
      so_luong: Math.abs(delta),
      don_gia: 0,
      thanh_tien: 0,
      ghi_chu: ghiChu,
    },
  ]);

  await logActivity({
    action: "dieu_chinh_ton_kho",
    entityType: "ton_kho",
    entityId: soPhieu,
    details: `Dieu chinh '${input.tenHang}': ${input.tonHienTai} -> ${input.tonMoi} (${delta > 0 ? "+" : ""}${delta} ${input.dvt || ""})`,
    userEmail: input.userEmail,
    congTrinhId: input.congTrinhId,
  });

  return { soPhieu, loai, delta };
}

/** Port từ api/routers/ton_kho.py::xoa_hang_ton_kho */
export async function xoaHangTonKho(input: { congTrinhId: number; tenHang: string; userEmail?: string }): Promise<number> {
  const deleted = await deleteChiTietByHang(input.congTrinhId, input.tenHang);
  await logActivity({
    action: "xoa_hang_ton_kho",
    entityType: "ton_kho",
    entityId: input.tenHang,
    details: `Xoa hang '${input.tenHang}' khoi ton kho CT id=${input.congTrinhId} (${deleted} dong chi tiet)`,
    userEmail: input.userEmail,
    congTrinhId: input.congTrinhId,
  });
  return deleted;
}

/** Port từ api/routers/ton_kho.py::get_lich_su_hang */
export async function getLichSuHang(opts: { tenHang: string; congTrinhId?: number; limit?: number }) {
  const { tenHang, congTrinhId, limit = 200 } = opts;
  const phieuList = await getPhieuList({ congTrinhId, limit: 10000 });
  const lichSu = await getLichSu(phieuList, 50000);
  const needle = tenHang.toLowerCase();
  const filtered = lichSu.filter((r) => (r.ten_hang || "").toLowerCase().includes(needle)).slice(0, limit);
  const tongNk = filtered.filter((r) => r.loai === "NK").reduce((s, r) => s + Number(r.so_luong || 0), 0);
  const tongXk = filtered.filter((r) => r.loai === "XK").reduce((s, r) => s + Number(r.so_luong || 0), 0);
  return { ten_hang: tenHang, tong_nhap: tongNk, tong_xuat: tongXk, ton_kho: tongNk - tongXk, lich_su: filtered, total: filtered.length };
}

function formatCompactDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${yy}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
