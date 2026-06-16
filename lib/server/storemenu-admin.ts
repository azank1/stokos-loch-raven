import "server-only";

import mongoose from "mongoose";
import { revalidatePath, revalidateTag } from "next/cache";
import connectDB from "@/lib/mongodb";
import Store from "@/models/store";
import { STORES } from "@/lib/data/stores";
import { rebuildStoreMenu } from "@/lib/server/storemenu-rebuilder";
import { clearStoreMenuSnapshotCache } from "@/lib/server/storemenu-snapshot";

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

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addValue(set: Set<string>, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item) => addValue(set, item));
    return;
  }

  if (isPlainObject(value)) {
    collectStoreValuesFromSource(value, set);
    return;
  }

  const clean = cleanString(value);
  if (clean) set.add(clean);
}

function collectStoreValuesFromSource(source: unknown, set: Set<string>) {
  if (!source) return;

  if (Array.isArray(source)) {
    source.forEach((item) => collectStoreValuesFromSource(item, set));
    return;
  }

  if (!isPlainObject(source)) return;

  addValue(set, source.storeSlug);
  addValue(set, source.storeSlugs);
  addValue(set, source.storeId);
  addValue(set, source.storeIds);
  addValue(set, source.store);
  addValue(set, source.stores);

  if (Array.isArray(source.storeConfigs)) {
    source.storeConfigs.forEach((config) =>
      collectStoreValuesFromSource(config, set)
    );
  }

  if (Array.isArray(source.assignments)) {
    source.assignments.forEach((assignment) =>
      collectStoreValuesFromSource(assignment, set)
    );
  }

  if (Array.isArray(source.data)) {
    source.data.forEach((item) => collectStoreValuesFromSource(item, set));
  }
}

function getStaticStoreSlugs() {
  return (Array.isArray(STORES) ? STORES : [])
    .map((store) => normalizeStoreSlug(store?.slug))
    .filter(Boolean);
}

export async function resolveAffectedStoreSlugs(...sources: unknown[]) {
  await connectDB();

  const rawValues = new Set<string>();
  sources.forEach((source) => collectStoreValuesFromSource(source, rawValues));

  const values = Array.from(rawValues).map(cleanString).filter(Boolean);

  if (!values.length) {
    const resolved = new Set<string>(getStaticStoreSlugs());

    const stores = await Store.find({
      $or: [
        { status: "Active" },
        { status: "active" },
        { status: { $exists: false } },
        { status: "" },
      ],
    })
      .select({ slug: 1 })
      .sort({ sortOrder: 1, name: 1 })
      .lean<any[]>();

    stores.forEach((store) => {
      const slug = normalizeStoreSlug(store.slug);
      if (slug) resolved.add(slug);
    });

    return Array.from(resolved);
  }

  const objectIds = values
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

  const normalizedValues = values.map(normalizeStoreSlug).filter(Boolean);

  const orQuery: any[] = [
    { slug: { $in: normalizedValues } },
    { id: { $in: values } },
  ];

  if (objectIds.length) {
    orQuery.push({ _id: { $in: objectIds } });
  }

  const stores = await Store.find({ $or: orQuery })
    .select({ slug: 1 })
    .lean<any[]>();

  const resolved = new Set<string>();

  stores.forEach((store) => {
    const slug = normalizeStoreSlug(store.slug);
    if (slug) resolved.add(slug);
  });

  values.forEach((value) => {
    const slug = normalizeStoreSlug(value);

    if (slug && !mongoose.Types.ObjectId.isValid(value)) {
      resolved.add(slug);
    }
  });

  return Array.from(resolved);
}

function safeRevalidateTag(tag: string) {
  try {
    (revalidateTag as any)(tag, "max");
  } catch {
    try {
      (revalidateTag as any)(tag);
    } catch {
      // Ignore revalidation errors in local/dev runtime.
    }
  }
}

export function revalidateStoreMenuPublicCache(storeSlug: string) {
  const slug = normalizeStoreSlug(storeSlug);
  if (!slug) return;

  clearStoreMenuSnapshotCache(slug);

  safeRevalidateTag("store-menu");
  safeRevalidateTag("store-menu-categories");
  safeRevalidateTag("store-menu-products");
  safeRevalidateTag("store-menu-snapshot");
  safeRevalidateTag(`store-menu-snapshot:${slug}`);

  revalidatePath(`/store/${slug}`);
}

export async function rebuildStoreMenusAfterAdminChange(...sources: unknown[]) {
  const storeSlugs = await resolveAffectedStoreSlugs(...sources);

  storeSlugs.forEach((slug) => revalidateStoreMenuPublicCache(slug));

  // Sequential rebuild avoids Atlas timeouts when multiple stores are rebuilt together.
  const results: PromiseSettledResult<any>[] = [];

  for (const slug of storeSlugs) {
    try {
      const snapshot = await rebuildStoreMenu(slug, "admin-change");
      results.push({ status: "fulfilled", value: snapshot });
    } catch (error) {
      results.push({ status: "rejected", reason: error });
    }
  }

  storeSlugs.forEach((slug) => revalidateStoreMenuPublicCache(slug));

  const failed = results
    .map((result, index) => ({
      result,
      storeSlug: storeSlugs[index],
    }))
    .filter((item) => item.result.status === "rejected");

  if (failed.length) {
    console.error(
      "Store menu snapshot rebuild failed:",
      failed.map((item) => ({
        storeSlug: item.storeSlug,
        reason:
          (item.result as PromiseRejectedResult).reason?.message ||
          (item.result as PromiseRejectedResult).reason,
      }))
    );
  }

  return {
    storeSlugs,
    rebuilt: results.filter((result) => result.status === "fulfilled").length,
    failed: failed.length,
  };
}
