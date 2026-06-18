import mongoose, { Schema } from "mongoose";

const LoyaltyAccountSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    points: { type: Number, default: 0, min: 0 },
    lifetimePoints: { type: Number, default: 0, min: 0 },
    tier: { type: String, default: "Bronze", trim: true },
  },
  { timestamps: true, collection: "loyaltyaccounts" }
);

const LoyaltyAccount =
  mongoose.models.LoyaltyAccount ||
  mongoose.model("LoyaltyAccount", LoyaltyAccountSchema);

export default LoyaltyAccount;
