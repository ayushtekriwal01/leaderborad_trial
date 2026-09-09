// lib/process.js — cohort classification, ranking, validation (pure functions)

export const COHORTS = {
  c1: { label: "₹15K – ₹1L", min: 15_000, max: 100_000 },
  c2: { label: "₹1L – ₹3L", min: 100_000, max: 300_000 },
  c3: { label: "₹3L – ₹7L", min: 300_000, max: 700_000 },
  c4: { label: "₹7L+", min: 700_000, max: Infinity },
};
export const REGIONS = ["North", "South", "East", "West"];
export const NATIONAL_TOP_N = 100;
export const REGIONAL_TOP_N = 50;

// Accepts multiple Metabase export column spellings
const ALIASES = {
  id: ["creator_id", "dim__creator_id", "creatorid", "id"],
  handle: [
    "instagram_handle", "instagram_id", "handle",
    "dim__creator_latest_instagram_handle", "ig_handle",
  ],
  nmv: ["lifetime_nmv", "dim__end_user_lifetime_nmv", "nmv", "total_nmv"],
  orders: ["orders", "total_orders", "total__orders", "total_orders_7d"],
  gmv: ["gmv", "total_gmv", "total__gmv", "total_gmv_7d"],
  region: ["region", "dim__creator_region", "leaderboard_region"],
  state: ["state", "dim__creator_state"],
};

function pick(row, keys) {
  for (const k of Object.keys(row)) {
    if (keys.includes(k.toLowerCase().trim())) {
      const v = row[k];
      if (v !== null && v !== undefined && v !== "") return v;
    }
  }
  return null;
}

const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

function normRegion(v) {
  if (!v) return null;
  const r = String(v).trim().toLowerCase();
  const hit = REGIONS.find((x) => x.toLowerCase() === r);
  return hit || null;
}


// Expand Indian state codes for display (unknown codes pass through as-is)
const STATE_NAMES = {
  AN: "Andaman & Nicobar", AP: "Andhra Pradesh", AR: "Arunachal Pradesh",
  AS: "Assam", BR: "Bihar", CG: "Chhattisgarh", CH: "Chandigarh",
  DD: "Daman & Diu", DL: "Delhi", DN: "Dadra & Nagar Haveli", GA: "Goa",
  GJ: "Gujarat", HP: "Himachal Pradesh", HR: "Haryana", JH: "Jharkhand",
  JK: "Jammu & Kashmir", KA: "Karnataka", KL: "Kerala", LD: "Lakshadweep",
  MH: "Maharashtra", ML: "Meghalaya", MN: "Manipur", MP: "Madhya Pradesh",
  MZ: "Mizoram", NL: "Nagaland", OR: "Odisha", PB: "Punjab",
  PU: "Puducherry", PY: "Puducherry", RJ: "Rajasthan", SK: "Sikkim",
  TN: "Tamil Nadu", TR: "Tripura", TS: "Telangana", UK: "Uttarakhand",
  UP: "Uttar Pradesh", WB: "West Bengal",
};

function normState(v) {
  if (!v) return null;
  const s = String(v).trim();
  return STATE_NAMES[s.toUpperCase()] || s;
}

function normHandle(v) {
  if (!v) return null;
  return String(v).trim().replace(/^@+/, "").toLowerCase() || null;
}

export function classifyCohort(nmv) {
  // Boundary rule: values exactly at ₹1L/₹3L/₹7L go to the HIGHER cohort.
  if (nmv >= 700_000) return "c4";
  if (nmv >= 300_000) return "c3";
  if (nmv >= 100_000) return "c2";
  if (nmv >= 15_000) return "c1";
  return null; // < ₹15K → excluded entirely
}

// Ranking metric: GMV desc → Orders desc → Lifetime NMV desc → creator_id asc.
// Lifetime NMV only decides the cohort; position inside every board is by GMV.
export function creatorSort(a, b) {
  if ((b.gmv ?? 0) !== (a.gmv ?? 0)) return (b.gmv ?? 0) - (a.gmv ?? 0);
  if ((b.orders ?? 0) !== (a.orders ?? 0)) return (b.orders ?? 0) - (a.orders ?? 0);
  if (b.nmv !== a.nmv) return b.nmv - a.nmv;
  return String(a.id) < String(b.id) ? -1 : 1;
}

// Detect the GMV / orders column for ANY sale window (total_gmv_7d, total_gmv_9d,
// total_gmv_20d, sale_gmv, ...). Exact aliases win; otherwise first regex match.
function detectKey(rows, aliases, regexes) {
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const keys = Object.keys(r);
    for (const k of keys) if (aliases.includes(k.toLowerCase().trim())) return k;
    for (const re of regexes) {
      const hit = keys.find((k) => re.test(k.toLowerCase().trim()));
      if (hit) return hit;
    }
    return null; // first data row decides
  }
  return null;
}
const GMV_REGEX = [/^total_gmv(_\w+)?$/, /^gmv(_\w+)?$/, /(^|_)gmv(_|$)/];
const ORDERS_REGEX = [/^total_orders?(_\w+)?$/, /^orders?(_\w+)?$/, /(^|_)orders?(_|$)/];

export function normalizeRows(rows) {
  const byId = new Map();
  const dropped = { missingId: 0, missingNmv: 0, below15k: 0, dupes: 0 };
  const gmvKey = detectKey(rows, ALIASES.gmv, GMV_REGEX);
  const ordersKey = detectKey(rows, ALIASES.orders, ORDERS_REGEX);

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const id = pick(raw, ALIASES.id);
    const nmv = toNum(pick(raw, ALIASES.nmv));
    if (id === null) { dropped.missingId++; continue; }
    if (nmv === null) { dropped.missingNmv++; continue; }
    if (nmv < 15_000) { dropped.below15k++; continue; }

    const c = {
      id: String(id).trim(),
      handle: normHandle(pick(raw, ALIASES.handle)),
      nmv,
      orders: toNum(ordersKey ? raw[ordersKey] : pick(raw, ALIASES.orders)) ?? 0,
      gmv: toNum(gmvKey ? raw[gmvKey] : pick(raw, ALIASES.gmv)) ?? 0,
      region: normRegion(pick(raw, ALIASES.region)),
      state: normState(pick(raw, ALIASES.state)),
    };

    // Duplicate creator IDs in source → keep the row with the higher NMV
    const prev = byId.get(c.id);
    if (prev) { dropped.dupes++; if (c.nmv <= prev.nmv) continue; }
    byId.set(c.id, c);
  }
  // Second pass: two different creator IDs sharing one Instagram handle would
  // look like the same person listed twice — keep only the higher-NMV row per handle.
  const byHandle = new Map();
  const creators = [];
  for (const c of byId.values()) {
    if (!c.handle) { creators.push(c); continue; }
    const prev = byHandle.get(c.handle);
    if (prev) {
      dropped.dupes++;
      if (c.nmv <= prev.nmv) continue;
      creators.splice(creators.indexOf(prev), 1);
    }
    byHandle.set(c.handle, c);
    creators.push(c);
  }
  return { creators, dropped, columns: { gmv: gmvKey, orders: ordersKey } };
}

export function buildDataset(rows, { version, generatedAt, windowLabel } = {}) {
  const { creators, dropped, columns } = normalizeRows(rows);

  // STEP 1 — OVERALL RANK first, across the full eligible universe
  // (<15K already excluded during normalization)
  creators.sort(creatorSort);
  creators.forEach((c, i) => (c.overallRank = i + 1));

  // STEP 2 — SLICE the overall-ranked universe into the 4 lifetime-NMV buckets.
  // Iterating in overall-rank order means every bucket inherits that order.
  const buckets = Object.fromEntries(Object.keys(COHORTS).map((k) => [k, []]));
  for (const c of creators) {
    c.cohort = classifyCohort(c.nmv);
    buckets[c.cohort].push(c);
  }

  // STEP 3 — NATIONAL RANK within each bucket (position in the slice)
  // STEP 4 — REGIONAL RANK within each bucket + region
  for (const key of Object.keys(COHORTS)) {
    buckets[key].forEach((c, i) => (c.nationalRank = i + 1));
    for (const region of REGIONS) {
      buckets[key].filter((c) => c.region === region).forEach((c, i) => (c.regionalRank = i + 1));
    }
  }

  const lb = (list) =>
    list.map((c) => ({
      id: c.id, handle: c.handle, nmv: c.nmv, orders: c.orders, gmv: c.gmv,
      region: c.region, state: c.state, cohort: c.cohort,
      overallRank: c.overallRank, nationalRank: c.nationalRank,
      regionalRank: c.regionalRank ?? null,
    }));

  // STEP 5 — STORE: boards are plain slices of each bucket
  const cohorts = {};
  for (const [key, def] of Object.entries(COHORTS)) {
    const pool = buckets[key];
    cohorts[key] = {
      label: def.label,
      total: pool.length,
      national: lb(pool.slice(0, NATIONAL_TOP_N)),
      regions: Object.fromEntries(
        REGIONS.map((r) => [r, lb(pool.filter((c) => c.region === r).slice(0, REGIONAL_TOP_N))])
      ),
    };
  }

  const dataset = {
    version: version || `v${Date.now()}`,
    generatedAt: generatedAt || new Date().toISOString(),
    counts: { eligible: creators.length, dropped, columns },
    windowLabel: windowLabel || "7d",
    cohorts,
    // Full eligible universe → powers search beyond the visible Top N
    searchIndex: lb(creators),
  };

  const errors = validateDataset(dataset);
  return { ok: errors.length === 0, errors, dataset };
}

export function validateDataset(ds) {
  const errors = [];
  const err = (m) => errors.push(m);
  const seenGlobal = new Map(); // id → cohort (cohort exclusivity)

  const checkBoard = (name, rows, rankKey, maxN) => {
    if (rows.length > maxN) err(`${name}: ${rows.length} rows exceeds max ${maxN}`);
    const ids = new Set(), handles = new Set(), ranks = new Set();
    rows.forEach((r, i) => {
      if (ids.has(r.id)) err(`${name}: duplicate creator ${r.id}`);
      ids.add(r.id);
      if (r.handle) {
        if (handles.has(r.handle)) err(`${name}: duplicate handle @${r.handle}`);
        handles.add(r.handle);
      }
      const rank = r[rankKey];
      if (ranks.has(rank)) err(`${name}: duplicate rank ${rank}`);
      ranks.add(rank);
      if (rank !== i + 1) err(`${name}: rank not sequential at position ${i + 1} (got ${rank})`);
      if (r.nmv < 15_000) err(`${name}: <₹15K creator ${r.id} present`);
    });
  };

  for (const [key, def] of Object.entries(COHORTS)) {
    const c = ds.cohorts[key];
    checkBoard(`${key}/national`, c.national, "nationalRank", NATIONAL_TOP_N);
    // National boards must preserve overall-rank order (slice of the overall ranking)
    for (let i = 1; i < c.national.length; i++) {
      if (c.national[i].overallRank <= c.national[i - 1].overallRank)
        err(`${key}/national: overall-rank order broken at position ${i + 1}`);
    }
    // Same guarantee for every regional board
    for (const region of REGIONS) {
      const rb = c.regions[region];
      for (let i = 1; i < rb.length; i++) {
        if (rb[i].overallRank <= rb[i - 1].overallRank)
          err(`${key}/${region}: overall-rank order broken at position ${i + 1}`);
      }
    }
    for (const region of REGIONS) {
      checkBoard(`${key}/${region}`, c.regions[region], "regionalRank", REGIONAL_TOP_N);
      for (const r of c.regions[region]) {
        if (r.region !== region) err(`${key}/${region}: creator ${r.id} has region ${r.region}`);
        if (r.cohort !== key) err(`${key}/${region}: creator ${r.id} in wrong cohort`);
      }
    }
    for (const r of c.national) {
      if (r.cohort !== key) err(`${key}/national: creator ${r.id} in wrong cohort`);
      if (r.nmv < def.min || r.nmv >= def.max) err(`${key}: creator ${r.id} NMV ${r.nmv} outside cohort bounds`);
      const prev = seenGlobal.get(r.id);
      if (prev && prev !== key) err(`creator ${r.id} appears in cohorts ${prev} and ${key}`);
      seenGlobal.set(r.id, key);
    }
  }

  // Overall rank: unique + sequential across the full eligible universe
  const seenOverall = new Set();
  ds.searchIndex.forEach((r, i) => {
    if (r.overallRank !== i + 1) err(`overall rank not sequential at ${i + 1}`);
    if (seenOverall.has(r.id)) err(`duplicate creator ${r.id} in eligible universe`);
    seenOverall.add(r.id);
  });

  return errors;
}
