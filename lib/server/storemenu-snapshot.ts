import "server-only";

import connectDB from "@/lib/mongodb";
import StoreMenu from "@/models/storemenu";

export type StoreMenuSnapshot = {
  storeSlug: string;
  categories: any[];
  products: any[];
  menuProducts: any[];
  version?: number;
  builtAt?: Date | string | null;
  status?: string;
};

const snapshotCache = new Map<
  string,
  { data: StoreMenuSnapshot; expiresAt: number }
>();

const SNAPSHOT_CACHE_TTL_MS = 60_000;
const EMPTY_SNAPSHOT_CACHE_TTL_MS = 5_000;

function normalizeStoreSlug(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptySnapshot(storeSlug: string, status = "missing"): StoreMenuSnapshot {
  return {
    storeSlug,
    categories: [],
    products: [],
    menuProducts: [],
    builtAt: null,
    status,
  };
}

function getCachedSnapshot(storeSlug: string) {
  const cached = snapshotCache.get(storeSlug);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    snapshotCache.delete(storeSlug);
    return null;
  }

  return cached.data;
}

function setCachedSnapshot(
  storeSlug: string,
  data: StoreMenuSnapshot,
  ttlMs = SNAPSHOT_CACHE_TTL_MS
) {
  snapshotCache.set(storeSlug, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearStoreMenuSnapshotCache(storeSlug?: string) {
  if (!storeSlug) {
    snapshotCache.clear();
    return;
  }

  const cleanStoreSlug = normalizeStoreSlug(storeSlug);
  if (cleanStoreSlug) snapshotCache.delete(cleanStoreSlug);
}

export async function getStoreMenuSnapshot(
  storeSlug: string
): Promise<StoreMenuSnapshot> {
  const cleanStoreSlug = normalizeStoreSlug(storeSlug);

  if (!cleanStoreSlug) return emptySnapshot("", "empty");

  const cached = getCachedSnapshot(cleanStoreSlug);
  if (cached) return cached;

  try {
    await connectDB();

    const snapshot = await StoreMenu.findOne({
      storeSlug: cleanStoreSlug,
    })
      .select({
        _id: 0,
        storeSlug: 1,
        products: 1,
        // Keep only for old snapshots. New snapshots save menuProducts as [].
        menuProducts: 1,
        version: 1,
        builtAt: 1,
        status: 1,
      })
      .lean<any>();

    if (!snapshot) {
      const result = emptySnapshot(cleanStoreSlug, "missing");
      setCachedSnapshot(cleanStoreSlug, result, EMPTY_SNAPSHOT_CACHE_TTL_MS);
      return result;
    }

    const products =
      Array.isArray(snapshot?.products) && snapshot.products.length > 0
        ? snapshot.products
        : Array.isArray(snapshot?.menuProducts)
          ? snapshot.menuProducts
          : [];

    const result: StoreMenuSnapshot = {
      storeSlug: cleanStoreSlug,
      // Categories are intentionally not read from StoreMenu snapshot anymore.
      // Frontend categories must come from CategoryStoreConfig via menucategories.ts.
      categories: [],
      products,
      menuProducts: products,
      version: snapshot?.version,
      builtAt: snapshot?.builtAt || null,
      status: snapshot?.status || "ready",
    };

    setCachedSnapshot(cleanStoreSlug, result);
    return result;
  } catch (error: any) {
    console.warn(
      `StoreMenu snapshot read failed for ${cleanStoreSlug}:`,
      error?.message || error
    );

    return emptySnapshot(cleanStoreSlug, "read-failed");
  }
}
