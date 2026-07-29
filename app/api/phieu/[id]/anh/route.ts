import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { addAnhPhieu, removeAnhPhieu } from "@/lib/data/phieu";
import { apiError } from "@/lib/api-error";
import { adminStorage } from "@/lib/firebase/admin";

const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

/** Upload 1 file lên Storage, trả về URL kiểu Firebase download-URL (dùng được lâu dài, không hết hạn). */
async function uploadOne(phieuId: number, file: File): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error(`File "${file.name}" không phải ảnh JPG/PNG`);
  if (file.size > MAX_SIZE) throw new Error(`Ảnh "${file.name}" vượt quá 4MB`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `phieu-anh/${phieuId}/${randomUUID()}.${ext}`;
  const token = randomUUID();
  const bucket = adminStorage.bucket();
  await bucket.file(path).save(buffer, {
    contentType: file.type,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

/** Lấy lại đúng path trong bucket từ 1 URL download đã sinh ở uploadOne(). */
function pathFromDownloadUrl(url: string): string | null {
  const match = url.match(/\/o\/([^?]+)\?/);
  return match ? decodeURIComponent(match[1]) : null;
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

    // Xóa file thật trên Storage — không chặn response nếu lỗi (VD: đã bị xóa từ trước).
    const path = pathFromDownloadUrl(url);
    if (path) {
      try {
        await adminStorage.bucket().file(path).delete({ ignoreNotFound: true });
      } catch {
        // Firestore đã cập nhật đúng rồi — bỏ qua lỗi xóa file vật lý.
      }
    }

    return NextResponse.json({ anh_urls: phieu.anh_urls || [] });
  } catch (err) {
    return apiError(err);
  }
}
