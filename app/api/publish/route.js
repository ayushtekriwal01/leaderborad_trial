// POST /api/publish — n8n sends raw Metabase rows here every hour.
// Processing + validation happen server-side; the live dataset is replaced
// ONLY if every validation check passes.

import { NextResponse } from "next/server";
import { buildDataset } from "@/lib/process";
import { publishDataset } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.PUBLISH_TOKEN}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body) ? body : body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ ok: false, error: "body.rows must be a non-empty array" }, { status: 400 });
  }

  const { ok, errors, dataset } = buildDataset(rows);
  if (!ok) {
    // Validation failed → existing leaderboard stays live, untouched.
    console.error("publish rejected:", errors.slice(0, 20));
    return NextResponse.json(
      { ok: false, published: false, errors: errors.slice(0, 50) },
      { status: 422 }
    );
  }

  await publishDataset(dataset);
  return NextResponse.json({
    ok: true,
    published: true,
    version: dataset.version,
    generatedAt: dataset.generatedAt,
    counts: dataset.counts,
  });
}
