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

  const windowLabel =
    typeof body?.windowLabel === "string" && body.windowLabel.trim()
      ? body.windowLabel.trim().slice(0, 24)
      : undefined;

  const { ok, errors, dataset } = buildDataset(rows, { windowLabel });

  // ---- Safety guards: a broken/partial card pull must never wipe the live board ----
  const guards = [];
  const MIN_ELIGIBLE = Number(process.env.PUBLISH_MIN_ELIGIBLE || 50);
  if (dataset.counts.eligible < MIN_ELIGIBLE) {
    guards.push(
      `only ${dataset.counts.eligible} eligible creators (< ${MIN_ELIGIBLE}); dropped: ${JSON.stringify(dataset.counts.dropped)}. ` +
      `Looks like a broken/partial query — previous leaderboard kept live. ` +
      `(Lower PUBLISH_MIN_ELIGIBLE in Vercel env if this is genuinely expected.)`
    );
  }
  if (!dataset.counts.columns?.gmv) {
    guards.push(
      `no GMV column detected in payload (looked for total_gmv_*, gmv_*, *_gmv). ` +
      `Columns seen: ${Object.keys(rows[0] || {}).join(", ")}. Ranking would be meaningless — publish blocked.`
    );
  }
  if (guards.length) {
    console.error("publish blocked by guards:", guards);
    return NextResponse.json({ ok: false, published: false, errors: guards }, { status: 422 });
  }

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
