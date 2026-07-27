import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getPermissions, savePermissions } from "@/lib/data/permissions";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    await requireAdmin();
    const permissions = await getPermissions();
    return NextResponse.json({ permissions });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const count = await savePermissions(body.permissions || []);
    return NextResponse.json({ success: true, count });
  } catch (err) {
    return apiError(err);
  }
}
