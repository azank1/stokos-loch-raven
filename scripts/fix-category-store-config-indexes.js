/* eslint-disable no-console */
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

const COLLECTION = "categorystoreconfigs";
const DESIRED_NAME = "unique_category_store_config";
const DESIRED_KEY = { categoryId: 1, storeId: 1 };

function sameKey(a, b) {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  return aKeys.length === bKeys.length && bKeys.every((key) => Number(a[key]) === Number(b[key]));
}

function touchesCategoryStoreConfig(index) {
  return Object.keys(index.key || {}).some((key) => ["categoryId", "storeId", "categorySlug"].includes(key));
}

async function main() {
  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection(COLLECTION);

  const indexes = await collection.indexes();

  for (const index of indexes) {
    if (index.name === "_id_") continue;
    if (!index.unique) continue;
    if (!touchesCategoryStoreConfig(index)) continue;
    if (sameKey(index.key, DESIRED_KEY)) continue;

    console.log(`Dropping stale unique index: ${index.name}`, index.key);
    await collection.dropIndex(index.name);
  }

  const duplicates = await collection
    .aggregate([
      {
        $group: {
          _id: { categoryId: "$categoryId", storeId: "$storeId" },
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  for (const duplicate of duplicates) {
    const [, ...deleteIds] = duplicate.ids;
    if (!deleteIds.length) continue;
    console.log("Deleting duplicate configs:", deleteIds.map(String));
    await collection.deleteMany({ _id: { $in: deleteIds } });
  }

  await collection.createIndex(DESIRED_KEY, {
    unique: true,
    name: DESIRED_NAME,
    background: true,
  });

  console.log("Category store config indexes fixed.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
