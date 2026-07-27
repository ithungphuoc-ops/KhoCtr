import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { previewImport } from "@/lib/data/import";
import { apiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ detail: "Thiếu file" }, { status: 400 });
    const buffer = await file.arrayBuffer();
    const result = previewImport(buffer);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message.includes("QLTK")) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    return apiError(err);
  }
}
