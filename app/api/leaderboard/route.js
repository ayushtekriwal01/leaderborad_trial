// GET /api/leaderboard?cohort=c1 → national + 4 regional boards for one cohort.
// Always serves the last successfully published dataset.

import { NextResponse } from "next/server";
import { readDataset } from "@/lib/store";
import { COHORTS } from "@/lib/process";

export const runtime = "nodejs";

export async function GET(req) {
  const cohort = new URL(req.url).searchParams.get("cohort");
  if (cohort !== "overall" && !COHORTS[cohort]) {
    return NextResponse.json({ error: "cohort must be one of c1,c2,c3,c4,overall" }, { status: 400 });
  }
  const ds = await readDataset();
  if (!ds) {
    return NextResponse.json(
      { error: "No dataset published yet" },
      { status: 503, headers: { "Retry-After": "60" } }
    );
  }
  const c = cohort === "overall" ? ds.overall : ds.cohorts[cohort];
  if (!c) {
    return NextResponse.json(
      { error: "Overall board not in the current dataset yet — it appears after the next publish" },
      { status: 503, headers: { "Retry-After": "60" } }
    );
  }
  return NextResponse.json(
    {
      meta: { version: ds.version, generatedAt: ds.generatedAt, windowLabel: ds.windowLabel || "7d", cohort, label: c.label, total: c.total },
      national: c.national,
      regions: c.regions,
    },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=30" } }
  );
}
