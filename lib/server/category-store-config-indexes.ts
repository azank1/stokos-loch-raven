import "server-only";

import CategoryStoreConfig from "@/models/categorystoreconfig";

const CATEGORY_STORE_INDEX_NAME = "unique_category_store_config";
const CATEGORY_STORE_INDEX_KEY = { categoryId: 1, storeId: 1 } as const;

let indexesPromise: Promise<void> | null = null;

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function sameIndexKey(first: any, second: Record<string, 1 | -1>) {
  const firstKeys = Object.keys(first || {});
  const secondKeys = Object.keys(second || {});

  if (firstKeys.length !== secondKeys.length) return false;

  return secondKeys.every((key) => Number(first?.[key]) === Number(second[key]));
}

function isCategoryStoreIndex(index: any) {
  const keys = Object.keys(index?.key || {});
  return keys.some((key) =>
    ["categoryId", "storeId", "categorySlug"].includes(cleanString(key)),
  );
}

async function ensureIndexesNow() {
  const collection = CategoryStoreConfig.collection;
  const indexes = await collection.indexes();

  for (const index of indexes as any[]) {
    const indexName = cleanString(index?.name);

    if (!indexName || indexName === "_id_") continue;
    if (!index?.unique) continue;
    if (!isCategoryStoreIndex(index)) continue;
    if (sameIndexKey(index.key, CATEGORY_STORE_INDEX_KEY)) continue;

    try {
      await collection.dropIndex(indexName);
      console.warn(`Dropped stale CategoryStoreConfig unique index: ${indexName}`);
    } catch (error: any) {
      console.warn(
        `Could not drop stale CategoryStoreConfig index ${indexName}:`,
        error?.message || error,
      );
    }
  }

  try {
    await collection.createIndex(CATEGORY_STORE_INDEX_KEY, {
      unique: true,
      name: CATEGORY_STORE_INDEX_NAME,
      background: true,
    });
  } catch (error: any) {
    console.warn(
      "Could not create CategoryStoreConfig categoryId+storeId unique index:",
      error?.message || error,
    );
  }
}

export async function ensureCategoryStoreConfigIndexes() {
  if (!indexesPromise) {
    indexesPromise = ensureIndexesNow().catch((error) => {
      indexesPromise = null;
      console.warn(
        "CategoryStoreConfig index repair failed:",
        error?.message || error,
      );
    });
  }

  await indexesPromise;
}
