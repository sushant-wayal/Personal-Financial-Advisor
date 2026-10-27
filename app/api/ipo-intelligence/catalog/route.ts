import { NextResponse } from "next/server";
import {
  getOpenIpos,
  getUpcomingIpos,
  getClosedAndListedIpos,
  getAllIpos,
} from "../../../../src/services/ipoData";

export async function GET() {
  try {
    const [all, open, upcoming, closed] = await Promise.all([
      getAllIpos(),
      getOpenIpos(),
      getUpcomingIpos(),
      getClosedAndListedIpos(),
    ]);

    return NextResponse.json({
      ok: true,
      catalog: {
        all,
        open,
        upcoming,
        closed,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/ipo-intelligence/catalog] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
