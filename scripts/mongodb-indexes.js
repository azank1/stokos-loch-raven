/*
  Run once from project root after replacing the files:

  node --env-file=.env.local scripts/mongodb-indexes.js

  What this script fixes:
  1) Prints current categorystoreconfigs indexes.
  2) Drops dangerous old unique indexes like { categoryId: 1 } or { categorySlug: 1 }.
  3) Normalizes existing category store config rows.
  4) Deletes duplicate rows for the same categoryId + storeId pair.
  5) Creates the correct unique index: { categoryId: 1, storeId: 1 }.
*/

const { MongoClient, ObjectId } = require("mongodb");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanString(value) {
  return String(value || "").trim();
}

function cleanNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function cleanStatus(value) {
  const status = cleanString(value);
  return ["Active", "Hidden", "Inactive"].includes(status) ? status : "Active";
}

function sameKey(first, second) {
  return JSON.stringify(first || {}) === JSON.stringify(second || {});
}

function isCorrectUniqueCategoryStoreIndex(index) {
  return Boolean(index.unique) && sameKey(index.key, { categoryId: 1, storeId: 1 });
}

async function printIndexes(collection, label) {
  const indexes = await collection.indexes();
  console.log(`\n${label}`);
  indexes.forEach((index) => {
    console.log(`- ${index.name}: ${JSON.stringify(index.key)}${index.unique ? " UNIQUE" : ""}`);
  });
  return indexes;
}

async function dropDangerousCategoryStoreIndexes(collection) {
  const indexes = await collection.indexes();

  for (const index of indexes) {
    if (index.name === "_id_") continue;

    const hasCategoryFields = Object.prototype.hasOwnProperty.call(index.key || {}, "categoryId") ||
      Object.prototype.hasOwnProperty.call(index.key || {}, "categorySlug");

    const wrongNamedIndex =
      index.name === "unique_category_store_config" && !isCorrectUniqueCategoryStoreIndex(index);

    const dangerousUniqueIndex = Boolean(index.unique) && hasCategoryFields && !isCorrectUniqueCategoryStoreIndex(index);

    if (!wrongNamedIndex && !dangerousUniqueIndex) continue;

    console.log(`Dropping bad index: ${index.name} ${JSON.stringify(index.key)}${index.unique ? " UNIQUE" : ""}`);
    await collection.dropIndex(index.name);
  }
}

function normalizeConfig(doc) {
  const categoryId = cleanString(doc.categoryId instanceof ObjectId ? doc.categoryId.toString() : doc.categoryId);
  const storeId = slugify(doc.storeId || doc.storeSlug || doc.store || "");
  const categoryName = cleanString(doc.categoryName || doc.name || doc.title || "");
  const categorySlug = slugify(doc.categorySlug || doc.slug || categoryName);
  const available = doc.available !== false && doc.isAvailable !== false;

  return {
    categoryId,
    storeId,
    categoryName,
    categorySlug,
    available,
    isAvailable: available,
    status: cleanStatus(doc.status),
    sortOrder: cleanNumber(doc.sortOrder),
  };
}

function newestFirst(a, b) {
  const aUpdated = new Date(a.updatedAt || a.createdAt || a._id.getTimestamp()).getTime();
  const bUpdated = new Date(b.updatedAt || b.createdAt || b._id.getTimestamp()).getTime();

  if (aUpdated !== bUpdated) return bUpdated - aUpdated;
  return String(b._id).localeCompare(String(a._id));
}

async function normalizeAndDedupeCategoryStoreConfigs(collection) {
  const docs = await collection.find({}).toArray();
  const invalidIds = [];
  const docsByKey = new Map();

  for (const doc of docs) {
    const normalized = normalizeConfig(doc);

    if (!normalized.categoryId || !normalized.storeId) {
      invalidIds.push(doc._id);
      continue;
    }

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          ...normalized,
          updatedAt: new Date(),
        },
      }
    );

    const key = `${normalized.categoryId}::${normalized.storeId}`;
    if (!docsByKey.has(key)) docsByKey.set(key, []);
    docsByKey.get(key).push({ ...doc, ...normalized });
  }

  const duplicateIds = [];

  for (const rows of docsByKey.values()) {
    rows.sort(newestFirst);
    duplicateIds.push(...rows.slice(1).map((doc) => doc._id));
  }

  const deleteIds = [...invalidIds, ...duplicateIds];

  if (deleteIds.length > 0) {
    const result = await collection.deleteMany({ _id: { $in: deleteIds } });
    console.log(`Deleted invalid/duplicate category store config rows: ${result.deletedCount}`);
  } else {
    console.log("No invalid/duplicate category store config rows found.");
  }
}

async function ensureIndex(collection, key, options = {}) {
  const indexes = await collection.indexes();
  const existingSameName = options.name ? indexes.find((index) => index.name === options.name) : null;

  if (existingSameName) {
    const sameOptions =
      sameKey(existingSameName.key, key) &&
      Boolean(existingSameName.unique) === Boolean(options.unique);

    if (!sameOptions) {
      console.log(`Dropping index with changed definition: ${existingSameName.name}`);
      await collection.dropIndex(existingSameName.name);
    }
  }

  await collection.createIndex(key, options);
}

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing. Run with: node --env-file=.env.local scripts/mongodb-indexes.js");
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  });

  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "stokos");

  const categoryStoreConfigs = db.collection("categorystoreconfigs");

  await printIndexes(categoryStoreConfigs, "Before categorystoreconfigs indexes:");
  await dropDangerousCategoryStoreIndexes(categoryStoreConfigs);
  await normalizeAndDedupeCategoryStoreConfigs(categoryStoreConfigs);

  await Promise.all([
    ensureIndex(db.collection("stores"), { slug: 1, status: 1 }, { name: "slug_status" }),

    ensureIndex(
      db.collection("productstoreconfigs"),
      { storeId: 1, status: 1, isAvailable: 1, available: 1, sortOrder: 1, updatedAt: -1 },
      { name: "store_product_visible_sort" }
    ),
    ensureIndex(
      db.collection("productstoreconfigs"),
      { storeId: 1, productId: 1, status: 1 },
      { name: "store_product_status" }
    ),
    ensureIndex(db.collection("productstoreconfigs"), { productId: 1 }, { name: "productId_lookup" }),

    ensureIndex(db.collection("products"), { status: 1, _id: 1 }, { name: "status_id" }),
    ensureIndex(db.collection("products"), { status: 1, id: 1 }, { name: "status_legacy_id" }),
    ensureIndex(db.collection("products"), { status: 1, slug: 1 }, { name: "status_slug" }),

    ensureIndex(
      categoryStoreConfigs,
      { categoryId: 1, storeId: 1 },
      { unique: true, name: "unique_category_store_config" }
    ),
    ensureIndex(
      categoryStoreConfigs,
      { storeId: 1, status: 1, isAvailable: 1, available: 1, sortOrder: 1, updatedAt: -1 },
      { name: "store_category_visible_sort" }
    ),
    ensureIndex(categoryStoreConfigs, { storeId: 1, status: 1, sortOrder: 1 }, { name: "store_status_sort" }),
    ensureIndex(categoryStoreConfigs, { categoryId: 1 }, { name: "categoryId_lookup" }),
    ensureIndex(categoryStoreConfigs, { categorySlug: 1, storeId: 1 }, { name: "categorySlug_store_lookup" }),

    ensureIndex(db.collection("categories"), { status: 1, _id: 1 }, { name: "status_id" }),
    ensureIndex(db.collection("categories"), { status: 1, id: 1 }, { name: "status_legacy_id" }),
    ensureIndex(db.collection("categories"), { status: 1, slug: 1 }, { name: "status_slug" }),
    ensureIndex(db.collection("categories"), { slug: 1 }, { name: "slug_lookup" }),
  ]);

  await printIndexes(categoryStoreConfigs, "After categorystoreconfigs indexes:");

  console.log("\n✅ MongoDB category multi-store indexes/data verified successfully.");
  await client.close();
}

main().catch((error) => {
  console.error("❌ Failed to create MongoDB indexes:", error);
  process.exit(1);
});
