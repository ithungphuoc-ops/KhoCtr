import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 (tương thích chuẩn S3) — nơi lưu ảnh chứng từ phiếu. Bucket
 * để private (không gắn domain công khai), app tự làm cầu nối qua
 * app/api/files/[...path]/route.ts — đúng nguyên tắc "không client nào truy
 * cập thẳng nơi lưu trữ" đang áp dụng cho Firestore (xem lib/firebase/admin.ts).
 */

const BUCKET = process.env.R2_BUCKET || "hpcons-khoctr";
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "a3417f8468f57bff76623213ce1b303c";

let client: S3Client | undefined;

function getClient(): S3Client {
  if (client) return client;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Thiếu R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY trong environment");
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await getClient().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}

export async function getFromR2(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
  try {
    const res = await getClient().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body?.transformToByteArray();
    if (!body) return null;
    return { body, contentType: res.ContentType || "application/octet-stream" };
  } catch (err) {
    if (err instanceof Error && err.name === "NoSuchKey") return null;
    throw err;
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // Bỏ qua lỗi xóa file vật lý (VD: đã bị xóa từ trước) — Firestore đã cập nhật đúng ở nơi gọi.
  }
}

/** Lấy lại key gốc trong bucket từ 1 URL serving dạng /api/files/<key đã encode> (xem app/api/files/[...path]/route.ts). */
export function keyFromServingUrl(url: string): string | null {
  const prefix = "/api/files/";
  if (!url.startsWith(prefix)) return null;
  return url
    .slice(prefix.length)
    .split("/")
    .map(decodeURIComponent)
    .join("/");
}
