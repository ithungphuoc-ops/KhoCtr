import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAllCongTrinh, createCongTrinh } from "@/lib/data/cong-trinh";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    await requireSession();
    const rows = await getAllCongTrinh();
    return NextResponse.json({ data: rows, total: rows.length });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const row = await createCongTrinh({ maCt: body.ma_ct, tenCt: body.ten_ct, diaChi: body.dia_chi, ghiChu: body.ghi_chu });
    return NextResponse.json(row);
  } catch (err) {
    return apiError(err);
  }
}
