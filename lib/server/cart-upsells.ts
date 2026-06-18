import connectMongoDB from "@/lib/mongodb";
import Category from "@/models/category";
import UpsellRule from "@/models/upsellrule";
import UpsellStoreConfig from "@/models/upsellstoreconfig";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type CartUpsellItem = {
  cartId: string;
  id: string;
  category: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  triggerCategoryId: string;
  triggerCategoryName: string;
};

export async function getCartUpsells(
  storeSlug: string,
  categoryKeys: string[]
): Promise<CartUpsellItem[]> {
  const keys = Array.from(
    new Set(categoryKeys.map((id) => String(id || "").trim()).filter(Boolean))
  );

  if (!storeSlug || keys.length === 0) {
    return [];
  }

  await connectMongoDB();

  const slugKeys = keys.map(slugify).filter(Boolean);
  const categories = await Category.find({
    $or: [{ slug: { $in: slugKeys } }, { _id: { $in: keys } }],
  }).lean();

  const resolvedIds = new Set<string>(keys);
  for (const category of categories) {
    resolvedIds.add(String(category._id));
    if (category.slug) resolvedIds.add(String(category.slug));
  }

  const configs = await UpsellStoreConfig.find({
    storeId: storeSlug,
    available: true,
    status: "Active",
    $or: [
      { categoryId: { $in: Array.from(resolvedIds) } },
      { categoryName: { $in: keys } },
    ],
  })
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();

  if (configs.length === 0) {
    return [];
  }

  const upsellIds = Array.from(
    new Set(configs.map((config) => String(config.upsellId || "").trim()).filter(Boolean))
  );

  const rules = await UpsellRule.find({
    $or: [{ _id: { $in: upsellIds } }, { slug: { $in: upsellIds } }],
    status: "Active",
  }).lean();

  const ruleByKey = new Map<string, (typeof rules)[number]>();
  for (const rule of rules) {
    ruleByKey.set(String(rule._id), rule);
    if (rule.slug) ruleByKey.set(String(rule.slug), rule);
  }

  const seen = new Set<string>();
  const items: CartUpsellItem[] = [];

  for (const config of configs) {
    const rule = ruleByKey.get(String(config.upsellId));
    if (!rule) continue;

    const ruleId = String(rule._id);
    if (seen.has(ruleId)) continue;
    seen.add(ruleId);

    items.push({
      cartId: `upsell-${ruleId}`,
      id: ruleId,
      category: "upsell",
      title: String(rule.name || "Add-on"),
      price: Number(rule.price || 0),
      quantity: 1,
      image:
        String(rule.image || "").trim() ||
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop",
      triggerCategoryId: String(config.categoryId),
      triggerCategoryName: String(config.categoryName || ""),
    });
  }

  return items;
}
