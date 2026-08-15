import { NextResponse } from "next/server";

// Danh sách vai trò CỦA CHÍNH app kho công trình — App Tổng (account.hpcore.vn)
// gọi endpoint này để dựng dropdown gán quyền tại trang "Quản lý ứng dụng",
// không hard-code danh sách vai trò ở phía App Tổng. Public, CORS mở cho
// *.hpcore.vn — cùng mẫu đã dùng ở HPCons-DauThau/api/roles.
//
// 2 vai trò khớp đúng lib/session.ts (Session.role: "admin" | "user") và
// lib/hpcore.ts::getAppRole() đọc app_permissions/{uid}.warehouse — KHÔNG
// đổi 2 khoá "admin"/"user" ở đây nếu không sửa cùng lúc bên session.ts.
const ROLES = {
  admin: "Quản trị (toàn quyền)",
  user: "Nhân viên (sử dụng, không quản trị)",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300",
};

export async function GET() {
  const roles = Object.entries(ROLES).map(([key, label]) => ({ key, label }));
  return NextResponse.json({ roles }, { headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}
