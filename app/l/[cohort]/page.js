import { notFound } from "next/navigation";
import { COHORTS } from "@/lib/process";
import { COHORT_SLUGS, resolveSlug } from "@/lib/slugs";
import Leaderboard from "@/components/Leaderboard";

export const dynamicParams = false; // anything not listed below → 404 (incl. old /l/c1…c4)

export function generateStaticParams() {
  return ["overall", ...Object.values(COHORT_SLUGS)].map((cohort) => ({ cohort }));
}

export function generateMetadata({ params }) {
  const key = resolveSlug(params.cohort);
  const label = key === "overall" ? "Overall" : COHORTS[key]?.label;
  return label
    ? { title: `MBS Oct Sale Leaderboard — ${label}`, robots: { index: false, follow: false } }
    : {};
}

export default function CohortPage({ params }) {
  const key = resolveSlug(params.cohort);
  if (!key) notFound();
  const label = key === "overall" ? "Overall" : COHORTS[key].label;
  // `cohort` prop stays the URL slug; the API resolves it server-side
  return <Leaderboard cohort={params.cohort} label={label} isOverallBoard={key === "overall"} />;
}
