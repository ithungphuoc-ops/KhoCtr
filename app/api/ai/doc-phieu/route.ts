import { NextRequest, NextResponse } from "next/server";
import { AuthError, ForbiddenError, requireSession } from "@/lib/session";
import { docPhieu } from "@/lib/ai/reader";
import { resolveApiKey } from "@/lib/ai/resolve-key";
import { apiError } from "@/lib/api-error";

// Port từ api/routers/ai_routes.py::doc_phieu. Bản gốc không có auth check —
// thêm requireSession() ở đây (đã upload file + gọi API AI trả phí, cần đăng
// nhập tối thiểu), khớp cách xử lý đã áp dụng cho /api/import/*.
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ detail: "Thiếu file" }, { status: 400 });

    const loai = (formData.get("loai") as string) || "NK";
    const provider = ((formData.get("provider") as string) || "gemini") as "gemini" | "claude" | "openai";
    const dateMode = ((formData.get("date_mode") as string) || "auto") as "auto" | "signature" | "signature_priority";
    const congTrinhIdRaw = formData.get("cong_trinh_id");
    const congTrinhId = congTrinhIdRaw ? Number(congTrinhIdRaw) : null;
    const apiKeyFallback = req.nextUrl.searchParams.get("api_key") || req.headers.get("x-api-key");

    const { apiKey, model } = await resolveApiKey(provider, apiKeyFallback, congTrinhId);
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await docPhieu(buffer, file.name || "upload.pdf", loai === "XK" ? "XK" : "NK", apiKey, provider, dateMode, model);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError || err instanceof ForbiddenError) return apiError(err);
    if (err instanceof Error) return NextResponse.json({ detail: err.message }, { status: 422 });
    return apiError(err);
  }
}
