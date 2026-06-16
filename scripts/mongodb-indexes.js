/*
  Run once from project root:
  node --env-file=.env.local scripts/mongodb-indexes.js
*/

const { MongoClient } = require("mongodb");

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
  const db = client.db("stokos");

  await Promise.all([
    db.collection("stores").createIndex({ slug: 1, status: 1 }),

    db.collection("productstoreconfigs").createIndex({ storeId: 1, status: 1, isAvailable: 1, available: 1, sortOrder: 1, updatedAt: -1 }),
    db.collection("productstoreconfigs").createIndex({ storeId: 1, productId: 1, status: 1 }),
    db.collection("productstoreconfigs").createIndex({ productId: 1 }),

    db.collection("products").createIndex({ status: 1, _id: 1 }),
    db.collection("products").createIndex({ status: 1, id: 1 }),
    db.collection("products").createIndex({ status: 1, slug: 1 }),

    db.collection("categorystoreconfigs").createIndex({ storeId: 1, status: 1, isAvailable: 1, available: 1, sortOrder: 1, updatedAt: -1 }),
    db.collection("categories").createIndex({ status: 1, _id: 1 }),
    db.collection("categories").createIndex({ status: 1, id: 1 }),
    db.collection("categories").createIndex({ status: 1, slug: 1 }),
  ]);

  console.log("✅ MongoDB indexes created/verified successfully.");
  await client.close();
}

main().catch((error) => {
  console.error("❌ Failed to create MongoDB indexes:", error);
  process.exit(1);
});
