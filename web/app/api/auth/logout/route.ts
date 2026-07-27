import { NextResponse } from "next/server";
import { SSO_COOKIE_NAME } from "@/lib/hpcore";

/** Port từ api/routers/auth.py::logout — xóa cookie session hpcore (dùng chung domain .hpcore.vn). */
export async function POST() {
  const res = NextResponse.json({ success: true, login_url: "https://account.hpcore.vn/login" });
  res.cookies.set(SSO_COOKIE_NAME, "", {
    domain: ".hpcore.vn",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}
