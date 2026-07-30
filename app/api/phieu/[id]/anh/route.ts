import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { addAnhPhieu, removeAnhPhieu } from "@/lib/data/phieu";
import { apiError } from "@/lib/api-error";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";

const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

/** Upload 1 file lên R2, trả về URL phục vụ qua chính app (bucket private, xem app/api/files). */
async function uploadOne(phieuId: number, file: File): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error(`File "${file.name}" không phải ảnh JPG/PNG`);
  if (file.size > MAX_SIZE) throw new Error(`Ảnh "${file.name}" vượt quá 4MB`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `phieu-anh/${phieuId}/${randomUUID()}.${ext}`;
  await uploadToR2(key, buffer, file.type);
  return `/api/files/${key}`;
}

/** Lấy lại key trong bucket từ 1 URL đã sinh ở uploadOne() (dạng /api/files/<key>). */
function keyFromServingUrl(url: string): string | null {
  const prefix = "/api/files/";
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const phieuId = Number(id);

    const formData = await req.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new Error("Không có file nào được gửi lên");

    const urls: string[] = [];
    for (const file of files) urls.push(await uploadOne(phieuId, file));

    const phieu = await addAnhPhieu(phieuId, urls);
    return NextResponse.json({ anh_urls: phieu.anh_urls || [] });
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
