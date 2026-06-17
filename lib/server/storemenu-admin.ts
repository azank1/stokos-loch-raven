import "server-only";

import mongoose from "mongoose";
import { revalidatePath, revalidateTag } from "next/cache";
import connectDB from "@/lib/mongodb";
import { STORES } from "@/lib/data/stores";
import Store from "@/models/store";
import { rebuildStoreMenu } from "@/lib/server/storemenu-rebuilder";
import { clearStoreMenuSnapshotCache } from "@/lib/server/storemenu-snapshot";

type AnyObject = Record<string, any>;

type ExtractResult = {
  allStores: boolean;
  storeKeys: string[];
};

const STORE_FIELD_KEYS = new Set([
  "store",
  "stores",
  "storeid",
  "storeids",
  "storeslug",
  "storeslugs",
  "selectedstore",
  "selectedstores",
  "selectedstoreid",
  "selectedstoreids",
  "selectedstoreslug",
  "selectedstoreslugs",
]);

const NESTED_KEYS_TO_SCAN = new Set([
  "data",
  "config",
  "configs",
  "storeconfig",
  "storeconfigs",
  "assignments",
  "assignment",
  "categoryconfigs",
  "productstoreconfigs",
  "upsellstoreconfigs",
]);

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanStoreSlug(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isAllStoresValue(value: unknown) {
  const clean = cleanString(value).toLowerCase();
  const slug = cleanStoreSlug(clean);

  return ["all", "all-stores", "all_store", "*"].includes(clean) ||
    ["all", "all-stores"].includes(slug);
}

function getDefaultStoreSlugs() {
  const fromStoreList = (Array.isArray(STORES) ? STORES : [])
    .map((store: any) => cleanStoreSlug(store?.slug || store?.id || store?.name))
    .filter(Boolean);

  return Array.from(new Set(fromStoreList.length ? fromStoreList : ["towson", "liberty", "york"]));
}

function addStoreKey(value: unknown, output: Set<string>) {
  if (value === null || value === undefined) return false;

  if (Array.isArray(value)) {
    let allStores = false;
    value.forEach((item) => {
      if (addStoreKey(item, output)) allStores = true;
    });
    return allStores;
  }

  if (typeof value === "object") {
    const obj = value as AnyObject;
    let allStores = false;

    const directValues = [
      obj.storeId,
      obj.storeSlug,
      obj.store,
      obj.slug,
      obj.id,
      obj._id,
      obj.name,
    ];

    directValues.forEach((item) => {
      if (item === null || item === undefined) return;
      if (isAllStoresValue(item)) allStores = true;
      const clean = cleanString(item);
      if (clean && !isAllStoresValue(clean)) output.add(clean);
    });

    return allStores;
  }

  if (isAllStoresValue(value)) return true;

  const clean = cleanString(value);
  if (clean) output.add(clean);

  return false;
}

function scanValue(value: unknown, output: Set<string>): boolean {
  if (value === null || value === undefined) return false;

  if (Array.isArray(value)) {
    let allStores = false;
    value.forEach((item) => {
      if (scanValue(item, output)) allStores = true;
    });
    return allStores;
  }

  if (typeof value !== "object") return false;

  const obj = value as AnyObject;
  let allStores = obj.rebuildAllStores === true || obj.allStores === true;

  Object.entries(obj).forEach(([key, item]) => {
    const cleanKey = cleanStoreSlug(key).replace(/-/g, "");

    if (STORE_FIELD_KEYS.has(cleanKey)) {
      if (addStoreKey(item, output)) allStores = true;
      return;
    }

    if (NESTED_KEYS_TO_SCAN.has(cleanKey)) {
      if (scanValue(item, output)) allStores = true;
    }
  });

  return allStores;
}

function extractStoreKeys(...sources: unknown[]): ExtractResult {
  const storeKeys = new Set<string>();
  let allStores = false;

  sources.forEach((source) => {
    if (typeof source === "string" || typeof source === "number") {
      if (addStoreKey(source, storeKeys)) allStores = true;
      return;
    }

    if (scanValue(source, storeKeys)) allStores = true;
  });

  return {
    allStores,
    storeKeys: Array.from(storeKeys),
  };
}

async function resolveStoreSlugs(storeKeys: string[], allStores = false) {
  const defaultStoreSlugs = getDefaultStoreSlugs();

  if (allStores || storeKeys.length === 0) {
    return defaultStoreSlugs;
  }

  const cleanKeys = Array.from(
    new Set(storeKeys.map((value) => cleanString(value)).filter(Boolean))
  );

  const cleanSlugs = cleanKeys.map(cleanStoreSlug).filter(Boolean);
  const objectIds = cleanKeys
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

  const storeQuery: any[] = [
    { slug: { $in: cleanSlugs } },
    { id: { $in: cleanKeys } },
    { name: { $in: cleanKeys } },
  ];

  if (objectIds.length) {
    storeQuery.push({ _id: { $in: objectIds } });
  }

  try {
    await connectDB();

    const stores = await Store.find({ $or: storeQuery })
      .select({ _id: 1, id: 1, name: 1, slug: 1 })
      .lean<any[]>();

    const resolvedSlugs = stores
      .map((store) => cleanStoreSlug(store?.slug || store?.id || store?.name))
      .filter(Boolean);

    const directStoreSlugs = cleanSlugs.filter((slug) =>
      defaultStoreSlugs.includes(slug)
    );

    const slugs = Array.from(new Set([...resolvedSlugs, ...directStoreSlugs]));

    if (slugs.length > 0) return slugs;
  } catch (error: any) {
    console.warn("Store slug resolve failed before StoreMenu rebuild:", error?.message || error);
  }

  return Array.from(new Set(cleanSlugs.filter(Boolean)));
}

export async function rebuildStoreMenusAfterAdminChange(
  ...sources: unknown[]
) {
  const { allStores, storeKeys } = extractStoreKeys(...sources);
  const storeSlugs = await resolveStoreSlugs(storeKeys, allStores);

  if (!storeSlugs.length) return { rebuiltStores: [], failedStores: [] };

  const reasonSource = sources.find(
    (source: any) => source && typeof source === "object" && cleanString(source.reason)
  ) as AnyObject | undefined;

  const reason = cleanString(reasonSource?.reason) || "admin-change";

  const results = await Promise.allSettled(
    storeSlugs.map(async (storeSlug) => {
      const cleanSlug = cleanStoreSlug(storeSlug);
      if (!cleanSlug) return null;

      clearStoreMenuSnapshotCache(cleanSlug);
      await rebuildStoreMenu(cleanSlug, reason);
      clearStoreMenuSnapshotCache(cleanSlug);

      revalidatePath(`/store/${cleanSlug}`);
revalidateTag("store-menu", "max");
revalidateTag("store-menu-categories", "max");

      return cleanSlug;
    })
  );

  const rebuiltStores: string[] = [];
  const failedStores: string[] = [];

  results.forEach((result, index) => {
    const storeSlug = storeSlugs[index];

    if (result.status === "fulfilled" && result.value) {
      rebuiltStores.push(result.value);
      return;
    }

    failedStores.push(storeSlug);

    if (result.status === "rejected") {
      console.warn(
        `StoreMenu rebuild failed for ${storeSlug}:`,
        result.reason?.message || result.reason
      );
    }
  });

  return { rebuiltStores, failedStores };
}

export const rebuildStoreMenuAfterAdminChange = rebuildStoreMenusAfterAdminChange;
