import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/session";

/**
 * Port từ api/routers/auth.py::me — 401 = chưa đăng nhập hpcore (frontend redirect),
 * 403 = đã đăng nhập hpcore nhưng chưa được cấp quyền app này (frontend hiện thông báo).
 */
export async function GET() {
  const result = await resolveSession();
  if (result.status === "unauthenticated") {
    return NextResponse.json({ detail: "Chua dang nhap" }, { status: 401 });
  }
  if (result.status === "denied") {
    return NextResponse.json(
      { detail: "Chua duoc cap quyen truy cap KhoCtr. Lien he quan tri vien." },
      { status: 403 },
    );
  }
  const { session } = result;
  return NextResponse.json({ uid: session.uid, email: session.email, ten: session.ten, role: session.role, avatar: session.avatar });
}
