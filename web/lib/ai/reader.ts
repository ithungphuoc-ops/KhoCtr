import "server-only";

/**
 * Port từ api/ai_reader.py — ĐƠN GIẢN HÓA có chủ đích so với bản gốc:
 * bản Python dùng PyMuPDF (fitz) để render PDF thành ảnh PNG trước khi gửi
 * cho Claude/OpenAI (đọc chữ viết tay tốt hơn) + Anthropic Files API để xử
 * lý PDF nhiều trang theo batch. Node không có PyMuPDF tương đương, và việc
 * viết renderer PDF→ảnh (pdfjs-dist + canvas) là hạng mục riêng tốn nhiều
 * công — ngoài phạm vi lần port này (xem tasks.md GĐ4).
 *
 * Bản port này gửi thẳng file gốc (base64) cho Gemini/Claude — CẢ HAI đều hỗ
 * trợ nhận PDF trực tiếp qua API (Gemini: inlineData; Claude: content block
 * "document"), khớp đúng nhánh fallback đã có sẵn trong code gốc khi không
 * có fitz. Quality đọc chữ viết tay có thể kém hơn bản PNG 2-3x nhưng vẫn
 * hoạt động đúng cho phiếu in/scan rõ. OpenAI Chat Completions KHÔNG nhận
 * PDF trực tiếp (chỉ ảnh) — tạm thời chặn PDF cho provider này, báo lỗi rõ
 * ràng thay vì để lỗi API khó hiểu.
 */

export interface PhieuItem {
  ten_hang: string;
  dvt: string;
  so_luong: number;
  don_gia: number;
}

export interface PhieuData {
  so_phieu: string;
  ngay: string;
  doi_tac: string;
  ghi_chu: string;
  items: PhieuItem[];
}

type DateMode = "auto" | "signature" | "signature_priority";
type Provider = "gemini" | "claude" | "openai";

function mimeTypeOf(filename: string): string {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function buildPrompt(loai: "NK" | "XK", dateMode: DateMode = "auto"): string {
  const loaiText = loai === "NK" ? "NHAP KHO" : "XUAT KHO";
  const dt = loai === "NK" ? "nha cung cap (NCC/NTP) da giao hang" : "noi nhan / cong trinh nhan hang";
  let dn: string;
  if (dateMode === "signature") {
    dn = "Ngay: CHI lay tu vung chu ky (goc duoi phieu). Neu khong co thi de rong.";
  } else if (dateMode === "signature_priority") {
    dn = "Ngay: UU TIEN lay tu vung chu ky (cuoi phieu). Neu khong co moi lay o dau phieu.";
  } else {
    dn = "Ngay dinh dang YYYY-MM-DD. Neu nam chi 2 chu so (vi du 26) thi them 2000. Neu khong ro thi de rong.";
  }
  return (
    `Day la phieu ${loaiText} cua cong ty xay dung HP Cons Viet Nam.\n` +
    "Phieu co the viet tay, scan, hoac chu viet tay xen chu in — hay doc ky ca chu viet tay nho.\n" +
    "Cau truc phieu gom: tieu de, so phieu, ngay, ten NCC/nguoi nhan, bang hang hoa chi tiet.\n" +
    "Neu co ca Phieu Nhap Kho (PNK) va Phieu Giao Hang/Hoa Don NCC (PGH) trong file:\n" +
    "  - Lay so_phieu, ngay, doi_tac tu PHIEU NHAP KHO\n" +
    "  - Lay items (chi tiet hang hoa) UU TIEN tu PGH/hoa don (so lieu chinh xac hon)\n" +
    "  - Neu khong co PGH thi lay items tu chinh PNK\n\n" +
    'CHI TRA VE JSON THUAN, KHONG CO BAT KY TEXT NAO KHAC, KHONG MARKDOWN:\n' +
    '{"so_phieu":"","ngay":"YYYY-MM-DD","doi_tac":"","ghi_chu":"",' +
    '"items":[{"ten_hang":"","dvt":"","so_luong":0,"don_gia":0}]}\n' +
    "Luu y quan trong:\n" +
    `- ${dn}\n` +
    `- doi_tac = ${dt}\n` +
    "- ten_hang: giu nguyen tieng Viet co dau, day du thong so ky thuat (kich thuoc, mac, loai, quy cach)\n" +
    "- dvt: don vi tinh (cai, met, kg, m2, m3, cuon, thanh, bo, hop...)\n" +
    "- so_luong va don_gia la so thuc (don_gia = 0 neu khong co gia)\n" +
    "- Trich xuat TAT CA hang hoa trong phieu, khong bo sot dong nao du it hay nhieu\n" +
    "- Neu truong nao khong doc duoc ro, de chuoi rong (khong doan mo)"
  );
}

function buildPromptMulti(loai: "NK" | "XK", dateMode: DateMode = "auto"): string {
  const loaiText = loai === "NK" ? "NHAP KHO" : "XUAT KHO";
  const dt = loai === "NK" ? "nha cung cap (NCC/NTP)" : "noi nhan / cong trinh";
  let dn: string;
  if (dateMode === "signature") {
    dn = "Ngay: CHI lay tu vung chu ky (goc duoi phieu).";
  } else if (dateMode === "signature_priority") {
    dn = "Ngay: UU TIEN lay tu vung chu ky, neu khong co moi lay o dau phieu.";
  } else {
    dn = "Ngay dinh dang YYYY-MM-DD. Neu nam 2 chu so thi them 2000.";
  }
  return (
    `File nay chua nhieu bo phieu ${loaiText} cua cong ty xay dung HP Cons Viet Nam.\n` +
    "Moi bo gom: 1 PHIEU NHAP KHO (PNK) + 1 hoac nhieu PHIEU GIAO HANG/HOA DON NCC (PGH) ngay sau no.\n" +
    "File co the viet tay, scan, chu viet tay xen chu in — hay doc ky ca chu viet tay nho.\n\n" +
    "QUY TAC XAC DINH VA GHEP CAP:\n" +
    "  - PNK: trang co chu 'Phieu Nhap Kho', 'PNK xxxx', 'NK xxxx' — trang chinh cua moi bo\n" +
    "  - PGH/Hoa don: trang co chu 'Phieu Giao Hang', 'Hoa Don', 'Invoice', 'Delivery'...\n" +
    "  - Moi PNK ghep voi tat ca PGH ngay sau no (truoc PNK tiep theo)\n\n" +
    "VOI MOI BO PNK+PGH, tao 1 object JSON — lay thong tin theo nguon:\n" +
    "  so_phieu : lay tu PNK (so PNK / PNK xxxx / NK xxxx)\n" +
    "  ngay     : lay tu PNK\n" +
    `  doi_tac  : lay tu PNK — ${dt}\n` +
    "  items    : UU TIEN lay tu PGH/hoa don (chinh xac hon); neu khong co PGH thi lay tu PNK\n\n" +
    'Tra ve JSON MANG, KHONG TEXT KHAC, KHONG MARKDOWN:\n' +
    '[{"so_phieu":"","ngay":"YYYY-MM-DD","doi_tac":"","ghi_chu":"",' +
    '"items":[{"ten_hang":"","dvt":"","so_luong":0,"don_gia":0}]}]\n' +
    "Luu y quan trong:\n" +
    `  - ${dn}\n` +
    "  - ten_hang: giu nguyen tieng Viet co dau, day du thong so ky thuat, KHONG viet tat\n" +
    "  - Trich xuat TAT CA hang hoa moi bo, khong bo sot dong nao\n" +
    "  - Moi cap PNK+PGH = 1 phan tu mang. Chi co 1 cap → mang 1 phan tu"
  );
}

function parseJsonLoose(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/g, "").trim();
  for (const ch of ["{", "["]) {
    const idx = cleaned.indexOf(ch);
    if (idx >= 0) {
      try {
        const parsed: unknown = JSON.parse(extractBalanced(cleaned, idx));
        if (Array.isArray(parsed)) return { items: parsed };
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      } catch {
        /* thử ký tự mở tiếp theo */
      }
    }
  }
  throw new Error("AI khong tra ve JSON hop le. Thu lai hoac nhap tay.");
}

function parseJsonListLoose(text: string): unknown[] {
  const cleaned = text.replace(/```json|```/g, "").trim();
  for (const ch of ["[", "{"]) {
    const idx = cleaned.indexOf(ch);
    if (idx >= 0) {
      try {
        const parsed: unknown = JSON.parse(extractBalanced(cleaned, idx));
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === "object") return [parsed];
      } catch {
        /* thử ký tự mở tiếp theo */
      }
    }
  }
  throw new Error("AI khong tra ve JSON hop le. Thu lai hoac nhap tay.");
}

/** Trích đoạn JSON cân bằng ngoặc bắt đầu từ vị trí startIdx (JSON.parse không chấp nhận text thừa phía sau). */
function extractBalanced(text: string, startIdx: number): string {
  const open = text[startIdx];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return text.slice(startIdx);
}

function normalizePhieu(parsed: Record<string, unknown>): PhieuData {
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return {
    so_phieu: String(parsed.so_phieu ?? ""),
    ngay: String(parsed.ngay ?? ""),
    doi_tac: String(parsed.doi_tac ?? ""),
    ghi_chu: String(parsed.ghi_chu ?? ""),
    items: items.map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      const soLuong = Number(it.so_luong);
      const donGia = Number(it.don_gia);
      return {
        ten_hang: String(it.ten_hang ?? ""),
        dvt: String(it.dvt ?? "cai"),
        so_luong: Number.isFinite(soLuong) ? soLuong : 0,
        don_gia: Number.isFinite(donGia) ? donGia : 0,
      };
    }),
  };
}

async function httpErrorMessage(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const obj = JSON.parse(raw) as { error?: { message?: string; status?: string } };
    const msg = obj.error?.message || raw;
    const status = obj.error?.status || "";
    return status ? `HTTP ${res.status} (${status}): ${msg}` : `HTTP ${res.status}: ${msg}`;
  } catch {
    return `HTTP ${res.status}: ${raw.slice(0, 300)}`;
  }
}

// ── Gemini — gửi thẳng file gốc (ảnh hoặc PDF), khớp bản gốc _gemini/_gemini_multi ──

async function callGemini(buffer: Buffer, filename: string, loai: "NK" | "XK", apiKey: string, dateMode: DateMode, model: string): Promise<PhieuData> {
  const mimeType = mimeTypeOf(filename);
  const prompt = buildPrompt(loai, dateMode);
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType, data: buffer.toString("base64") } }, { text: prompt }] }],
      generationConfig: { maxOutputTokens: 8000 },
    }),
  });
  if (!res.ok) {
    const msg = await httpErrorMessage(res);
    if (res.status === 429) throw new Error(`Hết quota Gemini (${model}). Thử lại sau hoặc đổi model.`);
    throw new Error(`Gemini ${msg}`);
  }
  const result = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini trả về kết quả không hợp lệ: ${JSON.stringify(result).slice(0, 200)}`);
  return normalizePhieu(parseJsonLoose(text));
}

async function callGeminiMulti(buffer: Buffer, filename: string, loai: "NK" | "XK", apiKey: string, dateMode: DateMode, model: string): Promise<PhieuData[]> {
  const mimeType = mimeTypeOf(filename);
  const prompt = buildPromptMulti(loai, dateMode);
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType, data: buffer.toString("base64") } }, { text: prompt }] }],
      generationConfig: { maxOutputTokens: 8000 },
    }),
  });
  if (!res.ok) {
    const msg = await httpErrorMessage(res);
    if (res.status === 429) throw new Error(`Hết quota Gemini (${model}). Thử lại sau hoặc đổi model.`);
    throw new Error(`Gemini ${msg}`);
  }
  const result = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini trả về kết quả không hợp lệ: ${JSON.stringify(result).slice(0, 200)}`);
  return parseJsonListLoose(text)
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map(normalizePhieu);
}

// ── Claude — gửi document/image content block trực tiếp (nhánh fallback khi không có fitz trong bản gốc) ──

async function callClaudeApi(apiKey: string, contentParts: unknown[], maxTokens = 16000): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content: contentParts }] }),
  });
  if (!res.ok) throw new Error(`Claude API lỗi: ${await httpErrorMessage(res)}`);
  const result = (await res.json()) as { content?: { text?: string }[] };
  return (result.content || []).map((c) => c.text || "").join("");
}

function claudeContentPart(buffer: Buffer, filename: string, prompt: string): unknown[] {
  const mimeType = mimeTypeOf(filename);
  const b64 = buffer.toString("base64");
  const doc =
    mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: b64 } };
  return [doc, { type: "text", text: prompt }];
}

async function callClaude(buffer: Buffer, filename: string, loai: "NK" | "XK", apiKey: string, dateMode: DateMode): Promise<PhieuData> {
  const prompt = buildPrompt(loai, dateMode);
  const text = await callClaudeApi(apiKey, claudeContentPart(buffer, filename, prompt));
  return normalizePhieu(parseJsonLoose(text));
}

async function callClaudeMulti(buffer: Buffer, filename: string, loai: "NK" | "XK", apiKey: string, dateMode: DateMode): Promise<PhieuData[]> {
  const prompt = buildPromptMulti(loai, dateMode);
  const text = await callClaudeApi(apiKey, claudeContentPart(buffer, filename, prompt));
  return parseJsonListLoose(text)
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map(normalizePhieu);
}

// ── OpenAI — Chat Completions Vision chỉ nhận ảnh, KHÔNG nhận PDF trực tiếp ──

function assertOpenAiSupportsFile(filename: string) {
  if (mimeTypeOf(filename) === "application/pdf") {
    throw new Error(
      "ChatGPT (OpenAI) chưa hỗ trợ đọc PDF trực tiếp trong bản port này — vui lòng chọn Gemini hoặc Claude cho file PDF, hoặc chuyển ảnh chụp cho ChatGPT.",
    );
  }
}

async function callOpenAiApi(apiKey: string, content: unknown[], model: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error(`Hết quota OpenAI (${model}). Kiểm tra billing tại platform.openai.com`);
    if (res.status === 401 || res.status === 403) throw new Error(`OpenAI API key không hợp lệ (HTTP ${res.status})`);
    throw new Error(`OpenAI ${await httpErrorMessage(res)}`);
  }
  const result = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenAI trả về kết quả không hợp lệ: ${JSON.stringify(result).slice(0, 200)}`);
  return text;
}

async function callOpenAi(buffer: Buffer, filename: string, loai: "NK" | "XK", apiKey: string, dateMode: DateMode, model: string): Promise<PhieuData> {
  assertOpenAiSupportsFile(filename);
  const prompt = buildPrompt(loai, dateMode);
  const mimeType = mimeTypeOf(filename);
  const content = [
    { type: "image_url", image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}`, detail: "high" } },
    { type: "text", text: prompt },
  ];
  const text = await callOpenAiApi(apiKey, content, model);
  return normalizePhieu(parseJsonLoose(text));
}

async function callOpenAiMulti(buffer: Buffer, filename: string, loai: "NK" | "XK", apiKey: string, dateMode: DateMode, model: string): Promise<PhieuData[]> {
  assertOpenAiSupportsFile(filename);
  const prompt = buildPromptMulti(loai, dateMode);
  const mimeType = mimeTypeOf(filename);
  const content = [
    { type: "image_url", image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}`, detail: "high" } },
    { type: "text", text: prompt },
  ];
  const text = await callOpenAiApi(apiKey, content, model);
  return parseJsonListLoose(text)
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map(normalizePhieu);
}

// ── Public API — port từ doc_phieu()/doc_phieu_multi() ──

export async function docPhieu(
  buffer: Buffer,
  filename: string,
  loai: "NK" | "XK",
  apiKey: string,
  provider: Provider,
  dateMode: DateMode = "auto",
  model = "gemini-1.5-flash",
): Promise<PhieuData> {
  if (provider === "gemini") return callGemini(buffer, filename, loai, apiKey, dateMode, model);
  if (provider === "openai") return callOpenAi(buffer, filename, loai, apiKey, dateMode, model);
  return callClaude(buffer, filename, loai, apiKey, dateMode);
}

export async function docPhieuMulti(
  buffer: Buffer,
  filename: string,
  loai: "NK" | "XK",
  apiKey: string,
  provider: Provider,
  dateMode: DateMode = "auto",
  model = "gemini-1.5-flash",
): Promise<PhieuData[]> {
  if (provider === "gemini") return callGeminiMulti(buffer, filename, loai, apiKey, dateMode, model);
  if (provider === "openai") return callOpenAiMulti(buffer, filename, loai, apiKey, dateMode, model);
  return callClaudeMulti(buffer, filename, loai, apiKey, dateMode);
}
