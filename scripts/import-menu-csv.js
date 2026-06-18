/*
  Bulk import menu products from CSV.

  Usage:
    node --env-file=.env.local scripts/import-menu-csv.js path/to/menu.csv

  CSV columns (header required):
    storeSlug,categoryName,productName,price,description,imageUrl,status

  Example row:
    towson,Pizzas,Margherita Pizza,12.99,Classic cheese pizza,,Active
*/

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }

  return rows;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: node --env-file=.env.local scripts/import-menu-csv.js <menu.csv>");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "stokos";
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(csvPath), "utf8");
  const rows = parseCsv(raw);

  if (rows.length === 0) {
    console.error("No data rows found in CSV");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName });

  const Category = mongoose.connection.collection("categories");
  const CategoryStoreConfig = mongoose.connection.collection("categorystoreconfigs");
  const Product = mongoose.connection.collection("products");
  const ProductStoreConfig = mongoose.connection.collection("productstoreconfigs");

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const storeSlug = slugify(row.storeSlug);
    const categoryName = String(row.categoryName || "").trim();
    const productName = String(row.productName || "").trim();
    const price = Number(row.price || 0);
    const description = String(row.description || "").trim();
    const imageUrl = String(row.imageUrl || "").trim();
    const status = ["Active", "Draft", "Hidden", "Inactive"].includes(row.status)
      ? row.status
      : "Active";

    if (!storeSlug || !categoryName || !productName) {
      console.warn("Skipping invalid row:", row);
      skipped++;
      continue;
    }

    const categorySlug = slugify(categoryName);
    let category = await Category.findOne({ slug: categorySlug });

    if (!category) {
      const categoryId = new mongoose.Types.ObjectId().toString();
      const insertResult = await Category.insertOne({
        name: categoryName,
        slug: categorySlug,
        status: "Active",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      category = await Category.findOne({ _id: insertResult.insertedId });
    }

    const categoryId = String(category._id);

    const existingConfig = await CategoryStoreConfig.findOne({
      categoryId,
      storeId: storeSlug,
    });

    if (!existingConfig) {
      await CategoryStoreConfig.insertOne({
        categoryId,
        storeId: storeSlug,
        categoryName,
        categorySlug,
        available: true,
        status: "Active",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const productSlug = slugify(productName);
    let product = await Product.findOne({ slug: productSlug });

    if (!product) {
      const insertResult = await Product.insertOne({
        name: productName,
        slug: productSlug,
        storeId: storeSlug,
        category: categoryName,
        categoryId,
        categoryName,
        price,
        image: imageUrl,
        description,
        status,
        modifierGroups: [],
        modifierGroupIds: [],
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      product = await Product.findOne({ _id: insertResult.insertedId });
      created++;
    }

    const productId = String(product._id);

    const existingProductConfig = await ProductStoreConfig.findOne({
      productId,
      storeId: storeSlug,
    });

    if (!existingProductConfig) {
      await ProductStoreConfig.insertOne({
        productId,
        storeId: storeSlug,
        categoryId,
        categoryName,
        categorySlug,
        category: categoryName,
        price,
        status,
        modifierGroups: [],
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      await ProductStoreConfig.updateOne(
        { _id: existingProductConfig._id },
        {
          $set: {
            price,
            status,
            categoryName,
            updatedAt: new Date(),
          },
        }
      );
    }
  }

  console.log(`Import complete. New products: ${created}, skipped rows: ${skipped}, total rows: ${rows.length}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
