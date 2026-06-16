import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

const IMMEDIATE_EXPIRY = { expire: 0 } as const;

function cleanSlug(value?: string) {
  return String(value || "").trim().toLowerCase();
}

export function invalidateMenuProducts() {
  revalidateTag("store-menu-products", IMMEDIATE_EXPIRY);
}

export function invalidateMenuCategories() {
  revalidateTag("store-menu-categories", IMMEDIATE_EXPIRY);
}

export function invalidateStoreMenu(storeSlug?: string) {
  invalidateMenuProducts();
  invalidateMenuCategories();

  const slug = cleanSlug(storeSlug);

  if (slug) {
    revalidatePath(`/store/${slug}`);
  }
}