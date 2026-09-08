// GET /api/search?q=@handle — searches the COMPLETE eligible creator universe,
// not just the visible Top 100 / Top 50, and flags creators outside the Top N.

import { NextResponse } from "next/server";
import { readDataset } from "@/lib/store";
import { NATIONAL_TOP_N, REGIONAL_TOP_N, COHORTS } from "@/lib/process";

export const runtime = "nodejs";

export async function GET(req) {
  const q = (new URL(req.url).searchParams.get("q") || "")
    .trim().replace(/^@+/, "").toLowerCase();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const ds = await readDataset();
  if (!ds) return NextResponse.json({ error: "No dataset published yet" }, { status: 503 });

  const results = [];
  for (const c of ds.searchIndex) {
    const handleHit = c.handle && c.handle.includes(q);
    const idHit = c.id.toLowerCase() === q;
    if (!handleHit && !idHit) continue;
    results.push({
      ...c,
      cohortLabel: COHORTS[c.cohort].label,
      inNationalTopN: c.nationalRank <= NATIONAL_TOP_N,
      inRegionalTopN: c.regionalRank !== null && c.regionalRank <= REGIONAL_TOP_N,
    });
    if (results.length >= 10) break;
  }
  return NextResponse.json(
    { results, meta: { version: ds.version, generatedAt: ds.generatedAt } },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=30" } }
  );
}
