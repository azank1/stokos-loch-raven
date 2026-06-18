import connectMongoDB from "@/lib/mongodb";
import PromoCode from "@/models/promocode";

export type PromoValidationResult = {
  valid: boolean;
  discountAmount: number;
  code?: string;
  message: string;
};

export async function validatePromoCode(
  code: string,
  subtotal: number
): Promise<PromoValidationResult> {
  const normalized = String(code || "").trim().toUpperCase();

  if (!normalized) {
    return { valid: false, discountAmount: 0, message: "Enter a promo code" };
  }

  await connectMongoDB();

  const promo = await PromoCode.findOne({ code: normalized, active: true }).lean();

  if (!promo) {
    return { valid: false, discountAmount: 0, message: "Invalid promo code" };
  }

  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return { valid: false, discountAmount: 0, message: "Promo code expired" };
  }

  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    return { valid: false, discountAmount: 0, message: "Promo code usage limit reached" };
  }

  if (subtotal < Number(promo.minimumSubtotal || 0)) {
    return {
      valid: false,
      discountAmount: 0,
      message: `Minimum subtotal $${Number(promo.minimumSubtotal).toFixed(2)} required`,
    };
  }

  let discountAmount = 0;

  if (promo.discountType === "fixed") {
    discountAmount = Math.min(subtotal, Number(promo.discountValue || 0));
  } else {
    discountAmount = Math.round(subtotal * (Number(promo.discountValue || 0) / 100) * 100) / 100;
  }

  return {
    valid: true,
    discountAmount,
    code: normalized,
    message: promo.description || "Promo applied",
  };
}

export async function incrementPromoUsage(code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return;

  await connectMongoDB();
  await PromoCode.updateOne({ code: normalized }, { $inc: { usedCount: 1 } });
}
