import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { getFromR2 } from "@/lib/r2";

/**
 * Cầu nối duy nhất để xem file trên R2 (bucket private, không có domain công
 * khai — xem lib/r2.ts). Yêu cầu đăng nhập như mọi route khác trong app.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    await requireSession();
    const { path } = await params;
    const key = path.join("/");

    const file = await getFromR2(key);
    if (!file) return NextResponse.json({ detail: "Không tìm thấy file" }, { status: 404 });

    return new NextResponse(Buffer.from(file.body), {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
