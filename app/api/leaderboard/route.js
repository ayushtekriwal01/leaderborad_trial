// GET /api/leaderboard?cohort=c1 → national + 4 regional boards for one cohort.
// Always serves the last successfully published dataset.

import { NextResponse } from "next/server";
import { readDataset } from "@/lib/store";
import { COHORTS } from "@/lib/process";

export const runtime = "nodejs";

export async function GET(req) {
  const cohort = new URL(req.url).searchParams.get("cohort");
  if (!COHORTS[cohort]) {
    return NextResponse.json({ error: "cohort must be one of c1,c2,c3,c4" }, { status: 400 });
  }
  const ds = await readDataset();
  if (!ds) {
    return NextResponse.json(
      { error: "No dataset published yet" },
      { status: 503, headers: { "Retry-After": "60" } }
    );
  }
  const c = ds.cohorts[cohort];
  return NextResponse.json(
    {
      meta: { version: ds.version, generatedAt: ds.generatedAt, cohort, label: c.label, total: c.total },
      national: c.national,
      regions: c.regions,
    },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=3600" } }
  );
}
