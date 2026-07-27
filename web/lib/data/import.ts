import "server-only";
import * as XLSX from "xlsx";
import { select, insert } from "@/lib/firestore/client";
import { createPhieuForAdjustment, pushChiTietPhieu } from "@/lib/data/phieu";

// Port từ api/routers/import_data.py — Import hàng loạt từ file Excel (sheet QLTK).

interface HangHoaRow {
  ten: string;
  dvt: string;
}
interface ItemGroupRow {
  ten_hang: string;
  dvt: string;
  so_luong: number;
  don_gia: number;
  thanh_tien: number;
  ghi_chu: string;
}
interface PhieuGroup {
  ngay: string;
  doiTac: string;
  items: ItemGroupRow[];
}

function toDate(val: unknown, fallback = "2025-01-01"): string {
  if (val === null || val === undefined) return fallback;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  return s.length >= 10 ? s.slice(0, 10) : fallback;
}

/** Port từ _parse_qltk() — cột A:B = Danh mục, H:L = Nhập kho, N:R = Xuất kho.
 * Nhóm theo (ngay, đối tác) — giữ ngay/đối tác trong value thay vì mã hóa vào
 * chuỗi khóa rồi tách lại, vì tên đối tác có thể chứa khoảng trắng (vd "Công
 * ty ABC") sẽ bị cắt sai nếu tách bằng split(" "). */
function parseQLTK(rows: unknown[][]): {
  hangHoaList: HangHoaRow[];
  nhapGroups: Map<string, PhieuGroup>;
  xuatGroups: Map<string, PhieuGroup>;
} {
  // openpyxl min_row=4 (1-indexed) → bỏ qua 3 dòng đầu (header) — rows ở đây đã 0-indexed từ sheet_to_json header:1.
  const dataRows = rows.slice(3);

  const hangHoaList: HangHoaRow[] = [];
  for (const row of dataRows) {
    const ten = row[0];
    if (ten && String(ten).trim()) {
      hangHoaList.push({ ten: String(ten).trim(), dvt: row[1] ? String(row[1]).trim() : "cái" });
    }
  }

  const nhapGroups = new Map<string, PhieuGroup>();
  let lastDateNK: unknown = null;
  for (const row of dataRows) {
    if (!row[7]) continue;
    if (row[9]) lastDateNK = row[9];
    const ngay = toDate(lastDateNK);
    const ncc = row[11] ? String(row[11]).trim() : "";
    const key = JSON.stringify([ngay, ncc]);
    if (!nhapGroups.has(key)) nhapGroups.set(key, { ngay, doiTac: ncc, items: [] });
    nhapGroups.get(key)!.items.push({
      ten_hang: String(row[7]).trim(),
      dvt: row[8] ? String(row[8]).trim() : "cái",
      so_luong: row[10] ? Number(row[10]) : 0,
      don_gia: 0,
      thanh_tien: 0,
      ghi_chu: "",
    });
  }

  const xuatGroups = new Map<string, PhieuGroup>();
  let lastDateXK: unknown = null;
  for (const row of dataRows) {
    if (!row[13]) continue;
    if (row[15]) lastDateXK = row[15];
    const ngay = toDate(lastDateXK);
    const nguoi = row[17] ? String(row[17]).trim() : "";
    const key = JSON.stringify([ngay, nguoi]);
    if (!xuatGroups.has(key)) xuatGroups.set(key, { ngay, doiTac: nguoi, items: [] });
    xuatGroups.get(key)!.items.push({
      ten_hang: String(row[13]).trim(),
      dvt: row[14] ? String(row[14]).trim() : "cái",
      so_luong: row[16] ? Number(row[16]) : 0,
      don_gia: 0,
      thanh_tien: 0,
      ghi_chu: "",
    });
  }

  return { hangHoaList, nhapGroups, xuatGroups };
}

function readQLTKSheet(buffer: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  if (!wb.SheetNames.includes("QLTK")) {
    throw new Error("File không có sheet QLTK");
  }
  const ws = wb.Sheets["QLTK"];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];
}

export function previewImport(buffer: ArrayBuffer) {
  const rows = readQLTKSheet(buffer);
  const { hangHoaList, nhapGroups, xuatGroups } = parseQLTK(rows);
  const dongNk = [...nhapGroups.values()].reduce((s, v) => s + v.items.length, 0);
  const dongXk = [...xuatGroups.values()].reduce((s, v) => s + v.items.length, 0);
  return {
    ok: true,
    hang_hoa: hangHoaList.length,
    phieu_nk: nhapGroups.size,
    dong_nk: dongNk,
    phieu_xk: xuatGroups.size,
    dong_xk: dongXk,
  };
}

export async function executeImport(buffer: ArrayBuffer, congTrinhId: number) {
  const rows = readQLTKSheet(buffer);
  const { hangHoaList, nhapGroups, xuatGroups } = parseQLTK(rows);

  let hhOk = 0;
  let hhErr = 0;
  let nkOk = 0;
  let nkErr = 0;
  let xkOk = 0;
  let xkErr = 0;

  // 1. Danh mục hàng hóa — bỏ qua tên đã tồn tại trong công trình.
  let existing = new Set<string>();
  try {
    const rows2 = await select("hang_hoa", { query: "ten_hang", filters: `cong_trinh_id=eq.${congTrinhId}` });
    existing = new Set(rows2.map((r) => r.ten_hang as string));
  } catch {
    // bỏ qua — nếu lỗi, coi như chưa có gì tồn tại (giữ đúng hành vi try/except pass của bản gốc)
  }

  const toInsert = hangHoaList
    .filter((h) => !existing.has(h.ten))
    .map((h, i) => ({
      ma_hang: `HH-${String(i + 1).padStart(4, "0")}-${Math.floor(Date.now() / 1000) % 10000}`,
      ten_hang: h.ten,
      dvt: h.dvt,
      nhom: "Vật tư",
      cong_trinh_id: congTrinhId,
    }));

  const BATCH = 50;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    try {
      await insert("hang_hoa", batch);
      hhOk += batch.length;
    } catch {
      for (const item of batch) {
        try {
          await insert("hang_hoa", { ...item, ma_hang: `${item.ma_hang}-${hhErr}` });
          hhOk++;
        } catch {
          hhErr++;
        }
      }
    }
  }

  // 2. Phiếu Nhập kho
  let idx = 0;
  for (const group of nhapGroups.values()) {
    idx++;
    const soPhieu = `NK-IMP-${String(idx).padStart(4, "0")}`;
    try {
      const phieu = await createPhieuForAdjustment({ congTrinhId, loai: "NK", soPhieu, ngay: group.ngay, doiTac: group.doiTac, ghiChu: "Import từ Excel", tongTien: 0, nguon: "import" });
      if (phieu) {
        await pushChiTietPhieu(phieu.id, group.items);
        nkOk++;
      } else {
        nkErr++;
      }
    } catch {
      nkErr++;
    }
  }

  // 3. Phiếu Xuất kho
  idx = 0;
  for (const group of xuatGroups.values()) {
    idx++;
    const soPhieu = `XK-IMP-${String(idx).padStart(4, "0")}`;
    try {
      const phieu = await createPhieuForAdjustment({ congTrinhId, loai: "XK", soPhieu, ngay: group.ngay, doiTac: group.doiTac, ghiChu: "Import từ Excel", tongTien: 0, nguon: "import" });
      if (phieu) {
        await pushChiTietPhieu(phieu.id, group.items);
        xkOk++;
      } else {
        xkErr++;
      }
    } catch {
      xkErr++;
    }
  }

  return {
    ok: true,
    hang_hoa: { thanh_cong: hhOk, loi: hhErr },
    nhap_kho: { thanh_cong: nkOk, loi: nkErr },
    xuat_kho: { thanh_cong: xkOk, loi: xkErr },
  };
}
