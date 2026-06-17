/*
  Run once from project root after replacing the files:

  node --env-file=.env.local scripts/mongodb-indexes.js

  This script does 3 things:
  1) drops old/wrong UNIQUE indexes from categorystoreconfigs
  2) dedupes exact duplicate categoryId + storeId rows
  3) creates the correct indexes
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

function sameKey(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

function latestTime(doc) {
  const value = new Date(doc.updatedAt || doc.createdAt || doc._id?.getTimestamp?.() || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

async function dropWrongUniqueIndexes(collection) {
  const indexes = await collection.indexes();
  const expectedUniqueKey = { categoryId: 1, storeId: 1 };

  console.log("\nExisting categorystoreconfigs indexes:");
  indexes.forEach((index) => {
    console.log(`- ${index.name}`, JSON.stringify(index.key), index.unique ? "UNIQUE" : "");
  });

  for (const index of indexes) {
    if (index.name === "_id_") continue;
    if (!index.unique) continue;

    const isExpected = sameKey(index.key, expectedUniqueKey);

    if (!isExpected || index.name !== "unique_category_store_config") {
      console.log(`Dropping wrong unique index: ${index.name}`);
      await collection.dropIndex(index.name).catch((error) => {
        console.warn(`Could not drop ${index.name}:`, error.message);
      });
    }
  }
}

async function normalizeAndDedupeCategoryStoreConfigs(collection) {
  const docs = await collection.find({}).toArray();
  const groups = new Map();

  for (const doc of docs) {
    const categoryId = cleanString(doc.categoryId);
    const storeId = slugify(doc.storeId || doc.storeSlug || doc.store);
    const categoryName = cleanString(doc.categoryName || doc.name || doc.title);
    const categorySlug = slugify(doc.categorySlug || doc.slug || categoryName);
    const available = doc.available !== false && doc.isAvailable !== false;

    if (!categoryId || !storeId) {
      console.log("Deleting broken config with missing categoryId/storeId:", doc._id.toString());
      await collection.deleteOne({ _id: doc._id });
      continue;
    }

    const normalized = {
      categoryId,
      storeId,
      categoryName,
      categorySlug,
      available,
      isAvailable: available,
      status: ["Active", "Hidden", "Inactive"].includes(cleanString(doc.status))
        ? cleanString(doc.status)
        : "Active",
      sortOrder: Number.isFinite(Number(doc.sortOrder)) ? Number(doc.sortOrder) : 0,
    };

    await collection.updateOne({ _id: doc._id }, { $set: normalized });

    const key = `${categoryId}__${storeId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...doc, ...normalized });
  }

  let deleted = 0;

  for (const [, items] of groups.entries()) {
    if (items.length <= 1) continue;

    items.sort((a, b) => latestTime(b) - latestTime(a));
    const keep = items[0];
    const remove = items.slice(1).map((item) => item._id);

    if (remove.length) {
      await collection.deleteMany({ _id: { $in: remove } });
      deleted += remove.length;
      console.log(
        `Deduped categoryId=${keep.categoryId}, storeId=${keep.storeId}; deleted ${remove.length}`
      );
    }
  }

  console.log(`Normalized categorystoreconfigs. Deleted duplicate rows: ${deleted}`);
}

async function createIndexes(db) {
  await db.collection("stores").createIndex({ slug: 1, status: 1 });

  await db.collection("productstoreconfigs").createIndex({
    storeId: 1,
    status: 1,
    isAvailable: 1,
    available: 1,
    sortOrder: 1,
    updatedAt: -1,
  });
  await db.collection("productstoreconfigs").createIndex({ storeId: 1, productId: 1, status: 1 });
  await db.collection("productstoreconfigs").createIndex({ productId: 1 });

  await db.collection("products").createIndex({ status: 1, _id: 1 });
  await db.collection("products").createIndex({ status: 1, id: 1 });
  await db.collection("products").createIndex({ status: 1, slug: 1 });

  await db.collection("categorystoreconfigs").createIndex(
    { categoryId: 1, storeId: 1 },
    { unique: true, name: "unique_category_store_config" }
  );
  await db.collection("categorystoreconfigs").createIndex({
    storeId: 1,
    status: 1,
    isAvailable: 1,
    available: 1,
    sortOrder: 1,
    updatedAt: -1,
  });
  await db.collection("categorystoreconfigs").createIndex({
    storeId: 1,
    status: 1,
    categorySlug: 1,
    sortOrder: 1,
  });
  await db.collection("categorystoreconfigs").createIndex({ categoryId: 1 });
  await db.collection("categorystoreconfigs").createIndex({ categorySlug: 1, storeId: 1 });

  await db.collection("categories").createIndex({ slug: 1 });
  await db.collection("categories").createIndex({ name: 1 });
  await db.collection("categories").createIndex({ status: 1, _id: 1 });
  await db.collection("categories").createIndex({ status: 1, id: 1 });
  await db.collection("categories").createIndex({ status: 1, slug: 1 });
}

async function printPopularMenuItemsCheck(db) {
  const rows = await db
    .collection("categorystoreconfigs")
    .find({ categorySlug: "popular-menu-items" })
    .project({ categoryId: 1, storeId: 1, categoryName: 1, categorySlug: 1, updatedAt: 1 })
    .sort({ storeId: 1 })
    .toArray();

  console.log("\nCurrent popular-menu-items configs:");
  if (!rows.length) {
    console.log("- No rows found yet. Save the category again from admin.");
    return;
  }

  rows.forEach((row) => {
    console.log(`- ${row.storeId} => categoryId=${row.categoryId}`);
  });
}

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Run with: node --env-file=.env.local scripts/mongodb-indexes.js"
    );
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  });

  await client.connect();
  const db = client.db("stokos");
  const categoryStoreConfigs = db.collection("categorystoreconfigs");

  await dropWrongUniqueIndexes(categoryStoreConfigs);
  await normalizeAndDedupeCategoryStoreConfigs(categoryStoreConfigs);
  await createIndexes(db);
  await printPopularMenuItemsCheck(db);

  console.log("\n✅ MongoDB indexes fixed/verified successfully.");
  await client.close();
}

main().catch((error) => {
  console.error("❌ Failed to fix MongoDB indexes:", error);
  process.exit(1);
});
