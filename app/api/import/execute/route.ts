import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { executeImport } from "@/lib/data/import";
import { apiError } from "@/lib/api-error";

// Import file lớn (nhiều phiếu) có thể vượt giới hạn thời gian chạy của Vercel
// Serverless Function (10s Hobby / 60s Pro) — rủi ro đã tồn tại từ bản Python gốc
// (cùng nền tảng Vercel), không phải lỗi mới phát sinh khi port. Chưa xử lý bằng
// hàng đợi nền ở đây vì ngoài phạm vi port 1:1.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const formData = await req.formData();
    const file = formData.get("file");
    const congTrinhId = formData.get("cong_trinh_id");
    if (!(file instanceof File)) return NextResponse.json({ detail: "Thiếu file" }, { status: 400 });
    if (!congTrinhId) return NextResponse.json({ detail: "Thiếu cong_trinh_id" }, { status: 400 });
    const buffer = await file.arrayBuffer();
    const result = await executeImport(buffer, Number(congTrinhId));
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message.includes("QLTK")) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    return apiError(err);
  }
}
