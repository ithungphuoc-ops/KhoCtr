import { randomUUID } from "crypto";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { addAnhPhieu, removeAnhPhieu, getPhieuById } from "@/lib/data/phieu";
import { getCongTrinhById } from "@/lib/data/cong-trinh";
import { apiError } from "@/lib/api-error";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";

// Nhận ảnh gốc rộng rãi (ảnh chụp điện thoại thường 3-8MB) — sẽ nén lại
// trước khi lưu, không cần chặn gắt ở mức nhỏ như trước.
const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

/** Thay / hoặc \ trong tên công trình bằng "-" để không vô tình tạo thêm cấp thư mục ngoài ý muốn. */
function sanitizeFolderName(name: string): string {
  const cleaned = name.trim().replace(/[/\\]+/g, "-");
  return cleaned || "khac";
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function decodeKey(encoded: string): string {
  return encoded.split("/").map(decodeURIComponent).join("/");
}

/**
 * Upload 1 file lên R2 (nhóm theo tên công trình của phiếu) — resize cạnh dài
 * tối đa 1600px + nén JPEG chất lượng 75 trước khi lưu (giảm dung lượng
 * nhiều, vẫn đọc rõ chữ/số trên chứng từ). Output luôn là JPEG, kể cả input
 * là PNG — ảnh chụp chứng từ không cần nền trong suốt, JPEG nén tốt hơn hẳn.
 */
async function uploadOne(phieuId: number, congTrinhFolder: string, file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error(`File "${file.name}" không phải ảnh JPG/PNG`);
  if (file.size > MAX_SIZE) throw new Error(`Ảnh "${file.name}" vượt quá 15MB`);

  const original = Buffer.from(await file.arrayBuffer());
  const compressed = await sharp(original)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();

  const key = `${congTrinhFolder}/phieu-anh/${phieuId}/${randomUUID()}.jpg`;
  await uploadToR2(key, compressed, "image/jpeg");
  return `/api/files/${encodeKey(key)}`;
}

/** Lấy lại key gốc trong bucket từ 1 URL đã sinh ở uploadOne() (dạng /api/files/<key đã encode>). */
function keyFromServingUrl(url: string): string | null {
  const prefix = "/api/files/";
  return url.startsWith(prefix) ? decodeKey(url.slice(prefix.length)) : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const phieuId = Number(id);

    const formData = await req.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new Error("Không có file nào được gửi lên");

    const phieu = await getPhieuById(phieuId);
    if (!phieu) throw new Error(`Không tìm thấy phiếu id=${phieuId}`);
    const congTrinh = await getCongTrinhById(phieu.cong_trinh_id);
    const congTrinhFolder = sanitizeFolderName(congTrinh?.ten_ct || "khac");

    const urls: string[] = [];
    for (const file of files) urls.push(await uploadOne(phieuId, congTrinhFolder, file));

    const updated = await addAnhPhieu(phieuId, urls);
    return NextResponse.json({ anh_urls: updated.anh_urls || [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const url = req.nextUrl.searchParams.get("url");
    if (!url) throw new Error("Thiếu tham số url");

    const phieu = await removeAnhPhieu(Number(id), url);

    const key = keyFromServingUrl(url);
    if (key) await deleteFromR2(key);

    return NextResponse.json({ anh_urls: phieu.anh_urls || [] });
  } catch (err) {
    return apiError(err);
  }
}
