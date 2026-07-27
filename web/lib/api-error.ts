import { NextResponse } from "next/server";
import { AuthError, ForbiddenError } from "@/lib/session";
import { AccessDeniedError } from "@/lib/data/ghi-chu";

/** Map lỗi ném ra từ lib/data/*.ts thành HTTP response — dùng chung cho mọi Route Handler. */
export function apiError(err: unknown): NextResponse {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ForbiddenError || err instanceof AccessDeniedError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  const message = err instanceof Error ? err.message : "Lỗi không xác định";
  return NextResponse.json({ error: message }, { status: 500 });
}
