import Link from "next/link";
import { COHORTS } from "@/lib/process";

export default function Home() {
  return (
    <main className="wrap">
      <header className="masthead">
        <span className="brand">Meesho Creator Club</span>
        <h1>Creator Leaderboard</h1>
        <p className="sub">
          National and regional sale rankings, refreshed every hour.
          Pick your cohort to see where you stand.
        </p>
      </header>
      <div className="cohort-cards">
        {Object.entries(COHORTS).map(([key, c]) => (
          <Link key={key} href={`/l/${key}?nav=1`} className="cohort-card">
            <div className="range">{c.label}</div>
            <div className="desc">Lifetime NMV cohort · Top 100 national · Top 50 per region</div>
            <div className="go">Open leaderboard</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
