import "server-only";
import { PDFDocument } from "pdf-lib";

/**
 * Port từ api/pdf_splitter.py (v4) — ĐƠN GIẢN HÓA có chủ đích so với bản gốc:
 *
 * 1. Bản gốc dùng PyMuPDF (fitz) render trang thành PNG 3x trước khi gửi AI
 *    phân loại trang (đọc chữ viết tay tốt hơn). Node không có fitz — port
 *    này LUÔN dùng nhánh fallback đã có sẵn trong code gốc khi fitz không
 *    khả dụng: cắt trang đó thành 1 PDF đơn trang, gửi thẳng cho Claude dạng
 *    "document". Đây không phải suy diễn — chính code Python gốc (dòng
 *    219-227) đã làm y hệt vậy khi `fitz_ok=False`.
 *
 * 2. Bản gốc ghi file ra thư mục tạm theo cấu trúc năm/tháng/ngày/đối tác
 *    (`_make_folder`) rồi mới đọc lại để trả về/zip. Nhưng khi zip
 *    (routers/files.py: `zf.write(path, os.path.basename(path))`), cấu trúc
 *    thư mục đó bị loại bỏ hoàn toàn — chỉ tên file phẳng được giữ trong
 *    zip. Vậy nên phần cấu trúc thư mục không ảnh hưởng gì tới kết quả cuối
 *    cùng người dùng thấy — port này bỏ hẳn bước tạo thư mục, xử lý toàn bộ
 *    trong bộ nhớ (không ghi đĩa), chỉ giữ lại tên file phẳng + logic dedupe.
 *
 * LƯU Ý: endpoint /api/files/split-pdf này không có nút gọi nào trong toàn bộ
 * frontend gốc (`splitPdf` khai báo trong api/index.js nhưng không trang nào
 * import) — port giữ nguyên hiện trạng "endpoint mồ côi", không tự thêm UI.
 */

export type Loai = "NK" | "XK";
export type PageType = "PNK" | "PGH" | "PXK" | "OTHER";

interface PageInfo {
  pageIdx: number;
  loai: PageType;
  soPhieu: string;
  ngay: string;
  ncc: string;
}

export interface SavedFile {
  type: string; // loai ("NK"/"XK") hoặc "PGH"
  filename: string;
  so_phieu: string;
  bytes: Uint8Array;
}

export interface SplitResult {
  saved: SavedFile[];
  summary: string;
}

function safeName(s: string): string {
  let out = s;
  for (const c of ['\\', "/", ":", "*", "?", '"', "<", ">", "|"]) out = out.split(c).join("_");
  return out.trim() || "Khac";
}

/** Port từ _page_type_from_text */
function pageTypeFromText(text: string): PageType {
  const t = text.toLowerCase();
  if (["phiếu nhập kho", "phieu nhap kho", "pnk", "nhập kho"].some((k) => t.includes(k))) return "PNK";
  if (
    ["phiếu giao nhận", "phieu giao nhan", "pgn", "phiếu giao hàng", "phieu giao hang", "pgh", "biên bản giao hàng", "bien ban giao hang", "bbgh", "delivery", "hóa đơn", "invoice"].some((k) =>
      t.includes(k),
    )
  )
    return "PGH";
  if (["phiếu xuất kho", "phieu xuat kho", "pxk", "xuất kho"].some((k) => t.includes(k))) return "PXK";
  return "OTHER";
}

/** Port từ _short_so — "PNK4914" → "NK4914", "NK-2026-001" → "NK001" */
function shortSo(so: string, loai: Loai): string {
  if (!so) return "";
  const m = so.match(/(\d{3,6})/);
  const num = m ? m[1] : so.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  const prefix = loai === "NK" ? "NK" : "XK";
  return `${prefix}${num}`;
}

async function extractPageText(pdfjsDoc: import("pdfjs-dist/legacy/build/pdf.mjs").PDFDocumentProxy, pageIdx: number): Promise<string> {
  try {
    const page = await pdfjsDoc.getPage(pageIdx + 1);
    const content = await page.getTextContent();
    return content.items.map((it) => ("str" in it ? it.str : "")).join(" ").toLowerCase();
  } catch {
    return "";
  }
}

/** Port từ _ai_read_page — luôn dùng nhánh "gửi PDF đơn trang trực tiếp" (fallback không-fitz của bản gốc). */
async function aiReadPage(pageBytes: Uint8Array, apiKey: string, pageNum: number, loai: Loai): Promise<{ loai: PageType; so_phieu: string; ngay: string; ncc: string }> {
  const loaiHint = loai === "NK" ? "NHAP KHO" : "XUAT KHO";
  const prompt =
    `Day la trang ${pageNum} trong bo phieu ${loaiHint} cong ty xay dung HP Cons Viet Nam.\n` +
    "Phieu co the viet tay, scan, hoac chu viet tay xen chu in — hay doc ky.\n" +
    "Xac dinh loai trang theo noi dung:\n" +
    "- PNK: co chu 'Phieu Nhap Kho', 'PNK', hoac bang hang hoa co cot Nhap\n" +
    "- PGH: co chu 'Phieu Giao Hang', 'Phieu Giao Nhan', 'Hoa Don', 'PGH', 'Invoice'\n" +
    "- PXK: co chu 'Phieu Xuat Kho', 'PXK'\n" +
    "- OTHER: khong xac dinh duoc hoac trang trong\n" +
    "Doc chu viet tay de lay so phieu (dang NK/PNK xxxx), ngay (DD/MM/YYYY), ten NCC.\n" +
    "Tra ve JSON thuan, KHONG markdown:\n" +
    '{"loai":"PNK|PGH|PXK|OTHER","so_phieu":"so phieu day du vi du NK4914","ngay":"DD/MM/YYYY","ncc":"ten NCC hoac nguoi nhan day du"}';

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(pageBytes).toString("base64") } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return { loai: "OTHER", so_phieu: "", ngay: "", ncc: `HTTP ${res.status}` };
    }
    const result = (await res.json()) as { content?: { text?: string }[] };
    let text = (result.content || []).map((c) => c.text || "").join("");
    text = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text) as { loai?: string; so_phieu?: string; ngay?: string; ncc?: string };
    const loaiVal = parsed.loai;
    const validLoai: PageType = loaiVal === "PNK" || loaiVal === "PGH" || loaiVal === "PXK" ? loaiVal : "OTHER";
    return { loai: validLoai, so_phieu: parsed.so_phieu || "", ngay: parsed.ngay || "", ncc: parsed.ncc || "" };
  } catch (e) {
    return { loai: "OTHER", so_phieu: "", ngay: "", ncc: e instanceof Error ? e.message : String(e) };
  }
}

/** Dedupe tên file trong bộ nhớ — tương đương _unique_path nhưng không đụng đĩa. */
function makeUniqueNamer() {
  const used = new Set<string>();
  return (name: string): string => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const dot = name.lastIndexOf(".");
    const stem = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : "";
    let c = 1;
    let candidate = `${stem}_${c}${ext}`;
    while (used.has(candidate)) {
      c++;
      candidate = `${stem}_${c}${ext}`;
    }
    used.add(candidate);
    return candidate;
  };
}

function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

/**
 * Tách PDF theo logic bản gốc: NK: PNK + PGH(s) → NK[số].pdf + PGH NK[số].pdf.
 * XK: mỗi trang = 1 phiếu XK[số].pdf. Ưu tiên text-extraction (miễn phí) →
 * chỉ gọi AI khi 1 trang không nhận diện được qua từ khoá VÀ có apiKey.
 */
export async function splitAndSave(input: {
  buffer: Uint8Array;
  filename: string;
  loai: Loai;
  soPhieu: string;
  ngay: string;
  doiTac: string;
  apiKey?: string;
}): Promise<SplitResult> {
  const { buffer, filename, loai, soPhieu, ngay, doiTac, apiKey } = input;
  const ext = extOf(filename);
  const uniqueName = makeUniqueNamer();

  // Không phải PDF → trả nguyên file
  if (ext !== ".pdf") {
    const soS = shortSo(soPhieu, loai) || safeName(soPhieu) || "phieu";
    const fname = uniqueName(`${soS}${ext || ".bin"}`);
    return { saved: [{ type: loai, filename: fname, so_phieu: soPhieu, bytes: buffer }], summary: `Lưu 1 file: ${fname}` };
  }

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsDoc = await pdfjsLib.getDocument({ data: buffer.slice(), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const srcDoc = await PDFDocument.load(buffer);
  const nPages = srcDoc.getPageCount();

  // ── Nhận diện từng trang ─────────────────────────────────
  const pageInfos: PageInfo[] = [];
  for (let i = 0; i < nPages; i++) {
    const text = await extractPageText(pdfjsDoc, i);
    let ptype = pageTypeFromText(text);
    let info: { so_phieu?: string; ngay?: string; ncc?: string } = {};

    if (ptype === "OTHER" && apiKey) {
      const singlePageDoc = await PDFDocument.create();
      const [copied] = await singlePageDoc.copyPages(srcDoc, [i]);
      singlePageDoc.addPage(copied);
      const pageBytes = await singlePageDoc.save();
      const aiInfo = await aiReadPage(pageBytes, apiKey, i + 1, loai);
      ptype = aiInfo.loai;
      info = aiInfo;
    }

    pageInfos.push({
      pageIdx: i,
      loai: ptype,
      soPhieu: info.so_phieu || soPhieu,
      ngay: info.ngay || ngay,
      ncc: info.ncc || doiTac,
    });
  }

  // ── Ghép nhóm ────────────────────────────────────────────
  interface Group {
    pnk: PageInfo | null;
    pghs: PageInfo[];
  }
  const groups: Group[] = [];
  if (loai === "NK") {
    let cur: Group | null = null;
    for (const inf of pageInfos) {
      if (inf.loai === "PNK") {
        if (cur) groups.push(cur);
        cur = { pnk: inf, pghs: [] };
      } else if (cur) {
        cur.pghs.push(inf);
      } else {
        groups.push({ pnk: null, pghs: [inf] });
      }
    }
    if (cur) groups.push(cur);
  } else {
    for (const inf of pageInfos) groups.push({ pnk: inf, pghs: [] });
  }

  // ── Lưu file (trong bộ nhớ) ──────────────────────────────
  const saved: SavedFile[] = [];
  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const group = groups[gIdx];
    const pnk = group.pnk;
    const pghs = group.pghs;

    const gSoRaw = pnk?.soPhieu || soPhieu || `${loai === "NK" ? "NK" : "XK"}${String(gIdx + 1).padStart(3, "0")}`;
    const gSoFile = shortSo(gSoRaw, loai) || safeName(gSoRaw);

    if (pnk) {
      const outDoc = await PDFDocument.create();
      const [copied] = await outDoc.copyPages(srcDoc, [pnk.pageIdx]);
      outDoc.addPage(copied);
      const bytes = await outDoc.save();
      const fname = uniqueName(`${gSoFile}.pdf`);
      saved.push({ type: loai, filename: fname, so_phieu: gSoRaw, bytes });
    }

    if (pghs.length > 0 && loai === "NK") {
      const outDoc2 = await PDFDocument.create();
      const copiedPages = await outDoc2.copyPages(
        srcDoc,
        pghs.map((p) => p.pageIdx),
      );
      for (const cp of copiedPages) outDoc2.addPage(cp);
      const bytes2 = await outDoc2.save();
      const fname2 = uniqueName(`PGH ${gSoFile}.pdf`);
      saved.push({ type: "PGH", filename: fname2, so_phieu: gSoRaw, bytes: bytes2 });
    }
  }

  const nMain = saved.filter((s) => s.type !== "PGH").length;
  const nPgh = saved.filter((s) => s.type === "PGH").length;
  const summary = loai === "NK" ? `Tách ${nPages} trang → ${nMain} phiếu NK + ${nPgh} phiếu PGH` : `Tách ${nPages} trang → ${nMain} phiếu XK`;

  return { saved, summary };
}
