import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/data/permissions";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    await requireAdmin();
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (err) {
    return apiError(err);
  }
}
