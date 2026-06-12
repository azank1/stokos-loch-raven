// Run once in MongoDB shell / Compass playground for fast admin product loading.
// Replace db name only if your database is not "stokos".
use("stokos");

db.products.createIndex({ name: 1 });
db.products.createIndex({ slug: 1 });
db.products.createIndex({ status: 1, name: 1 });
db.products.createIndex({ createdAt: -1 });

db.productstoreconfigs.createIndex(
  { productId: 1, storeId: 1 },
  { unique: true, name: "unique_product_store_config" }
);
db.productstoreconfigs.createIndex({ productId: 1, storeId: 1, sortOrder: 1, createdAt: -1 });
db.productstoreconfigs.createIndex({ productId: 1, status: 1 });
db.productstoreconfigs.createIndex({ storeId: 1, productId: 1, sortOrder: 1, createdAt: -1 });
db.productstoreconfigs.createIndex({ storeId: 1, categoryId: 1, productId: 1, sortOrder: 1 });
db.productstoreconfigs.createIndex({ storeId: 1, categoryName: 1, productId: 1, sortOrder: 1 });
db.productstoreconfigs.createIndex({ storeId: 1, isAvailable: 1, status: 1 });
db.productstoreconfigs.createIndex({ storeId: 1, isPopular: 1, status: 1 });
