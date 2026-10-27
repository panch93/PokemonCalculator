import { NextResponse } from "next/server";
import { getBundledShowdownFormats } from "../../../../lib/showdown-format-config";

/** Serve the pinned local Pokémon Showdown format metadata; this endpoint is offline-only. */
export const revalidate = false;
export const runtime = "nodejs";

export async function GET() {
  try {
    const formats = getBundledShowdownFormats();
    return NextResponse.json({ formats, source: "bundled smogon/pokemon-showdown snapshot", fetchedAt: null }, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read bundled Pokémon Showdown config" }, { status: 500 });
  }
}
