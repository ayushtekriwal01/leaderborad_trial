// POST /api/publish — n8n sends raw Metabase rows here every hour.
// Processing + validation happen server-side; the live dataset is replaced
// ONLY if every validation check passes.

import { NextResponse } from "next/server";
import { buildDataset } from "@/lib/process";
import { publishDataset } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  let body;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  // Token via Authorization header, or in the body (lets trusted in-network
  // pages publish via a CORS-simple text/plain POST).
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  const token = auth || body?.token;
  if (token !== process.env.PUBLISH_TOKEN) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
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
