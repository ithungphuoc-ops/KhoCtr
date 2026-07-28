import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/data/nhat-ky";
import { apiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    await logActivity({
      action: body.action,
      entityType: body.entity_type,
      entityId: body.entity_id,
      details: body.details,
      userEmail: body.user_email,
      congTrinhId: body.cong_trinh_id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}
