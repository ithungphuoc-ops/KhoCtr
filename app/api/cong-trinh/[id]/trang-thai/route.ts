import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { updateTrangThaiCongTrinh } from "@/lib/data/cong-trinh";
import { apiError } from "@/lib/api-error";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await req.json();
    if (body.trang_thai !== "hoat_dong" && body.trang_thai !== "hoan_thanh") {
      return NextResponse.json({ detail: "trang_thai phai la 'hoat_dong' hoac 'hoan_thanh'" }, { status: 400 });
    }
    await updateTrangThaiCongTrinh(Number(id), body.trang_thai);
    return NextResponse.json({ success: true, id: Number(id), trang_thai: body.trang_thai });
  } catch (err) {
    return apiError(err);
  }
}
