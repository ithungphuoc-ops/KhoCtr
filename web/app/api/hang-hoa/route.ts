import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAllHangHoa, createHangHoa } from "@/lib/data/hang-hoa";
import { apiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const limit = Number(sp.get("limit") ?? 500);
    const offset = Number(sp.get("offset") ?? 0);
    const rows = await getAllHangHoa({
      congTrinhId: sp.get("cong_trinh_id") ? Number(sp.get("cong_trinh_id")) : undefined,
      search: sp.get("search") ?? undefined,
      limit,
      offset,
    });
    return NextResponse.json({ data: rows, total: rows.length, limit, offset });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const data = { ...body };
    if (!data.ma_hang) {
      const slug = (data.ten_hang || "HH").replace(/[^A-Za-z0-9]/g, "-").slice(0, 20).toUpperCase().replace(/^-+|-+$/g, "");
      data.ma_hang = `${slug}-${Date.now() % 100000}`;
    }
    const row = await createHangHoa(data);
    if (!row) return NextResponse.json({ error: "Không thể tạo mặt hàng" }, { status: 500 });
    return NextResponse.json(row);
  } catch (err) {
    return apiError(err);
  }
}
