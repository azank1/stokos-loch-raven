import connectMongoDB from "@/lib/mongodb";
import LoyaltyAccount from "@/models/loyaltyaccount";

const POINTS_PER_DOLLAR = 1;

export function calculatePointsEarned(amountTotal: number) {
  return Math.max(0, Math.floor(Number(amountTotal || 0) * POINTS_PER_DOLLAR));
}

function resolveTier(lifetimePoints: number) {
  if (lifetimePoints >= 500) return "Gold";
  if (lifetimePoints >= 200) return "Silver";
  return "Bronze";
}

export async function awardLoyaltyPoints(clerkUserId: string, amountTotal: number) {
  if (!clerkUserId) return null;

  const earned = calculatePointsEarned(amountTotal);
  if (earned <= 0) return null;

  await connectMongoDB();

  const account = await LoyaltyAccount.findOneAndUpdate(
    { clerkUserId },
    {
      $inc: { points: earned, lifetimePoints: earned },
      $setOnInsert: { tier: "Bronze" },
    },
    { upsert: true, new: true }
  ).lean();

  const tier = resolveTier(Number(account?.lifetimePoints || 0));
  if (account && account.tier !== tier) {
    await LoyaltyAccount.updateOne({ clerkUserId }, { $set: { tier } });
  }

  return { earned, tier };
}

export async function getLoyaltyAccount(clerkUserId: string) {
  if (!clerkUserId) return null;

  await connectMongoDB();

  const account = await LoyaltyAccount.findOne({ clerkUserId }).lean();
  if (!account) {
    return { points: 0, lifetimePoints: 0, tier: "Bronze" };
  }

  return {
    points: Number(account.points || 0),
    lifetimePoints: Number(account.lifetimePoints || 0),
    tier: String(account.tier || "Bronze"),
  };
}
