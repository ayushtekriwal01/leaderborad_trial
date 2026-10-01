// Private, hard-to-guess URL slugs for the cohort boards. Only "overall" is public.
// Share each cohort link only with that cohort's creators.
export const COHORT_SLUGS = {
  c1: "anyfw95n5c", // ₹15K – ₹1L
  c2: "5lwlfv230n", // ₹1L – ₹3L
  c3: "2q4g5ztv9i", // ₹3L – ₹7L
  c4: "l9ahxitstw", // ₹7L+
};
const BY_SLUG = Object.fromEntries(Object.entries(COHORT_SLUGS).map(([k, s]) => [s, k]));
// slug → "overall" | cohort key | null
export function resolveSlug(slug) {
  if (slug === "overall") return "overall";
  return BY_SLUG[slug] || null;
}
