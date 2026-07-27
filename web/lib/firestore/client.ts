import "server-only";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Port TypeScript của api/firestore_client.py (mini-PostgREST query engine tự
 * viết cho Firestore) — giữ ĐÚNG hành vi bản đã vá hiệu năng 2026-07-27, KHÔNG
 * port lại bản gốc chưa vá (xem openspec/changes/migrate-nextjs-stack).
 *
 * Cú pháp filter giữ nguyên: "field=op.value" nối bằng "&", operator hỗ trợ
 * eq/in/is.null/ilike/gte/lte/gt/lt/or=(...)/limit=/offset=. Chỉ hỗ trợ đúng
 * tập toán tử thực sự dùng trong codebase gốc, không phải toàn bộ PostgREST.
 */

export type Row = Record<string, unknown>;

// ── Doc-ID strategy per collection (giống _resolve_doc_id trong bản Python) ──
const COUNTER_TABLES = new Set(["cong_trinh", "phieu", "app_users", "ghi_chu"]);
const NATURAL_KEY_FIELD: Record<string, string> = {
  hang_hoa: "ma_hang",
  project_ai_config: "cong_trinh_id",
};

async function incrementCounter(table: string): Promise<number> {
  const counterRef = adminDb.collection("_counters").doc(table);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? Number(snap.data()?.value ?? 0) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    return next;
  });
}

async function resolveDocId(table: string, data: Row): Promise<{ docId: string; data: Row }> {
  if (COUNTER_TABLES.has(table)) {
    if (data.id != null) {
      return { docId: String(data.id), data };
    }
    const newId = await incrementCounter(table);
    return { docId: String(newId), data: { ...data, id: newId } };
  }

  const keyField = NATURAL_KEY_FIELD[table];
  if (keyField) {
    const keyVal = data[keyField];
    if (!keyVal) throw new Error(`${table}: thiếu '${keyField}' — bắt buộc làm doc ID`);
    return { docId: String(keyVal), data };
  }

  return { docId: adminDb.collection(table).doc().id, data };
}

// ── Filter parser ────────────────────────────────────────────
type Condition = { field: string; op: string; value: string };

function parseCondition(cond: string): Condition {
  let field: string, rest: string;
  if (cond.includes("=")) {
    [field, rest] = splitOnce(cond, "=");
  } else {
    [field, rest] = splitOnce(cond, ".");
  }
  let op = "eq", value = rest;
  if (rest.includes(".")) {
    [op, value] = splitOnce(rest, ".");
  }
  return { field, op, value: decodeURIComponent(value) };
}

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i + sep.length)];
}

function inOpts(value: string): Set<string> {
  return new Set(value.replace(/^\(|\)$/g, "").split(","));
}

// Field số nguyên thật trong schema (id/FK) — ép kiểu để so khớp đúng giá trị int lưu trong document.
const NUMERIC_FIELDS = new Set(["id", "cong_trinh_id", "phieu_id", "user_id"]);

function coerce(field: string, value: string): string | number {
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

function splitFilterParts(filters: string): string[] {
  return filters.split("&").filter((p) => p && !p.startsWith("limit=") && !p.startsWith("offset="));
}

function docToRow(doc: FirebaseFirestore.QueryDocumentSnapshot): Row {
  const row = (doc.data() as Row) ?? {};
  if (row.id === undefined) row.id = doc.id;
  return row;
}

/**
 * Nếu filters (bỏ qua limit=/offset=) chỉ gồm ĐÚNG 1 điều kiện eq hoặc in trên
 * 1 field, dùng Firestore where() thật — chỉ tải về đúng document cần, KHÔNG
 * quét toàn bộ collection. Trả null nếu không áp dụng được.
 */
async function tryNativeQuery(table: string, filters: string): Promise<Row[] | null> {
  const parts = splitFilterParts(filters);
  if (parts.length !== 1 || parts[0].startsWith("or=(")) return null;
  const { field, op, value } = parseCondition(parts[0]);
  try {
    if (op === "eq") {
      const snap = await adminDb.collection(table).where(field, "==", coerce(field, value)).get();
      return snap.docs.map(docToRow);
    }
    if (op === "in") {
      const opts = [...inOpts(value)];
      if (opts.length === 0 || opts.length > 30) return null; // giới hạn "in" của Firestore
      const snap = await adminDb
        .collection(table)
        .where(field, "in", opts.map((v) => coerce(field, v)))
        .get();
      return snap.docs.map(docToRow);
    }
  } catch {
    return null; // field chưa có index/lỗi khác -> fallback an toàn
  }
  return null;
}

/**
 * Fallback cho 2+ điều kiện (vd cong_trinh_id=eq.X kèm tìm kiếm or=(...)) —
 * tìm 1 điều kiện eq/in bất kỳ để dùng where() thu hẹp trước, chỉ lọc phần
 * CÒN LẠI bằng JS trên tập đã thu hẹp — thay vì quét nguyên collection.
 * Vá hiệu năng 2026-07-27 (xem api/firestore_client.py::_native_prefilter).
 */
async function nativePrefilter(
  table: string,
  filters: string,
): Promise<{ rows: Row[]; remainingParts: string[] } | null> {
  const parts = splitFilterParts(filters);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("or=(")) continue;
    const { field, op, value } = parseCondition(part);
    try {
      let rows: Row[];
      if (op === "eq") {
        const snap = await adminDb.collection(table).where(field, "==", coerce(field, value)).get();
        rows = snap.docs.map(docToRow);
      } else if (op === "in") {
        const opts = [...inOpts(value)];
        if (opts.length === 0 || opts.length > 30) continue;
        const snap = await adminDb
          .collection(table)
          .where(field, "in", opts.map((v) => coerce(field, v)))
          .get();
        rows = snap.docs.map(docToRow);
      } else {
        continue;
      }
      return { rows, remainingParts: [...parts.slice(0, i), ...parts.slice(i + 1)] };
    } catch {
      continue;
    }
  }
  return null;
}

function matchValue(rowVal: unknown, op: string, value: string, field = ""): boolean {
  // 'id=gte.0' trong codebase này chỉ có 1 ý nghĩa thực tế: khớp TOÀN BỘ bản ghi
  // (vd save_permissions xóa sạch user_congtrinh trước khi ghi lại).
  if (field === "id" && op === "gte" && value === "0") return true;
  if (op === "is" && value === "null") return rowVal === null || rowVal === undefined;
  if (op === "in") return inOpts(value).has(String(rowVal));
  if (op === "ilike") {
    const needle = value.replace(/^\*|\*$/g, "").toLowerCase();
    return String(rowVal ?? "").toLowerCase().includes(needle);
  }
  if (op === "eq") return String(rowVal) === String(value);
  if (op === "gte" || op === "lte" || op === "gt" || op === "lt") {
    const a = Number(rowVal ?? 0);
    const b = Number(value);
    const [an, bn] = Number.isFinite(a) && Number.isFinite(b) ? [a, b] : [NaN, NaN];
    if (Number.isNaN(an)) {
      const as = String(rowVal ?? ""), bs = String(value);
      if (op === "gte") return as >= bs;
      if (op === "lte") return as <= bs;
      if (op === "gt") return as > bs;
      return as < bs;
    }
    if (op === "gte") return an >= bn;
    if (op === "lte") return an <= bn;
    if (op === "gt") return an > bn;
    return an < bn;
  }
  return false;
}

function rowMatches(row: Row, filters: string): boolean {
  if (!filters) return true;
  const parts = splitFilterParts(filters);
  for (const part of parts) {
    if (part.startsWith("or=(")) {
      const orConds = part
        .slice("or=(".length, -1)
        .split(",")
        .map(parseCondition);
      if (!orConds.some((c) => matchValue(row[c.field], c.op, c.value, c.field))) return false;
      continue;
    }
    const { field, op, value } = parseCondition(part);
    if (!matchValue(row[field], op, value, field)) return false;
  }
  return true;
}

function parsePagination(filters: string): { limit: number | null; offset: number } {
  let limit: number | null = null;
  let offset = 0;
  for (const part of (filters || "").split("&")) {
    if (part.startsWith("limit=")) limit = Number(part.slice("limit=".length));
    else if (part.startsWith("offset=")) offset = Number(part.slice("offset=".length));
  }
  return { limit, offset };
}

function orderKey(fieldSpec: string): { field: string; reverse: boolean } {
  const [field, direction] = splitOnce(fieldSpec, ".");
  return { field, reverse: direction === "desc" };
}

// ── Cache đọc toàn bộ collection (TTL theo bảng) ────────────────
const COLLECTION_CACHE = new Map<string, { at: number; rows: Row[] }>();
const DEFAULT_CACHE_TTL_MS = 8_000;
// Bảng ít ghi (chỉ đổi khi admin sửa danh mục/công trình) — TTL dài hơn để tăng
// tỉ lệ cache hit khi người dùng bấm qua lại tab (khớp api/firestore_client.py).
const CACHE_TTL_OVERRIDES_MS: Record<string, number> = {
  hang_hoa: 60_000,
  cong_trinh: 60_000,
  project_ai_config: 60_000,
};

async function fetchCollectionRows(table: string): Promise<Row[]> {
  const now = Date.now();
  const ttl = CACHE_TTL_OVERRIDES_MS[table] ?? DEFAULT_CACHE_TTL_MS;
  const cached = COLLECTION_CACHE.get(table);
  if (cached && now - cached.at < ttl) return cached.rows.map((r) => ({ ...r }));

  const snap = await adminDb.collection(table).get();
  const rows = snap.docs.map(docToRow);
  COLLECTION_CACHE.set(table, { at: now, rows });
  return rows.map((r) => ({ ...r }));
}

function invalidateCache(table: string): void {
  COLLECTION_CACHE.delete(table);
}

// ── CRUD helpers (chữ ký giống hệt firestore_client.py) ─────────

export async function select(
  table: string,
  opts: { query?: string; filters?: string; order?: string } = {},
): Promise<Row[]> {
  const { query = "*", filters = "", order = "" } = opts;

  let rows: Row[];
  const nativeRows = await tryNativeQuery(table, filters);
  if (nativeRows !== null) {
    rows = nativeRows;
  } else {
    const prefiltered = await nativePrefilter(table, filters);
    if (prefiltered !== null) {
      rows = prefiltered.remainingParts.length
        ? prefiltered.rows.filter((r) => rowMatches(r, prefiltered.remainingParts.join("&")))
        : prefiltered.rows;
    } else {
      const all = await fetchCollectionRows(table);
      rows = all.filter((r) => rowMatches(r, filters));
    }
  }

  if (order) {
    for (const spec of order.split(",").reverse()) {
      const { field, reverse } = orderKey(spec.trim());
      rows.sort((a, b) => {
        const av = a[field], bv = b[field];
        const aMissing = av === null || av === undefined;
        const bMissing = bv === null || bv === undefined;
        if (aMissing !== bMissing) return aMissing ? -1 : 1;
        if (aMissing && bMissing) return 0;
        if (av === bv) return 0;
        const cmp = (av as string | number) < (bv as string | number) ? -1 : 1;
        return reverse ? -cmp : cmp;
      });
    }
  }

  const { limit, offset } = parsePagination(filters);
  if (offset) rows = rows.slice(offset);
  if (limit !== null) rows = rows.slice(0, limit);

  if (query && query !== "*") {
    const cols = query.split(",").map((c) => c.trim());
    rows = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
  }
  return rows;
}

export async function insert(table: string, data: Row | Row[]): Promise<Row[]> {
  const items = Array.isArray(data) ? data : [data];
  const results: Row[] = [];
  for (let i = 0; i < items.length; i += 400) {
    const batch = adminDb.batch();
    const chunk = items.slice(i, i + 400);
    const chunkResults: Row[] = [];
    for (const item of chunk) {
      const { docId, data: fullData } = await resolveDocId(table, item);
      batch.set(adminDb.collection(table).doc(docId), fullData);
      chunkResults.push({ ...fullData, id: fullData.id ?? docId });
    }
    await batch.commit();
    results.push(...chunkResults);
  }
  invalidateCache(table);
  return results;
}

export async function update(table: string, data: Row, filters: string): Promise<Row[]> {
  const matched = await select(table, { filters });
  const updated: Row[] = [];
  for (let i = 0; i < matched.length; i += 400) {
    const batch = adminDb.batch();
    const chunk = matched.slice(i, i + 400);
    for (const row of chunk) {
      batch.update(adminDb.collection(table).doc(String(row.id)), data);
    }
    await batch.commit();
    updated.push(...chunk.map((row) => ({ ...row, ...data })));
  }
  invalidateCache(table);
  return updated;
}

export async function del(table: string, filters: string): Promise<Row[]> {
  const matched = await select(table, { filters });
  for (let i = 0; i < matched.length; i += 400) {
    const batch = adminDb.batch();
    for (const row of matched.slice(i, i + 400)) {
      batch.delete(adminDb.collection(table).doc(String(row.id)));
    }
    await batch.commit();
  }
  invalidateCache(table);
  return matched;
}
