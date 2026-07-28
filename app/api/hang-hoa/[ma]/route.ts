import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { updateHangHoa, deleteHangHoa } from "@/lib/data/hang-hoa";
import { apiError } from "@/lib/api-error";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ ma: string }> }) {
  try {
    await requireSession();
    const { ma } = await params;
    const body = await req.json();
    const data = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== null && v !== undefined));
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ detail: "Không có trường nào để cập nhật" }, { status: 400 });
    }
    const row = await updateHangHoa(ma, data);
    if (!row) return NextResponse.json({ detail: `Không tìm thấy mã hàng: ${ma}` }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ ma: string }> }) {
  try {
    await requireSession();
    const { ma } = await params;
    await deleteHangHoa(ma);
    return NextResponse.json({ success: true, deleted_ma_hang: ma });
  } catch (err) {
    return apiError(err);
  }
}
