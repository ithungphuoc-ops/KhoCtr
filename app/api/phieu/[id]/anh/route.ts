import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { addAnhPhieu, removeAnhPhieu, getPhieuById } from "@/lib/data/phieu";
import { getCongTrinhById } from "@/lib/data/cong-trinh";
import { apiError } from "@/lib/api-error";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";

const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

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

/** Upload 1 file lên R2 (nhóm theo tên công trình của phiếu), trả về URL phục vụ qua chính app. */
async function uploadOne(phieuId: number, congTrinhFolder: string, file: File): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error(`File "${file.name}" không phải ảnh JPG/PNG`);
  if (file.size > MAX_SIZE) throw new Error(`Ảnh "${file.name}" vượt quá 4MB`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `${congTrinhFolder}/phieu-anh/${phieuId}/${randomUUID()}.${ext}`;
  await uploadToR2(key, buffer, file.type);
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
