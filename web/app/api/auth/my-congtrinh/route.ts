import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getMyCongTrinh } from "@/lib/data/cong-trinh";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await requireSession();
    const { congTrinhs, isAdmin } = await getMyCongTrinh(session);
    return NextResponse.json({ congtrinhs: congTrinhs, is_admin: isAdmin });
  } catch (err) {
    return apiError(err);
  }
}
