// GET /api/export — full eligible dataset (same fields the public search already exposes).
// Used by verification tooling and controlled re-publishes.

import { NextResponse } from "next/server";
import { readDataset } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const ds = await readDataset();
  if (!ds) return NextResponse.json({ error: "No dataset published yet" }, { status: 503 });
  return NextResponse.json({ version: ds.version, generatedAt: ds.generatedAt, rows: ds.searchIndex });
}
