// Sends synthetic creator rows to /api/publish so you can test the full
// pipeline before wiring Metabase. Usage:
//   APP_URL=https://your-app.vercel.app PUBLISH_TOKEN=xxx node scripts/seed.mjs

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const TOKEN = process.env.PUBLISH_TOKEN;
if (!TOKEN) { console.error("Set PUBLISH_TOKEN"); process.exit(1); }

const regions = ["North", "South", "East", "West"];
const states = { North: ["Delhi", "Punjab", "UP"], South: ["Karnataka", "Tamil Nadu", "Telangana"], East: ["West Bengal", "Odisha", "Bihar"], West: ["Maharashtra", "Gujarat", "Rajasthan"] };

const rows = [];
for (let i = 1; i <= 3000; i++) {
  const region = regions[i % 4];
  const nmv = Math.floor(5_000 + Math.random() ** 2 * 1_500_000); // some <15K to test exclusion
  rows.push({
    creator_id: `CR${String(i).padStart(5, "0")}`,
    instagram_handle: `@creator_${i}`,
    lifetime_nmv: nmv,
    orders: Math.floor(nmv / (300 + Math.random() * 500)),
    gmv: Math.floor(nmv * 1.8),
    region,
    state: states[region][i % 3],
  });
}

const res = await fetch(`${APP_URL}/api/publish`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ rows }),
});
console.log(res.status, JSON.stringify(await res.json(), null, 2));
