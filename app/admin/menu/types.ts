export type TabType = "products" | "categories" | "modifiers" | "upsells";

export type ProductStatus = "Active" | "Draft" | "Hidden" | "Inactive";
export type CategoryStatus = "Active" | "Hidden" | "Inactive";
export type UpsellStatus = "Active" | "Paused" | "Inactive";
export type StoreStatus = "Active" | "Inactive";

export type OrderType = "pickup" | "delivery" | "both";

export type StoreAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type StoreHours = {
  day: string;
  open: string;
  close: string;
  closed: boolean;
};

export type Store = {
  _id?: string;
  id?: string;

  name: string;
  slug: string;

  phone?: string;
  email?: string;
  hngrUrl?: string;

  address?: StoreAddress;

  status: StoreStatus;

  orderType?: OrderType;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;

  deliveryFee?: number;
  minimumOrder?: number;
  taxRate?: number;

  hours?: StoreHours[];

  updatedAt?: string;
};

export type ModifierOption = {
  id?: string;
  name: string;
  status?: "Active" | "Inactive";
};

export type ModifierGroupAssignment = {
  _id?: string;
  id?: string;

  modifierGroupId?: string;

  storeId: string;

  categoryId: string;
  categoryName: string;

  sortOrder?: number;
  status?: "Active" | "Inactive";

  updatedAt?: string;
};

export type ProductSize = {
  id?: string;
  name: string;
  price: number;
  sortOrder?: number;
};

export type ProductModifierOption = {
  id?: string;
  optionId?: string;
  name: string;
  status?: "Active" | "Inactive";
  pricesBySize: Record<string, number>;
};

export type ProductModifierGroup = {
  modifierGroupId?: string;
  name: string;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  sortOrder?: number;
  status?: "Active" | "Inactive";
  options: ProductModifierOption[];
};

export type ProductRelatedUpsell = {
  upsellId: string;
  name: string;
  price: number;
};

export type ProductStoreConfig = {
  _id?: string;
  id?: string;
  productId?: string;

  storeId: string;

  category?: string;
  categoryId: string;
  categoryName: string;
  categorySlug?: string;

  price: number;
  sizes?: ProductSize[];

  modifierGroups: ProductModifierGroup[];
  modifierGroupIds?: string[];

  relatedUpsells?: ProductRelatedUpsell[];
  upsell?: string;

  // Store-wise popular flag. Product category same rahegi.
  isPopular?: boolean;

  status: ProductStatus;
  sortOrder?: number;

  isAvailable?: boolean;
  storeName?: string;
  updatedAt?: string;
};

export type Product = {
  _id?: string;
  id: string;

  storeId: string;

  name: string;

  category: string;
  categoryId?: string;
  categoryName?: string;

  price: number;
  sizes?: ProductSize[];

  image: string;

  status: ProductStatus;

  // Product-level modifier snapshot with per-size override prices.
  modifierGroups: ProductModifierGroup[];
  modifierGroupIds?: string[];

  upsell: string;
  relatedUpsells?: ProductRelatedUpsell[];

  storeConfigs?: ProductStoreConfig[];

  // Compatibility field from selected/primary store config.
  isPopular?: boolean;

  description?: string;
  sortOrder?: number;

  updatedAt: string;
};

export type Category = {
  _id?: string;
  id?: string;

  storeId: string;

  name: string;
  slug?: string;
  description?: string;
  image?: string;

  sortOrder: number;
  status: CategoryStatus;

  updatedAt?: string;
};

export type ModifierGroup = {
  _id?: string;
  id?: string;

  name: string;
  slug?: string;

  // Global options only. Prices stay on product/product-size level.
  options: ModifierOption[];

  required: boolean;
  minSelect?: number;
  maxSelect?: number;

  sortOrder?: number;
  status?: "Active" | "Inactive";

  // Link rows that control where this global group appears.
  assignments?: ModifierGroupAssignment[];

  // Legacy support only.
  // Do not use these for new modifier logic.
  storeId?: string;
  appliesTo?: string;
  appliesToCategories?: string[];
  category?: string;
  categoryId?: string;
  categoryName?: string;

  updatedAt?: string;
};

export type UpsellStoreConfig = {
  _id?: string;
  id?: string;

  upsellId?: string;

  storeId: string;

  categoryId: string;
  categoryName: string;

  available: boolean;
  status?: UpsellStatus;
  sortOrder?: number;

  updatedAt?: string;
};

export type UpsellRule = {
  _id?: string;
  id?: string;

  // Primary/fallback store for old table/filter compatibility.
  // Actual multi-store visibility and category selection is controlled by storeConfigs.
  storeId: string;
  storeIds?: string[];
  storeConfigs?: UpsellStoreConfig[];

  name: string;
  slug?: string;

  image?: string;
  description?: string;

  // Fallback category fields come from the first available store config.
  categoryId?: string;
  categoryName?: string;
  categoryType?: string;

  sortOrder?: number;
  status: UpsellStatus;

  // Legacy fields kept optional so old product-based upsell records do not break TypeScript.
  // New upsell form/API does not use these fields.
  triggerCategoryId?: string;
  triggerCategoryName?: string;
  offerProductIds?: string[];
  trigger?: string;
  offer?: string;
  appliesToCategories?: string[];
  appliesToProducts?: string[];

  updatedAt?: string;
};
