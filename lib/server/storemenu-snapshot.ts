import "server-only";

import connectDB from "@/lib/mongodb";
import StoreMenu from "@/models/storemenu";

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function normalizeStoreSlug(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  const number = Number(cleanString(value).replace(/[^0-9.-]/g, "") || fallback);
  return Number.isFinite(number) ? number : fallback;
}

function toPlainJSON<T>(value: T, fallback: T): T {
  try {
    if (value === undefined || value === null) return fallback;
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return fallback;
  }
}

export type StoreMenuSnapshotStatus =
  | "ready"
  | "building"
  | "failed"
  | "missing"
  | "empty"
  | "timeout"
  | "error"
  | "stale";

export type StoreMenuSnapshot = {
  storeSlug: string;
  categories: any[];
  products: any[];
  menuProducts: any[];
  version?: number;
  builtAt?: Date | string | null;
  status?: StoreMenuSnapshotStatus | string;
};

type CachedSnapshot = {
  data: StoreMenuSnapshot;
  expiresAt: number;
};

const SNAPSHOT_CACHE_TTL_MS = cleanNumber(
  process.env.STORE_MENU_SNAPSHOT_CACHE_TTL_MS,
  30_000
);

const SNAPSHOT_READ_TIMEOUT_MS = cleanNumber(
  process.env.STORE_MENU_SNAPSHOT_READ_TIMEOUT_MS,
  2_500
);

const SNAPSHOT_QUERY_MAX_TIME_MS = cleanNumber(
  process.env.STORE_MENU_SNAPSHOT_QUERY_MAX_TIME_MS,
  1_500
);

const snapshotMemoryCache = new Map<string, CachedSnapshot>();

function createEmptySnapshot(
  storeSlug: string,
  status: StoreMenuSnapshotStatus | string = "missing"
): StoreMenuSnapshot {
  return {
    storeSlug,
    categories: [],
    products: [],
    menuProducts: [],
    builtAt: null,
    status,
  };
}

function getCachedSnapshot(storeSlug: string, allowExpired = false) {
  const cached = snapshotMemoryCache.get(storeSlug);
  if (!cached) return null;

  if (!allowExpired && cached.expiresAt <= Date.now()) {
    return null;
  }

  return cached.data;
}

function setCachedSnapshot(storeSlug: string, data: StoreMenuSnapshot) {
  snapshotMemoryCache.set(storeSlug, {
    data,
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
  });
}

export function clearStoreMenuSnapshotCache(storeSlug?: string) {
  const cleanStoreSlug = normalizeStoreSlug(storeSlug);

  if (cleanStoreSlug) {
    snapshotMemoryCache.delete(cleanStoreSlug);
    return;
  }

  snapshotMemoryCache.clear();
}

function normalizeSnapshotDocument(
  storeSlug: string,
  snapshot: any
): StoreMenuSnapshot {
  if (!snapshot) return createEmptySnapshot(storeSlug, "missing");

  const categories = toPlainJSON<any[]>(
    Array.isArray(snapshot.categories) ? snapshot.categories : [],
    []
  );

  const products = toPlainJSON<any[]>(
    Array.isArray(snapshot.products)
      ? snapshot.products
      : Array.isArray(snapshot.menuProducts)
        ? snapshot.menuProducts
        : [],
    []
  );

  return {
    storeSlug,
    categories,
    products,
    menuProducts: products,
    version: snapshot.version,
    builtAt: snapshot.builtAt ? toPlainJSON(snapshot.builtAt, snapshot.builtAt) : null,
    status: snapshot.status || "ready",
  };
}

async function readSnapshotFromDB(storeSlug: string) {
  await connectDB();

  const snapshot = await StoreMenu.findOne({ storeSlug })
    .select({
      _id: 0,
      storeSlug: 1,
      categories: 1,
      products: 1,
      menuProducts: 1,
      version: 1,
      builtAt: 1,
      status: 1,
    })
    .sort({ version: -1, builtAt: -1, updatedAt: -1 })
    .maxTimeMS(SNAPSHOT_QUERY_MAX_TIME_MS)
    .lean<any>();

  return normalizeSnapshotDocument(storeSlug, snapshot);
}

export async function getStoreMenuSnapshot(
  storeSlug: string
): Promise<StoreMenuSnapshot> {
  const cleanStoreSlug = normalizeStoreSlug(storeSlug);

  if (!cleanStoreSlug) {
    return createEmptySnapshot("", "empty");
  }

  const freshCachedSnapshot = getCachedSnapshot(cleanStoreSlug);
  if (freshCachedSnapshot) return freshCachedSnapshot;

  const staleCachedSnapshot = getCachedSnapshot(cleanStoreSlug, true);

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const readPromise = readSnapshotFromDB(cleanStoreSlug)
    .then((snapshot) => {
      setCachedSnapshot(cleanStoreSlug, snapshot);
      return snapshot;
    })
    .catch((error) => {
      console.error(`StoreMenu snapshot read failed for ${cleanStoreSlug}:`, error);
      throw error;
    });

  const timeoutPromise = new Promise<StoreMenuSnapshot>((resolve) => {
    timeoutId = setTimeout(() => {
      if (staleCachedSnapshot) {
        resolve({ ...staleCachedSnapshot, status: "stale" });
        return;
      }

      resolve(createEmptySnapshot(cleanStoreSlug, "timeout"));
    }, SNAPSHOT_READ_TIMEOUT_MS);
  });

  try {
    const snapshot = await Promise.race([readPromise, timeoutPromise]);
    return snapshot;
  } catch {
    if (staleCachedSnapshot) {
      return { ...staleCachedSnapshot, status: "stale" };
    }

    return createEmptySnapshot(cleanStoreSlug, "error");
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
