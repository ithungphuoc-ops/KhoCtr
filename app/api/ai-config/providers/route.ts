import { NextResponse } from "next/server";
import { listProvidersInfo } from "@/lib/ai/providers";

// Public — không cần auth, khớp bản gốc.
export async function GET() {
  return NextResponse.json({ providers: listProvidersInfo() });
}
