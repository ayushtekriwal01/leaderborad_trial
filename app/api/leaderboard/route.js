// GET /api/leaderboard?cohort=<overall|private-slug> → national + 4 regional boards for one cohort.
// Always serves the last successfully published dataset.

import { NextResponse } from "next/server";
import { readDataset } from "@/lib/store";
import { COHORTS } from "@/lib/process";
import { resolveSlug } from "@/lib/slugs";

export const runtime = "nodejs";

export async function GET(req) {
  const slug = new URL(req.url).searchParams.get("cohort");
  const cohort = resolveSlug(slug); // only "overall" or a private slug — c1…c4 are rejected
  if (!cohort) {
    return NextResponse.json({ error: "board not found" }, { status: 404 });
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
      meta: { version: ds.version, generatedAt: ds.generatedAt, windowLabel: ds.windowLabel || "7d", cohort: slug, label: c.label, total: c.total },
      national: c.national,
      regions: c.regions,
    },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=30" } }
  );
}
