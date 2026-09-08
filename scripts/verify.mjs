// Random-sample + full-board verification: raw Metabase data vs the hosted leaderboard.
// Run AFTER an n8n publish, from a machine that can reach both Metabase and the app.
//
// Usage (either raw source):
//   METABASE_SESSION=<token> node scripts/verify.mjs --metabase https://metabase-main.bi.meeshogcp.in/api/card/194161/query/json
//   node scripts/verify.mjs --raw raw.json
// Options: --app https://leaderboradtrial.vercel.app (default) | --samples 25 | --dry (skip live compare)

import { buildDataset, COHORTS, REGIONS } from "../lib/process.js";
import { readFileSync } from "fs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const APP = (arg("--app", "https://leaderboradtrial.vercel.app")).replace(/\/$/, "");
const SAMPLES = Number(arg("--samples", 25));
const DRY = process.argv.includes("--dry");

let rows;
if (arg("--raw")) rows = JSON.parse(readFileSync(arg("--raw"), "utf8"));
else if (arg("--metabase")) {
  const res = await fetch(arg("--metabase"), { method: "POST", headers: { "X-Metabase-Session": process.env.METABASE_SESSION || "" } });
  if (!res.ok) { console.error("Metabase fetch failed:", res.status); process.exit(1); }
  rows = await res.json();
} else { console.error("Provide --raw file.json or --metabase <url>"); process.exit(1); }
if (!Array.isArray(rows)) rows = rows.rows || rows.data;

const { ok, errors, dataset } = buildDataset(rows);
console.log(`raw rows: ${rows.length} | eligible: ${dataset.counts.eligible} | validation: ${ok ? "PASS" : "FAIL"}`);
if (!ok) { console.error(errors.slice(0, 10)); process.exit(1); }
if (DRY) process.exit(0);

let fails = 0;
const bad = (m) => { fails++; console.error("  ✗", m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const row = (r) => ({ id: r.id, h: r.handle, n: r.nmv, o: r.orders, g: r.gmv, st: r.state, ov: r.overallRank, na: r.nationalRank, re: r.regionalRank });

console.log("\n[1] Full-board compare (4 national + 16 regional, every displayed field)");
for (const c of Object.keys(COHORTS)) {
  const live = await (await fetch(`${APP}/api/leaderboard?cohort=${c}`)).json();
  if (live.meta.total !== dataset.cohorts[c].total) bad(`${c} total: live ${live.meta.total} vs expected ${dataset.cohorts[c].total}`);
  if (!same(live.national.map(row), dataset.cohorts[c].national.map(row))) bad(`${c}/national board differs`);
  for (const reg of REGIONS)
    if (!same(live.regions[reg].map(row), dataset.cohorts[c].regions[reg].map(row))) bad(`${c}/${reg} board differs`);
}
console.log(fails === 0 ? "  ✓ all 20 boards identical to raw-data expectation" : `  boards done with ${fails} issue(s)`);

console.log(`\n[2] Random-sample audit via /api/search (${SAMPLES} creators across cohorts/regions)`);
const pool = dataset.searchIndex.filter((c) => c.handle);
const picks = new Map();
for (const c of Object.keys(COHORTS)) for (const reg of [...REGIONS, null]) {
  const grp = pool.filter((x) => x.cohort === c && (reg ? x.region === reg : true));
  if (grp.length) { const p = grp[Math.floor(Math.random() * grp.length)]; picks.set(p.id, p); }
}
while (picks.size < Math.min(SAMPLES, pool.length)) { const p = pool[Math.floor(Math.random() * pool.length)]; picks.set(p.id, p); }
for (const exp of picks.values()) {
  const res = await (await fetch(`${APP}/api/search?q=${encodeURIComponent(exp.handle)}`)).json();
  const got = (res.results || []).find((r) => r.id === exp.id);
  if (!got) { bad(`search miss: @${exp.handle}`); continue; }
  for (const k of ["cohort", "overallRank", "nationalRank", "regionalRank", "nmv", "orders", "gmv", "region", "state"])
    if (JSON.stringify(got[k]) !== JSON.stringify(exp[k])) bad(`@${exp.handle} ${k}: live ${got[k]} vs expected ${exp[k]}`);
}
console.log(`  sampled ${picks.size} creators`);
console.log(`\nVERDICT: ${fails === 0 ? "PASS — hosted output matches raw Metabase data exactly" : `FAIL — ${fails} issue(s) above`}`);
process.exit(fails === 0 ? 0 : 1);
