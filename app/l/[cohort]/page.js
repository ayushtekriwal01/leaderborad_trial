import { notFound } from "next/navigation";
import { COHORTS } from "@/lib/process";
import Leaderboard from "@/components/Leaderboard";

export function generateStaticParams() {
  return Object.keys(COHORTS).map((cohort) => ({ cohort }));
}

export function generateMetadata({ params }) {
  const c = COHORTS[params.cohort];
  return c ? { title: `Creator Leaderboard — ${c.label}` } : {};
}

export default function CohortPage({ params }) {
  const { cohort } = params;
  if (!COHORTS[cohort]) notFound();
  return <Leaderboard cohort={cohort} label={COHORTS[cohort].label} />;
}
