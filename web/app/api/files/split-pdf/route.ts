import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { AuthError, ForbiddenError, requireSession } from "@/lib/session";
import { splitAndSave } from "@/lib/pdf/splitter";
import { apiError } from "@/lib/api-error";

/**
 * Port từ api/routers/files.py::split_pdf. Upload PDF → tách theo phiếu →
 * 1 file → trả trực tiếp; nhiều file → zip. Toàn bộ xử lý trong bộ nhớ
 * (không ghi đĩa tạm như bản gốc — xem lib/pdf/splitter.ts). Thêm
 * requireSession() (bản gốc không có auth check nào).
 */
export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ detail: "Thiếu file" }, { status: 400 });

    const loai = ((formData.get("loai") as string) || "NK") === "XK" ? "XK" : "NK";
    const soPhieu = (formData.get("so_phieu") as string) || "";
    const ngay = (formData.get("ngay") as string) || "";
    const doiTac = (formData.get("doi_tac") as string) || "";
    const apiKeyQuery = req.nextUrl.searchParams.get("api_key");
    const apiKey = apiKeyQuery || process.env.CLAUDE_API_KEY || undefined;

    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await splitAndSave({ buffer, filename: file.name || "upload.pdf", loai, soPhieu, ngay, doiTac, apiKey });

    if (result.saved.length === 0) {
      return NextResponse.json({ detail: "Không tách được file PDF. Kiểm tra lại định dạng." }, { status: 422 });
    }

    if (result.saved.length === 1) {
      const only = result.saved[0];
      return new NextResponse(new Blob([new Uint8Array(only.bytes) as unknown as BlobPart]), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${only.filename}"`,
          "X-Split-Summary": result.summary,
          "X-Files-Count": "1",
        },
      });
    }

    const zip = new JSZip();
    for (const s of result.saved) zip.file(s.filename, s.bytes);
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    return new NextResponse(new Blob([zipBuffer as unknown as BlobPart]), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="phieu_tach.zip"',
        "X-Split-Summary": result.summary,
        "X-Files-Count": String(result.saved.length),
      },
    });
  } catch (err) {
    if (err instanceof AuthError || err instanceof ForbiddenError) return apiError(err);
    if (err instanceof Error) {
      return NextResponse.json({ detail: `Lỗi tách PDF: ${err.message}` }, { status: 500 });
    }
    return apiError(err);
  }
}
