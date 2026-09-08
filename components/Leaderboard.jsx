"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { COHORTS } from "@/lib/process";

const TABS = ["National", "North", "South", "East", "West"];

const fmtINR = (n) => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString("en-IN"));
const fmtTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });

export default function Leaderboard({ cohort, label }) {
  const storageKey = `mcc-lb-${cohort}`;
  const [data, setData] = useState(null);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState("National");
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const debounce = useRef();

  // Load: last-known dataset from localStorage first (page refresh never
  // blanks the board), then fetch the latest published dataset.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { setData(JSON.parse(saved)); setStale(true); }
    } catch {}
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/leaderboard?cohort=${cohort}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (cancelled) return;
        setData(json); setStale(false); setFailed(false);
        try { localStorage.setItem(storageKey, JSON.stringify(json)); } catch {}
      } catch {
        if (!cancelled) setFailed(true); // keep showing whatever we have
      }
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000); // pick up hourly publishes
    return () => { cancelled = true; clearInterval(t); };
  }, [cohort, storageKey]);

  // Search across the complete eligible universe
  useEffect(() => {
    clearTimeout(debounce.current);
    const query = q.trim().replace(/^@+/, "");
    if (query.length < 2) { setResults(null); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const json = await res.json();
        setResults(json.results || []);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q]);

  const rows = useMemo(() => {
    if (!data) return [];
    return tab === "National" ? data.national : data.regions?.[tab] || [];
  }, [data, tab]);

  const isRegional = tab !== "National";

  return (
    <main className="wrap">
      <header className="masthead">
        <Link href="/" className="brand">Meesho Creator Club</Link>
        <h1>Creator Leaderboard</h1>
        <p className="sub">Ranked by lifetime NMV · orders & GMV shown for the last 7 days · refreshed hourly</p>
        <div className="cohort-row">
          {Object.entries(COHORTS).map(([key, c]) => (
            <Link key={key} href={`/l/${key}`} className={`cohort-chip ${key === cohort ? "active" : ""}`}>
              {c.label}
            </Link>
          ))}
        </div>
      </header>

      {data?.meta && (
        <p className="updated">
          Last updated: <b>{fmtTime(data.meta.generatedAt)}</b>
        </p>
      )}
      {(stale || failed) && data && (
        <div className="stale-banner">
          Showing the last published leaderboard while the latest data loads.
        </div>
      )}

      <div className="search">
        <span className="icon" aria-hidden>⌕</span>
        <input
          type="search"
          placeholder="Search any creator by Instagram handle, e.g. @creatorname"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search creator by Instagram handle"
        />
      </div>

      {results !== null ? (
        <section aria-live="polite">
          {results.length === 0 && (
            <p className="result-empty">
              No creator found for “{q.trim()}”. Check the handle spelling — creators below ₹15K lifetime NMV aren’t ranked yet.
            </p>
          )}
          {results.map((r) => (
            <article key={r.id} className="result-card">
              <span className="handle">@{r.handle || r.id}</span>
              <span className="cohort-tag">{r.cohortLabel}</span>
              <div className="result-grid">
                <div className="cell"><small>{r.region ? `${r.region} rank` : "Regional rank"}</small><span>{r.regionalRank ? `#${fmtInt(r.regionalRank)}` : "—"}</span></div>
                <div className="cell"><small>National rank</small><span>#{fmtInt(r.nationalRank)}</span></div>
                <div className="cell"><small>Overall rank</small><span>#{fmtInt(r.overallRank)}</span></div>
                <div className="cell"><small>Orders (7d)</small><span>{fmtInt(r.orders)}</span></div>
                <div className="cell"><small>GMV (7d)</small><span>{fmtINR(r.gmv)}</span></div>
                <div className="cell"><small>State</small><span>{r.state || "—"}</span></div>
              </div>
              {!r.inNationalTopN && (
                <div className="result-note">
                  Ranked, but outside the displayed Top 100 national board for {r.cohortLabel}.
                </div>
              )}
            </article>
          ))}
        </section>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label="Leaderboard scope">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {!data && !failed && <div className="state">Loading leaderboard…</div>}
          {!data && failed && (
            <div className="state">
              <b>Leaderboard is warming up.</b><br />
              The latest rankings will appear here shortly — try again in a minute.
            </div>
          )}

          {data && (
            <div className="board">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th className="rank-primary">{isRegional ? `${tab} rank` : "Rank"}</th>
                      {isRegional && <th>National rank</th>}
                      <th>Overall rank</th>
                      <th>Instagram handle</th>
                      <th>Orders (7d)</th>
                      <th>GMV (7d)</th>
                      <th>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const primary = isRegional ? r.regionalRank : r.nationalRank;
                      return (
                        <tr key={r.id} className={primary <= 3 ? "top3" : ""}>
                          <td className="rank-primary">#{primary}</td>
                          {isRegional && <td className="dim">#{fmtInt(r.nationalRank)}</td>}
                          <td className="dim">#{fmtInt(r.overallRank)}</td>
                          <td className="handle-cell">@{r.handle || r.id}</td>
                          <td>{fmtInt(r.orders)}</td>
                          <td>{fmtINR(r.gmv)}</td>
                          <td className="dim">{r.state || "—"}</td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr><td colSpan={isRegional ? 7 : 6} className="state">No ranked creators in this view yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
