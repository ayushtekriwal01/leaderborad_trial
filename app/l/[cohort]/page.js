import { notFound } from "next/navigation";
import { COHORTS } from "@/lib/process";
import Leaderboard from "@/components/Leaderboard";

export function generateStaticParams() {
  return [...Object.keys(COHORTS), "overall"].map((cohort) => ({ cohort }));
}

export function generateMetadata({ params }) {
  const label = params.cohort === "overall" ? "Overall" : COHORTS[params.cohort]?.label;
  return label ? { title: `Creator Leaderboard — ${label}` } : {};
}

export default function CohortPage({ params }) {
  const { cohort } = params;
  if (cohort !== "overall" && !COHORTS[cohort]) notFound();
  const label = cohort === "overall" ? "Overall" : COHORTS[cohort].label;
  return <Leaderboard cohort={cohort} label={label} />;
}
