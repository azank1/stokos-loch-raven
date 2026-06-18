/*
  Seed sample promo codes for testing.

  Usage:
    node --env-file=.env.local scripts/seed-promo-codes.js
*/

const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "stokos";
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName });
  const PromoCode = mongoose.connection.collection("promocodes");

  const samples = [
    {
      code: "STOKOS10",
      description: "10% off your order",
      discountType: "percent",
      discountValue: 10,
      minimumSubtotal: 15,
      active: true,
      usedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      code: "WELCOME5",
      description: "$5 off orders over $25",
      discountType: "fixed",
      discountValue: 5,
      minimumSubtotal: 25,
      active: true,
      usedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const promo of samples) {
    await PromoCode.updateOne({ code: promo.code }, { $set: promo }, { upsert: true });
    console.log(`Upserted promo: ${promo.code}`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
