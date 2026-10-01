"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const TABS = ["National", "North", "South", "East", "West"];
const METRIC = "Sale"; // value label — flip to "GMV" after the sale
const COLORS = ["#F43397", "#9F2089", "#FFD36B", "#FF8CC6", "#FFFFFF", "#C25AB0"];

const fmtINR = (n) => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString("en-IN"));
const fmtTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
const initial = (r) => (r.handle || r.id || "?").charAt(0).toUpperCase();

// Deterministic pseudo-random so confetti is identical on server and client (no hydration mismatch).
function rng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
function makeConfetti(n, seed) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const w = 6 + r() * 7;
    return {
      left: `${(r() * 100).toFixed(1)}%`,
      width: `${w.toFixed(0)}px`,
      height: `${(r() > 0.45 ? w * 1.9 : w).toFixed(0)}px`,
      background: COLORS[i % COLORS.length],
      borderRadius: r() > 0.7 ? "50%" : "2px",
      animationDuration: `${(7 + r() * 8).toFixed(1)}s`,
      animationDelay: `-${(r() * 14).toFixed(1)}s`,
      opacity: (0.5 + r() * 0.45).toFixed(2),
      "--sway": `${(r() * 120 - 60).toFixed(0)}px`,
      "--spin": `${(360 + r() * 900).toFixed(0)}deg`,
    };
  });
}
function makeBurst(n, seed, a0, a1, d0, d1, once) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = ((a0 + r() * (a1 - a0)) * Math.PI) / 180;
    const d = d0 + r() * (d1 - d0);
    const w = 5 + r() * 6;
    return {
      width: `${w.toFixed(0)}px`,
      height: `${(r() > 0.5 ? w * 1.8 : w).toFixed(0)}px`,
      background: COLORS[i % COLORS.length],
      borderRadius: r() > 0.6 ? "50%" : "2px",
      animationDelay: `${(once ? r() * 0.25 : r() * 2.6).toFixed(2)}s`,
      ...(once ? { animationIterationCount: 1, animationFillMode: "forwards" } : {}),
      "--dx": `${(Math.cos(a) * d).toFixed(0)}px`,
      "--dy": `${(Math.sin(a) * d).toFixed(0)}px`,
      "--spin": `${(r() * 720 - 360).toFixed(0)}deg`,
    };
  });
}

function Handle({ r, className }) {
  return r.handle ? (
    <a className={className} href={`https://instagram.com/${r.handle}`} target="_blank" rel="noopener noreferrer">@{r.handle}</a>
  ) : (
    <span className={className}>{r.id}</span>
  );
}

function Popper({ side, burst }) {
  return (
    <div className={`ar-popper ${side}`} aria-hidden="true">
      <div className="ar-burst-origin">
        {burst.map((s, i) => <span key={i} className="ar-bp" style={s} />)}
      </div>
      <svg viewBox="0 0 64 84" width="64" height="84">
        <path d="M4 4 H60 L32 82 Z" fill={side === "left" ? "#F43397" : "#9F2089"} />
        <path d="M12 26 H52 L47 40 H17 Z" fill="#FFD36B" />
        <path d="M21 52 H43 L38 64 H26 Z" fill={side === "left" ? "#9F2089" : "#F43397"} />
        <ellipse cx="32" cy="5" rx="28" ry="5" fill={side === "left" ? "#FF8CC6" : "#C25AB0"} />
      </svg>
    </div>
  );
}

function Crown() {
  return (
    <svg className="ar-crown" viewBox="0 0 44 34" width="52" height="40" aria-hidden="true">
      <path d="M3 30 L6 9 L15 19 L22 4 L29 19 L38 9 L41 30 Z" fill="#FFD36B" stroke="#C98A12" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="22" cy="4" r="3" fill="#FFF1C2" />
      <circle cx="6" cy="9" r="2.4" fill="#FFF1C2" />
      <circle cx="38" cy="9" r="2.4" fill="#FFF1C2" />
    </svg>
  );
}

// MBS Oct sale window, IST: live from 9 Oct 2026 00:00 to the end of 17 Oct 2026.
const SALE_START = Date.parse("2026-10-09T00:00:00+05:30");
const SALE_END = Date.parse("2026-10-18T00:00:00+05:30");

function Countdown() {
  const [now, setNow] = useState(null); // client-only: avoids server/client time mismatch
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now == null) return <div className="ar-count ar-count-ph" aria-hidden="true" />;
  const phase = now < SALE_START ? "pre" : now < SALE_END ? "live" : "over";
  if (phase === "over") {
    return (
      <div className="ar-count over" role="status">
        <span className="ar-count-label">MBS Oct Sale has ended · final rankings below</span>
      </div>
    );
  }
  const left = Math.max(0, (phase === "pre" ? SALE_START : SALE_END) - now);
  const parts = [
    ["Days", Math.floor(left / 86400000)],
    ["Hrs", Math.floor(left / 3600000) % 24],
    ["Min", Math.floor(left / 60000) % 60],
    ["Sec", Math.floor(left / 1000) % 60],
  ];
  return (
    <div className={`ar-count ${phase}`} role="timer" aria-live="off">
      <span className="ar-count-label">
        {phase === "live" ? <span className="ar-count-dot" aria-hidden="true" /> : null}
        {phase === "pre" ? "Sale goes live in" : "Sale is LIVE · ends in"}
        <small>{phase === "pre" ? "9 Oct, 12:00 am" : "17 Oct, 11:59 pm"}</small>
      </span>
      <span className="ar-count-boxes">
        {parts.map(([lbl, v]) => (
          <span key={lbl} className="ar-count-box"><b>{String(v).padStart(2, "0")}</b><small>{lbl}</small></span>
        ))}
      </span>
    </div>
  );
}

export default function Leaderboard({ cohort, label, isOverallBoard }) {
  const storageKey = `mcc-lb-${cohort}`;
  const [data, setData] = useState(null);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState("National");
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [party, setParty] = useState(0);
  const debounce = useRef();
  const partyTimer = useRef();

  const confetti = useMemo(() => makeConfetti(46, 7), []);
  const burstL = useMemo(() => makeBurst(20, 3, -130, -50, 80, 210, false), []);
  const burstR = useMemo(() => makeBurst(20, 11, -130, -50, 80, 210, false), []);
  const bigBurst = useMemo(() => makeBurst(80, 21, 0, 360, 120, 460, true), []);

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

  useEffect(() => () => clearTimeout(partyTimer.current), []);
  const celebrate = () => {
    clearTimeout(partyTimer.current);
    setParty((n) => n + 1);
    partyTimer.current = setTimeout(() => setParty(0), 3200);
  };

  const rows = useMemo(() => {
    if (!data) return [];
    return tab === "National" ? data.national : data.regions?.[tab] || [];
  }, [data, tab]);

  const isRegional = tab !== "National";
  const isOverall = isOverallBoard ?? cohort === "overall";
  const rankOf = (r) => (isRegional ? r.regionalRank : r.nationalRank);
  const top = rows[0]?.gmv || 1;
  const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
  const rest = rows.slice(3);
  const eyebrow = isOverall ? "MBS Oct Sale · Overall" : `MBS Oct Sale · ${label}`;

  // Secondary line under the handle: only the extra rank that the left badge doesn't show.
  const metaLine = (r) => (!isOverall && isRegional ? `National #${fmtInt(r.nationalRank)}` : "");

  return (
    <div className="arena">
      <div className="ar-confetti" aria-hidden="true">
        {confetti.map((s, i) => <span key={i} className="ar-cf" style={s} />)}
      </div>

      <main className="ar-wrap">
        <header className="ar-topbar">
          <div className="ar-brandrow">
            <span className="ar-brand">Meesho Creator Club</span>
            <span className="ar-live"><span className="ar-live-dot" aria-hidden="true" />LIVE</span>
          </div>
          {data?.meta && (
            <span className="ar-updated">Last updated <b>{fmtTime(data.meta.generatedAt)}</b></span>
          )}
        </header>

        <Countdown />

        <section className="ar-hero">
          <div className="ar-hero-copy">
            <span className="ar-eyebrow">{eyebrow}</span>
            <h1>Sale Leaderboard</h1>
            <p className="ar-lede">
              {isOverall
                ? "The Overall Leaderboard — every creator who posted during the sale posting window, ranked together. Your rank is based on the sale you generate from those posts."
                : "Your rank is based on the sale you generate from posts during the sale posting window."}
            </p>
            {!isOverall && (
              <p className="ar-peer">You’re seeing creators just like you — this board groups similar-sized creators, so it’s a fair race!</p>
            )}
            <p className="ar-cta">
              {isOverall
                ? "Can’t find your username or see yourself at the top? Push harder, climb the leaderboard & win exciting rewards!"
                : "Can’t find your username on the leaderboard, or not at the top yet? Push harder, climb the leaderboard & win exciting rewards!"}
            </p>
          </div>
          <button type="button" className="ar-celebrate" onClick={celebrate}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5.8 11.3 2 22l10.7-3.79" /><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01" /><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" /><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" /></svg>
            Celebrate the top 3
            <span className="ar-shine" aria-hidden="true" />
          </button>
        </section>

        <div className="ar-controls">
          <div className="ar-tabs" role="tablist" aria-label="Leaderboard scope">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setQ(""); }}>
                {t}
              </button>
            ))}
          </div>
          <div className="ar-search">
            <svg className="ar-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              type="search"
              placeholder="Search any creator by Instagram handle, e.g. @creatorname"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search creator by Instagram handle"
            />
          </div>
        </div>

        {(stale || failed) && data && (
          <div className="ar-stale">Showing the last published leaderboard while the latest data loads.</div>
        )}

        {results !== null ? (
          <section className="ar-results" aria-live="polite">
            {results.length === 0 && (
              <p className="ar-empty">
                No creator found for “{q.trim()}”. Check the handle spelling — creators below ₹15K overall successful sale aren’t ranked yet.
              </p>
            )}
            {results.map((r) => (
              <article key={r.id} className="ar-result">
                <div className="ar-result-head">
                  <span className="ar-avatar">{initial(r)}</span>
                  <Handle r={r} className="ar-handle" />
                  <span className="ar-tag">{r.cohortLabel}</span>
                </div>
                <div className="ar-result-grid">
                  <div><small>{r.region ? `${r.region} rank` : "Regional rank"}</small><span>{r.regionalRank ? `#${fmtInt(r.regionalRank)}` : "—"}</span></div>
                  <div><small>National rank</small><span>#{fmtInt(r.nationalRank)}</span></div>
                  <div><small>Overall rank</small><span>#{fmtInt(r.overallRank)}</span></div>
                  <div><small>Orders</small><span>{fmtInt(r.orders)}</span></div>
                  <div><small>{METRIC}</small><span>{fmtINR(r.gmv)}</span></div>
                  <div><small>State</small><span>{r.state || "—"}</span></div>
                </div>
                {!r.inNationalTopN && (
                  <p className="ar-note">Ranked, but outside the displayed Top 100 national board for {r.cohortLabel}.</p>
                )}
              </article>
            ))}
          </section>
        ) : (
          <>
            {!data && !failed && <div className="ar-state">Loading leaderboard…</div>}
            {!data && failed && (
              <div className="ar-state">
                <b>Leaderboard is warming up.</b><br />
                The latest rankings will appear here shortly — try again in a minute.
              </div>
            )}

            {data && podium.length > 0 && (
              <section className="ar-stage" aria-label="Top 3">
                <div className="ar-beam left" aria-hidden="true" />
                <div className="ar-beam right" aria-hidden="true" />
                <div className="ar-floorglow" aria-hidden="true" />
                <Popper side="left" burst={burstL} />
                <Popper side="right" burst={burstR} />
                {party > 0 && (
                  <div key={party} className="ar-bigburst" aria-hidden="true">
                    {bigBurst.map((s, i) => <span key={i} className="ar-bp" style={s} />)}
                  </div>
                )}
                <div className="ar-podium">
                  {podium.map((r) => {
                    const rank = rankOf(r);
                    return (
                      <div key={r.id} className={`ar-place p${rank}`}>
                        {rank === 1 && <Crown />}
                        <div className="ar-pavatar">{initial(r)}</div>
                        <span className="ar-medal">{rank}</span>
                        <Handle r={r} className="ar-phandle" />
                        <span className="ar-psale">{fmtINR(r.gmv)}</span>
                        <span className="ar-pmeta">{fmtInt(r.orders)} orders{r.state ? ` · ${r.state}` : ""}</span>
                        <div className="ar-cap" />
                        <div className="ar-block"><span>{rank}</span></div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {data && (rows.length === 0 || rest.length > 0) && (
              <section className="ar-list">
                <div className="ar-list-head">
                  <h2>Chasing the podium</h2>
                  <span>{isRegional ? `Top 50 · ${tab}` : "Top 100 · national"} · gap to the rank above</span>
                </div>
                {rows.length === 0 && <div className="ar-state">No ranked creators in this view yet.</div>}
                <ol>
                  {rest.map((r, i) => {
                    const prev = rows[i + 2];
                    const rank = rankOf(r);
                    const meta = metaLine(r);
                    const pct = Math.max(6, Math.min(100, Math.round((r.gmv / top) * 100)));
                    const gap = prev ? prev.gmv - r.gmv : 0;
                    const close = prev && rank <= 20 && gap <= prev.gmv * 0.02; // only genuinely tight races near the top
                    const showOverall = r.overallRank != null && r.overallRank !== rank;
                    return (
                      <li key={r.id} className={`ar-row${rank <= 10 ? " top10" : ""}`} style={{ animationDelay: `${Math.min(i, 14) * 45}ms` }}>
                        <span className="ar-rankbox">
                          <span className="ar-rank">#{rank}</span>
                          {showOverall && <span className="ar-ovr"><small>Overall</small>#{fmtInt(r.overallRank)}</span>}
                        </span>
                        <span className="ar-avatar">{initial(r)}</span>
                        <span className="ar-who">
                          <Handle r={r} className="ar-handle" />
                          <small>{r.state || "—"}{!isRegional && r.region ? ` · ${r.region}` : ""}{meta ? ` · ${meta}` : ""}</small>
                        </span>
                        <span className="ar-orders"><b>{fmtInt(r.orders)}</b> orders</span>
                        <span className="ar-sale">{fmtINR(r.gmv)}</span>
                        <span className="ar-gap">
                          <span className="ar-bar"><span style={{ width: `${pct}%` }} /></span>
                          <small>
                            {prev ? `${fmtINR(gap)} behind #${rankOf(prev)}` : ""}
                            {close && <span className="ar-hot">Close race</span>}
                          </small>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
