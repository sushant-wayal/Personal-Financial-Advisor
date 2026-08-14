import { NextResponse } from "next/server";
import { getUnifiedDashboardOverview } from "@/src/services/analytics";

export const revalidate = 10;

export async function GET() {
  try {
    const data = await getUnifiedDashboardOverview();
    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
