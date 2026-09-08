// lib/store.js — Vercel Blob persistence with "never go blank" semantics.
// current.json is only overwritten AFTER validation passes, so it always
// holds the last successfully published dataset.

import { put, list } from "@vercel/blob";

const CURRENT = "leaderboard/current.json";
const PREVIOUS = "leaderboard/previous.json";

// Module-scope cache: survives across requests on a warm lambda and is the
// in-process fallback if Blob is briefly unreachable.
let cache = { data: null, fetchedAt: 0, url: null };
const TTL_MS = 60_000;

async function currentUrl() {
  if (cache.url) return cache.url;
  const { blobs } = await list({ prefix: CURRENT });
  cache.url = blobs?.[0]?.url || null;
  return cache.url;
}

export async function readDataset() {
  const fresh = Date.now() - cache.fetchedAt < TTL_MS;
  if (cache.data && fresh) return cache.data;
  try {
    const url = await currentUrl();
    if (!url) return cache.data; // nothing published yet
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`blob fetch ${res.status}`);
    const data = await res.json();
    cache = { data, fetchedAt: Date.now(), url };
    return data;
  } catch (e) {
    // Backend hiccup → keep serving the last dataset we have in memory.
    console.error("readDataset fallback:", e.message);
    return cache.data;
  }
}

export async function publishDataset(dataset) {
  // 1. Back up the current dataset (best-effort)
  try {
    const prev = await readDataset();
    if (prev) {
      await put(PREVIOUS, JSON.stringify(prev), {
        access: "public", contentType: "application/json",
        allowOverwrite: true, cacheControlMaxAge: 60, addRandomSuffix: false,
      });
    }
  } catch (e) {
    console.error("previous backup skipped:", e.message);
  }
  // 2. Atomically replace current with the new validated dataset
  const blob = await put(CURRENT, JSON.stringify(dataset), {
    access: "public", contentType: "application/json",
    allowOverwrite: true, cacheControlMaxAge: 60, addRandomSuffix: false,
  });
  cache = { data: dataset, fetchedAt: Date.now(), url: blob.url };
  return blob.url;
}
