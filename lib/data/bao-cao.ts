import "server-only";
import { select } from "@/lib/firestore/client";
import { getPhieuList, getThongKeTong, type Phieu } from "@/lib/data/phieu";
import { computeTonKho } from "@/lib/data/ton-kho";
import { getAllHangHoa } from "@/lib/data/hang-hoa";
import { getAllCongTrinh, type CongTrinh } from "@/lib/data/cong-trinh";

/** Port từ api/routers/bao_cao.py::bao_cao_tong_hop */
export async function getBaoCaoTongHop(opts: { congTrinhId?: number; dateFrom?: string; dateTo?: string } = {}) {
  const { congTrinhId, dateFrom, dateTo } = opts;

  // 1. Phiếu KHÔNG filter date → dùng cho KPI counts
  const phieuAll = await getPhieuList({ congTrinhId, limit: 10000 });

  // 2. Phiếu CÓ filter date → dùng cho top vật tư
  const phieuDate = dateFrom || dateTo ? await getPhieuList({ congTrinhId, limit: 10000, dateFrom, dateTo }) : phieuAll;

  // 3. KPI từ phieuAll (không bị ảnh hưởng bởi date filter)
  let thongKe: Record<string, number>;
  if (congTrinhId) {
    const nkAll = phieuAll.filter((p) => p.loai === "NK");
    const xkAll = phieuAll.filter((p) => p.loai === "XK");
    thongKe = {
      so_cong_trinh: 1,
      so_phieu_nk: nkAll.length,
      so_phieu_xk: xkAll.length,
      tong_phieu: phieuAll.length,
      tong_tien_nk: nkAll.reduce((s, p) => s + Number(p.tong_tien || 0), 0),
      tong_tien_xk: xkAll.reduce((s, p) => s + Number(p.tong_tien || 0), 0),
    };
  } else {
    thongKe = await getThongKeTong();
  }

  // 4. Tồn kho + cảnh báo
  const tonKho = await computeTonKho(congTrinhId);
  const canhBao = tonKho.filter((r) => (r.ton_cuoi || 0) <= 20);

  // 5. Đếm mặt hàng
  let soMatHang: number;
  try {
    soMatHang = (await getAllHangHoa({ congTrinhId })).length;
  } catch {
    soMatHang = tonKho.length;
  }

  // 6. Top vật tư (dùng phieuDate — có filter ngày)
  const phieuMap = new Map(phieuDate.filter((p) => p.id).map((p) => [p.id, p]));
  const phieuIds = [...phieuMap.keys()];
  let chiTiets: { phieu_id: number; ten_hang: string; dvt: string; so_luong: number; thanh_tien: number }[] = [];
  if (phieuIds.length > 0) {
    chiTiets = (await select("chi_tiet_phieu", {
      query: "phieu_id,ten_hang,dvt,so_luong,thanh_tien",
      filters: `phieu_id=in.(${phieuIds.join(",")})`,
    })) as typeof chiTiets;
  }

  const hangNk = new Map<string, { so_luong: number; thanh_tien: number; dvt: string }>();
  const hangXk = new Map<string, { so_luong: number; thanh_tien: number; dvt: string }>();
  for (const r of chiTiets) {
    const p = phieuMap.get(r.phieu_id);
    if (!p) continue;
    const ten = r.ten_hang || "";
    const sl = Number(r.so_luong || 0);
    const tt = Number(r.thanh_tien || 0);
    const target = p.loai === "NK" ? hangNk : p.loai === "XK" ? hangXk : null;
    if (!target) continue;
    if (!target.has(ten)) target.set(ten, { so_luong: 0, thanh_tien: 0, dvt: r.dvt || "" });
    const entry = target.get(ten)!;
    entry.so_luong += sl;
    entry.thanh_tien += tt;
  }
  const toTop = (m: Map<string, { so_luong: number; thanh_tien: number; dvt: string }>) =>
    [...m.entries()]
      .map(([ten_hang, v]) => ({ ten_hang, ...v }))
      .sort((a, b) => b.so_luong - a.so_luong)
      .slice(0, 10);
  const topNk = toTop(hangNk);
  const topXk = toTop(hangXk);

  // 7. Bảng tổng hợp theo công trình
  const cts: CongTrinh[] = congTrinhId ? await select("cong_trinh", { filters: `id=eq.${congTrinhId}` }) as CongTrinh[] : await getAllCongTrinh();
  const ctMap = new Map<number, { so_phieu_nk: number; so_phieu_xk: number; tong_tien_nk: number; tong_tien_xk: number }>();
  for (const p of phieuAll) {
    const cid = p.cong_trinh_id;
    if (!cid) continue;
    if (!ctMap.has(cid)) ctMap.set(cid, { so_phieu_nk: 0, so_phieu_xk: 0, tong_tien_nk: 0, tong_tien_xk: 0 });
    const stats = ctMap.get(cid)!;
    const tien = Number(p.tong_tien || 0);
    if (p.loai === "NK") {
      stats.so_phieu_nk += 1;
      stats.tong_tien_nk += tien;
    } else if (p.loai === "XK") {
      stats.so_phieu_xk += 1;
      stats.tong_tien_xk += tien;
    }
  }
  const bangCt = cts.map((ct) => ({
    ...ct,
    ...(ctMap.get(ct.id) ?? { so_phieu_nk: 0, so_phieu_xk: 0, tong_tien_nk: 0, tong_tien_xk: 0 }),
  }));

  const tongTienXk = thongKe.tong_tien_xk ?? 0;
  const soAmKho = tonKho.filter((r) => (r.ton_cuoi || 0) < 0).length;

  return {
    kpi: {
      ...thongKe,
      so_mat_hang: soMatHang,
      so_canh_bao: tonKho.filter((r) => (r.ton_cuoi || 0) <= 0).length,
      so_canh_bao_thap: canhBao.length,
      tong_tien_xk: tongTienXk,
      so_am_kho: soAmKho,
    },
    top_vat_tu_nk: topNk,
    top_vat_tu_xk: topXk,
    bang_cong_trinh: bangCt,
    canh_bao_ton_thap: canhBao.slice(0, 100),
    ton_kho: tonKho.slice(0, 100),
  };
}

/** Port từ api/routers/bao_cao.py::bao_cao_theo_thang */
export async function getBaoCaoThoTang(opts: { year: number; month: number; congTrinhId?: number }) {
  const { year, month, congTrinhId } = opts;
  const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const allPhieu = await getPhieuList({ congTrinhId, limit: 10000 });
  const phieuThang = allPhieu.filter((p) => p.ngay && p.ngay >= fromDate && p.ngay < toDate);

  const phieuNk = phieuThang.filter((p) => p.loai === "NK");
  const phieuXk = phieuThang.filter((p) => p.loai === "XK");
  const tongTienNk = phieuNk.reduce((s, p) => s + Number(p.tong_tien || 0), 0);
  const tongTienXk = phieuXk.reduce((s, p) => s + Number(p.tong_tien || 0), 0);

  const phieuIdsList = phieuThang.filter((p) => p.id).map((p) => p.id);
  let ctThang: { phieu_id: number; ten_hang: string; dvt: string; so_luong: number; thanh_tien: number }[] = [];
  if (phieuIdsList.length > 0) {
    ctThang = (await select("chi_tiet_phieu", { filters: `phieu_id=in.(${phieuIdsList.join(",")})` })) as typeof ctThang;
  }

  const phieuMap = new Map(phieuThang.map((p) => [p.id, p]));
  const hangStats = new Map<string, { dvt: string; nk: number; xk: number; tien_nk: number; tien_xk: number }>();
  for (const r of ctThang) {
    const p = phieuMap.get(r.phieu_id);
    const ten = r.ten_hang || "";
    const sl = Number(r.so_luong || 0);
    const tt = Number(r.thanh_tien || 0);
    const loai = p?.loai || "";
    if (!hangStats.has(ten)) hangStats.set(ten, { dvt: r.dvt || "", nk: 0, xk: 0, tien_nk: 0, tien_xk: 0 });
    const entry = hangStats.get(ten)!;
    if (loai === "NK") {
      entry.nk += sl;
      entry.tien_nk += tt;
    } else if (loai === "XK") {
      entry.xk += sl;
      entry.tien_xk += tt;
    }
  }
  const chiTietHang = [...hangStats.entries()]
    .map(([ten_hang, v]) => ({ ten_hang, ...v }))
    .sort((a, b) => b.tien_nk + b.tien_xk - (a.tien_nk + a.tien_xk));

  return {
    thang: month,
    nam: year,
    cong_trinh_id: congTrinhId,
    tong_phieu_nk: phieuNk.length,
    tong_phieu_xk: phieuXk.length,
    tong_tien_nk: tongTienNk,
    tong_tien_xk: tongTienXk,
    phieu_nk: phieuNk,
    phieu_xk: phieuXk,
    chi_tiet_hang: chiTietHang,
  };
}

/** Port từ api/routers/bao_cao.py::bieu_do_nhap_xuat */
export async function getBieuDoNhapXuat(opts: {
  fromDate?: string;
  toDate?: string;
  period?: "day" | "week" | "month" | "year";
  congTrinhId?: number;
}) {
  const { fromDate, toDate, period = "month", congTrinhId } = opts;

  let allPhieu = await getPhieuList({ congTrinhId, limit: 10000, dateFrom: fromDate, dateTo: toDate });
  if (allPhieu.length === 0 && congTrinhId && (fromDate || toDate)) {
    allPhieu = await getPhieuList({ congTrinhId, limit: 10000 });
  }

  const buckets = new Map<string, { period: string; tong_nk: number; tong_xk: number; tong_tien_nk: number; tong_tien_xk: number }>();
  for (const p of allPhieu) {
    const ngay = p.ngay || "";
    if (!ngay) continue;
    let key: string;
    if (period === "day") key = ngay.slice(0, 10);
    else if (period === "week") key = isoWeekKey(ngay.slice(0, 10));
    else if (period === "year") key = ngay.slice(0, 4);
    else key = ngay.slice(0, 7);

    if (!buckets.has(key)) buckets.set(key, { period: key, tong_nk: 0, tong_xk: 0, tong_tien_nk: 0, tong_tien_xk: 0 });
    const b = buckets.get(key)!;
    const tien = Number(p.tong_tien || 0);
    if (p.loai === "NK") {
      b.tong_nk += 1;
      b.tong_tien_nk += tien;
    } else if (p.loai === "XK") {
      b.tong_xk += 1;
      b.tong_tien_xk += tien;
    }
  }

  const data = [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
  return { period_type: period, data, total_points: data.length };
}

function isoWeekKey(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    const target = new Date(d.valueOf());
    const dayNr = (d.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  } catch {
    return dateStr.slice(0, 7);
  }
}

export type { Phieu };
