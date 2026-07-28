import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getCongTrinhById, updateCongTrinh, deleteCongTrinh } from "@/lib/data/cong-trinh";
import { apiError } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const row = await getCongTrinhById(Number(id));
    if (!row) return NextResponse.json({ detail: `Khong tim thay id=${id}` }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await req.json();
    const row = await updateCongTrinh(Number(id), { tenCt: body.ten_ct, diaChi: body.dia_chi, ghiChu: body.ghi_chu });
    return NextResponse.json(row ?? { success: true, id: Number(id) });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteCongTrinh(Number(id));
    return NextResponse.json({ success: true, id: Number(id) });
  } catch (err) {
    return apiError(err);
  }
}
