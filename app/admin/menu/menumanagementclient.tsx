"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Tags,
} from "lucide-react";

import { useMenuCrud } from "./usemenucrud";
import type {
  Category,
  ModifierGroup,
  Product,
  TabType,
  UpsellRule,
} from "./types";

import ProductTable from "./components/producttable";
import CategoryTable from "./components/categorytable";
import ModifierGrid from "./components/modifiergrid";
import UpsellTable from "./components/upselltable";
import MenuModal from "./components/menumodel";

const tabs = [
  { id: "products", label: "Products", icon: ShoppingBag },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "modifiers", label: "Modifier Groups", icon: Settings2 },
  { id: "upsells", label: "Upsells", icon: Sparkles },
] as const;

export type StoreItem = {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  location?: string;
  phone?: string;
  openingHours?: string;
  status?: string;
};

type ModalState =
  | { type: "products"; item: Product | null }
  | { type: "categories"; item: Category | null }
  | { type: "modifiers"; item: ModifierGroup | null }
  | { type: "upsells"; item: UpsellRule | null }
  | null;

type LocalSnapshot = {
  products: Product[];
  categories: Category[];
  modifierGroups: ModifierGroup[];
  upsellRules: UpsellRule[];
};

export default function MenuManagementClient() {
  const crud = useMenuCrud();

  const [stores, setStores] = useState<StoreItem[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState("all");

  const firstStoreId = useMemo(() => {
    return stores[0] ? getStoreValue(stores[0]) : "";
  }, [stores]);

  const {
    isLoaded = true,

    products: crudProductsRaw,
    categories: crudCategoriesRaw,
    modifierGroups: crudModifierGroupsRaw,
    upsellRules: crudUpsellRulesRaw,

    addProduct,
    updateProduct,
    deleteProduct,

    addCategory,
    updateCategory,
    deleteCategory,

    addModifier,
    updateModifier,
    deleteModifier,

    addUpsell,
    updateUpsell,
    deleteUpsell,
  } = crud;

  const crudProducts = useMemo(
    () => (Array.isArray(crudProductsRaw) ? crudProductsRaw : []),
    [crudProductsRaw]
  );

  const crudCategories = useMemo(
    () => (Array.isArray(crudCategoriesRaw) ? crudCategoriesRaw : []),
    [crudCategoriesRaw]
  );

  const crudModifierGroups = useMemo(
    () => (Array.isArray(crudModifierGroupsRaw) ? crudModifierGroupsRaw : []),
    [crudModifierGroupsRaw]
  );

  const crudUpsellRules = useMemo(
    () => (Array.isArray(crudUpsellRulesRaw) ? crudUpsellRulesRaw : []),
    [crudUpsellRulesRaw]
  );

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [modal, setModal] = useState<ModalState>(null);

  const [pendingActions, setPendingActions] = useState(0);
  const pendingActionsRef = useRef(0);

  const [hasSynced, setHasSynced] = useState(false);

  const [uiProducts, setUiProducts] = useState<Product[]>([]);
  const [uiCategories, setUiCategories] = useState<Category[]>([]);
  const [uiModifierGroups, setUiModifierGroups] = useState<ModifierGroup[]>([]);
  const [uiUpsellRules, setUiUpsellRules] = useState<UpsellRule[]>([]);

  useEffect(() => {
    pendingActionsRef.current = pendingActions;
  }, [pendingActions]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        setStoresLoading(true);

        const res = await fetch("/api/admin/stores", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch stores");
        }

        const data = await res.json();

        const safeStores: StoreItem[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.stores)
          ? data.stores
          : [];

        setStores(safeStores);
      } catch (error) {
        console.error("Stores fetch failed:", error);
        setStores([]);
      } finally {
        setStoresLoading(false);
      }
    };

    fetchStores();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (pendingActionsRef.current > 0) {
      return;
    }

    setUiProducts(crudProducts);
    setUiCategories(crudCategories);
    setUiModifierGroups(crudModifierGroups);
    setUiUpsellRules(crudUpsellRules);
    setHasSynced(true);
  }, [
    isLoaded,
    crudProducts,
    crudCategories,
    crudModifierGroups,
    crudUpsellRules,
  ]);

  useEffect(() => {
    setSelectedCategory("All Categories");
  }, [selectedStoreFilter]);

  const products = hasSynced ? uiProducts : crudProducts;
  const categories = hasSynced ? uiCategories : crudCategories;
  const modifierGroups = hasSynced ? uiModifierGroups : crudModifierGroups;
  const upsellRules = hasSynced ? uiUpsellRules : crudUpsellRules;

  const visibleProducts = useMemo(
    () => filterItemsByStore(products, selectedStoreFilter),
    [products, selectedStoreFilter]
  );

  const visibleCategories = useMemo(
    () => filterItemsByStore(categories, selectedStoreFilter),
    [categories, selectedStoreFilter]
  );

  const visibleModifierGroups = useMemo(
    () => filterItemsByStore(modifierGroups, selectedStoreFilter),
    [modifierGroups, selectedStoreFilter]
  );

  const visibleUpsellRules = useMemo(
    () => filterItemsByStore(upsellRules, selectedStoreFilter),
    [upsellRules, selectedStoreFilter]
  );

  const filteredProducts = useMemo(() => {
    return visibleProducts.filter((product) => {
      const name = product.name || "";
      const searchValue = search.toLowerCase();
      const categoryLabels = getProductCategoryLabels(product, selectedStoreFilter, categories);
      const categorySearchValue = categoryLabels.join(" ").toLowerCase();

      const matchesSearch =
        name.toLowerCase().includes(searchValue) ||
        categorySearchValue.includes(searchValue);

      const matchesCategory =
        selectedCategory === "All Categories" ||
        categoryLabels.includes(selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [visibleProducts, categories, search, selectedCategory, selectedStoreFilter]);


  const categoryFilterOptions = useMemo(() => {
    return dedupeCategoriesForFilter(visibleCategories);
  }, [visibleCategories]);

  const openAdd = (type: TabType) => {
    setActiveTab(type);

    if (type === "products") {
      setModal({ type: "products", item: null });
    }

    if (type === "categories") {
      setModal({ type: "categories", item: null });
    }

    if (type === "modifiers") {
      setModal({ type: "modifiers", item: null });
    }

    if (type === "upsells") {
      setModal({ type: "upsells", item: null });
    }
  };

  const getSnapshot = (): LocalSnapshot => ({
    products,
    categories,
    modifierGroups,
    upsellRules,
  });

  const restoreSnapshot = (snapshot: LocalSnapshot) => {
    setUiProducts(snapshot.products);
    setUiCategories(snapshot.categories);
    setUiModifierGroups(snapshot.modifierGroups);
    setUiUpsellRules(snapshot.upsellRules);
  };

  const handleDelete = async (type: TabType, id: string) => {
    const ok = window.confirm("Are you sure you want to delete this?");
    if (!ok) return;

    const cleanId = String(id || "").trim();
    if (!cleanId) return;

    const snapshot = getSnapshot();

    setPendingActions((count) => count + 1);

    if (type === "products") {
      setUiProducts((prev) =>
        prev.filter((item) => !itemHasAnyId(item, cleanId))
      );
    }

    if (type === "categories") {
      setUiCategories((prev) =>
        prev.filter((item) => !itemHasAnyId(item, cleanId))
      );
    }

    if (type === "modifiers") {
      setUiModifierGroups((prev) =>
        prev.filter((item) => !itemHasAnyId(item, cleanId))
      );
    }

    if (type === "upsells") {
      setUiUpsellRules((prev) =>
        prev.filter((item) => !itemHasAnyId(item, cleanId))
      );
    }

    try {
      if (type === "products") await deleteProduct(cleanId);
      if (type === "categories") await deleteCategory(cleanId);
      if (type === "modifiers") await deleteModifier(cleanId);
      if (type === "upsells") await deleteUpsell(cleanId);
    } catch (error) {
      console.error("Delete failed:", error);
      restoreSnapshot(snapshot);
      alert("Failed to delete item from database.");
    } finally {
      setPendingActions((count) => Math.max(0, count - 1));
    }
  };

  const handleSave = async (
    value: Product | Category | ModifierGroup | UpsellRule
  ) => {
    if (!modal) return;

    const isCategorySave = modal.type === "categories";

    const saveValue = isCategorySave
      ? buildCategorySavePayload(
          value as Category,
          selectedStoreFilter,
          stores
        )
      : value;

    const categoryTargetStoreIds = isCategorySave
      ? getCategoryTargetStoreIds(saveValue as Category, "", stores)
      : [];

    const finalStoreId = isCategorySave
      ? categoryTargetStoreIds[0] || ""
      : getItemStoreId(saveValue) ||
        getSelectedStoreFallback(selectedStoreFilter, firstStoreId);

    if (isCategorySave && categoryTargetStoreIds.length === 0) {
      alert("Please select at least one store for category.");
      return;
    }

    if (!isCategorySave && !finalStoreId) {
      alert("Please add a store first.");
      return;
    }

    const snapshot = getSnapshot();
    const isEdit = Boolean(modal.item);
    const tempId = `temp-${modal.type}-${Date.now()}`;

    const valueWithStore = isCategorySave
      ? (saveValue as Category)
      : attachStoreId(saveValue, finalStoreId);

    const mergedValue = isEdit
      ? isCategorySave
        ? ({
            ...(modal.item as object),
            ...(saveValue as object),
          } as Product | Category | ModifierGroup | UpsellRule)
        : attachStoreId(
            {
              ...(modal.item as object),
              ...(saveValue as object),
            } as Product | Category | ModifierGroup | UpsellRule,
            finalStoreId
          )
      : valueWithStore;

    setModal(null);
    setPendingActions((count) => count + 1);

    if (modal.type === "products") {
      setUiProducts((prev) =>
        optimisticUpsert(prev, mergedValue as Product, isEdit, tempId)
      );
    }

    if (modal.type === "categories") {
      setUiCategories((prev) => {
        const optimisticRows = isEdit
          ? [mergedValue as Category]
          : buildOptimisticCategoryRows(
              valueWithStore as Category,
              finalStoreId,
              tempId,
              stores
            );

        return upsertUiCategoryRows(prev, optimisticRows);
      });
    }

    if (modal.type === "modifiers") {
      setUiModifierGroups((prev) =>
        optimisticUpsert(prev, mergedValue as ModifierGroup, isEdit, tempId)
      );
    }

    if (modal.type === "upsells") {
      setUiUpsellRules((prev) =>
        optimisticUpsert(prev, mergedValue as UpsellRule, isEdit, tempId)
      );
    }

    try {
      if (modal.type === "products") {
        const productPayload = isEdit
          ? ({ ...(modal.item as object), ...(saveValue as object) } as Product)
          : (saveValue as Product);

        isEdit
          ? await updateProduct(productPayload)
          : await addProduct(productPayload);
      }

      if (modal.type === "categories") {
        const savedCategoryResult = isEdit
          ? await updateCategory(mergedValue as Category)
          : await addCategory(valueWithStore as Category);

        const savedRows = Array.isArray(savedCategoryResult)
          ? savedCategoryResult
          : savedCategoryResult
          ? [savedCategoryResult]
          : [];

        setUiCategories((prev) =>
          upsertUiCategoryRows(
            removeTempCategoryRows(prev, tempId),
            savedRows as Category[]
          )
        );
      }

      if (modal.type === "modifiers") {
        isEdit
          ? await updateModifier(mergedValue as ModifierGroup)
          : await addModifier(valueWithStore as ModifierGroup);
      }

      if (modal.type === "upsells") {
        isEdit
          ? await updateUpsell(mergedValue as UpsellRule)
          : await addUpsell(valueWithStore as UpsellRule);
      }
    } catch (error) {
      console.error("Save failed:", error);
      restoreSnapshot(snapshot);
      alert("Failed to save item in database.");
    } finally {
      setPendingActions((count) => Math.max(0, count - 1));
    }
  };

  if (!mounted || !isLoaded) {
    return (
      <div className="w-full space-y-5">
        <section className="rounded-[30px] bg-green-700 p-6 text-white md:p-8">
          <p className="mb-4 w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/75">
            Menu Control
          </p>

          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Menu Management
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
            Loading menu data...
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <section className="overflow-hidden rounded-[30px] bg-green-800 text-white">
        <div className="relative p-6 md:p-8">
          <p className="mb-4 w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/75">
            Menu Control
          </p>

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight md:text-5xl">
                Menu Management
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
                Manage store products, categories, modifier groups, toppings,
                sauces, pricing, and independent upsell items from one dashboard.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openAdd("products")}
              className="flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-green-800 transition hover:bg-green-50"
            >
              <Plus size={18} />
              Add Product
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedStoreFilter("all")}
            className={`rounded-full px-4 py-2 text-xs font-black transition ${
              selectedStoreFilter === "all"
                ? "bg-green-800 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-green-50 hover:text-green-800"
            }`}
          >
            All Stores
          </button>

          {stores.map((store) => {
            const storeValue = getStoreValue(store);
            const isActive = selectedStoreFilter === storeValue;

            return (
              <button
                key={storeValue}
                type="button"
                onClick={() => setSelectedStoreFilter(storeValue)}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${
                  isActive
                    ? "bg-green-800 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-green-50 hover:text-green-800"
                }`}
              >
                {store.name}
              </button>
            );
          })}
        </div>

        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black transition ${
                    isActive
                      ? "bg-green-800 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-600 hover:bg-green-50 hover:text-green-800"
                  }`}
                >
                  <Icon size={17} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {activeTab === "products" && (
              <>
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search products..."
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition placeholder:text-zinc-400 focus:border-green-700 sm:w-[260px]"
                  />
                </div>

                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(event) =>
                      setSelectedCategory(event.target.value)
                    }
                    className="h-12 w-full appearance-none rounded-2xl border border-zinc-200 bg-white px-4 pr-10 text-sm font-black text-zinc-700 outline-none transition focus:border-green-700 sm:w-[220px]"
                  >
                    <option value="All Categories">All Categories</option>

                    {categoryFilterOptions.map((category, index) => (
                      <option
                        key={`${getItemStoreId(category)}-${getSafeId(
                          category
                        )}-${index}`}
                        value={category.name}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400"
                  />
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => openAdd(activeTab)}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-green-800 px-5 text-sm font-black text-white transition hover:bg-green-900"
            >
              <Plus size={17} />
              Add {getLabel(activeTab)}
            </button>
          </div>
        </div>

        {storesLoading && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            Loading stores...
          </div>
        )}

        {!storesLoading && stores.length === 0 && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            No stores found. Please add store first from Store Management.
          </div>
        )}

        {activeTab === "products" && (
    <ProductTable
  products={filteredProducts}
  categories={categories}
  stores={stores}
  upsellRules={upsellRules}
  selectedStoreId={selectedStoreFilter}
  onEdit={(product) => setModal({ type: "products", item: product })}
  onDelete={(id) => handleDelete("products", id)} 
  />
        )}

        {activeTab === "categories" && (
          <CategoryTable
            categories={visibleCategories}
            products={visibleProducts}
            stores={stores}
            hideEdit={selectedStoreFilter === "all"}
            onEdit={(category) =>
              setModal({ type: "categories", item: category })
            }
            onDelete={(id) => handleDelete("categories", id)}
          />
        )}

        {activeTab === "modifiers" && (
          <ModifierGrid
            modifierGroups={visibleModifierGroups}
            stores={stores}
            onEdit={(modifier) =>
              setModal({ type: "modifiers", item: modifier })
            }
            onDelete={(id) => handleDelete("modifiers", id)}
          />
        )}

        {activeTab === "upsells" && (
    <UpsellTable
  upsellRules={visibleUpsellRules}
  stores={stores}
  onEdit={(upsell) => setModal({ type: "upsells", item: upsell })}
  onDelete={(id) => handleDelete("upsells", id)}
/>
        )}
      </section>

      {modal && (
<MenuModal
  key={`${modal.type}-${getSafeId(modal.item) || "new"}`}
  stores={stores}
  type={modal.type}
  item={modal.item}
  products={products}
  categories={categories}
  modifierGroups={modifierGroups}
  upsellRules={upsellRules}
  selectedStoreId={selectedStoreFilter}
  onClose={() => setModal(null)}
  onSave={handleSave}
/>
      )}
    </div>
  );
}

function getLabel(tab: TabType) {
  if (tab === "products") return "Product";
  if (tab === "categories") return "Category";
  if (tab === "modifiers") return "Modifier Group";
  return "Upsell";
}

function slugifyStoreName(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getStoreValue(store: StoreItem) {
  return (
    normalizeStoreValue(store.slug) ||
    normalizeStoreValue(store._id) ||
    normalizeStoreValue(store.id) ||
    slugifyStoreName(store.name)
  );
}

function getSafeId(item: unknown) {
  return getAllItemIds(item)[0] || "";
}

function getAllItemIds(item: unknown) {
  if (!item || typeof item !== "object") return [];

  const obj = item as {
    storeConfigId?: unknown;
    configId?: unknown;
    _id?: unknown;
    id?: unknown;
    categoryId?: unknown;
    slug?: unknown;
    name?: unknown;
    offer?: unknown;
  };

  return [
    obj.storeConfigId,
    obj.configId,
    obj._id,
    obj.id,
    obj.categoryId,
    obj.slug,
    obj.name,
    obj.offer,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function itemHasAnyId(item: unknown, id: string) {
  const cleanId = String(id || "").trim();
  if (!cleanId) return false;

  return getAllItemIds(item).includes(cleanId);
}

function getItemStoreId(item: unknown) {
  if (!item || typeof item !== "object") return "";

  const obj = item as {
    storeId?: unknown;
    storeSlug?: unknown;
    store?: unknown;
    storeConfigs?: unknown;
  };

  const storeConfigs = Array.isArray(obj.storeConfigs)
    ? (obj.storeConfigs as Array<{ storeId?: unknown }>)
    : [];

  const activeConfigStoreId = storeConfigs
    .filter((config: any) => {
      const available = config.available !== false;
      const active = config.status !== "Inactive";
      return available && active;
    })
    .map((config) => normalizeStoreValue(config.storeId))
    .find(Boolean);

  const firstConfigStoreId =
    activeConfigStoreId ||
    storeConfigs
      .map((config) => normalizeStoreValue(config.storeId))
      .find(Boolean);

  return (
    firstConfigStoreId ||
    normalizeStoreValue(obj.storeId) ||
    normalizeStoreValue(obj.storeSlug) ||
    normalizeStoreValue(obj.store)
  );
}

function normalizeStoreValue(value: unknown) {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const obj = value as {
      _id?: string;
      id?: string;
      slug?: string;
      name?: string;
    };

    return String(obj.slug || obj._id || obj.id || obj.name || "").trim();
  }

  return "";
}

function getAllStoreIds(stores: StoreItem[]) {
  return stores
    .map((store) => normalizeStoreValue(getStoreValue(store)))
    .filter(Boolean);
}

function getSelectedStoreFallback(
  selectedStoreFilter: string,
  firstStoreId: string
) {
  const selectedStoreId = normalizeStoreValue(selectedStoreFilter);

  if (selectedStoreId && selectedStoreId !== "all") {
    return selectedStoreId;
  }

  return normalizeStoreValue(firstStoreId);
}

function getUniqueStoreIds(storeIds: string[]) {
  return Array.from(
    new Set(
      storeIds
        .map((storeId) => normalizeStoreValue(storeId))
        .filter((storeId) => storeId && storeId !== "all")
    )
  );
}

function getCategorySavePrimaryStoreId(category: Category) {
  const categoryObj = category as CategoryWithStoreMeta;

  const storeIds = Array.isArray(categoryObj.storeIds)
    ? getUniqueStoreIds(categoryObj.storeIds.map((storeId) => String(storeId)))
    : [];

  return storeIds[0] || normalizeStoreValue(categoryObj.storeId);
}

function buildCategorySavePayload(
  category: Category,
  selectedStoreFilter: string,
  stores: StoreItem[]
) {
  const categoryObj = category as CategoryWithStoreMeta;

  const selectedStoreId = normalizeStoreValue(selectedStoreFilter);

  const currentStoreIds = Array.isArray(categoryObj.storeIds)
    ? getUniqueStoreIds(categoryObj.storeIds.map((storeId) => String(storeId)))
    : [];

  const directStoreId = normalizeStoreValue(categoryObj.storeId);

  const allStoreIds = getUniqueStoreIds(getAllStoreIds(stores));

  let targetStoreIds: string[] = [];

  if (selectedStoreId && selectedStoreId !== "all") {
    targetStoreIds = [selectedStoreId];
  } else if (currentStoreIds.length) {
    targetStoreIds = currentStoreIds;
  } else if (allStoreIds.length) {
    targetStoreIds = allStoreIds;
  } else if (directStoreId && directStoreId !== "all") {
    targetStoreIds = [directStoreId];
  }

  targetStoreIds = getUniqueStoreIds(targetStoreIds);

  const payload = {
    ...(category as object),
    storeId: targetStoreIds[0] || "",
  } as CategoryWithStoreMeta;

  if (targetStoreIds.length > 0) {
    payload.storeIds = targetStoreIds;
  } else {
    delete payload.storeIds;
  }

  return payload as Category;
}

function getStoreConfigs(item: unknown) {
  if (!item || typeof item !== "object") return [];

  const obj = item as { storeConfigs?: unknown };

  return Array.isArray(obj.storeConfigs)
    ? (obj.storeConfigs as Array<{ storeId?: unknown; status?: string; available?: boolean }>)
    : [];
}

function filterItemsByStore<T>(items: T[], selectedStoreFilter: string) {
  if (selectedStoreFilter === "all") return items;

  return items.filter((item) => {
    const storeConfigs = getStoreConfigs(item);

    if (storeConfigs.length > 0) {
      return storeConfigs.some((config) => {
        const storeId = normalizeStoreValue(config.storeId);
        const available = config.available !== false;
        const active = config.status !== "Inactive";
        return storeId === selectedStoreFilter && available && active;
      });
    }

    const itemStoreId = getItemStoreId(item);
    return itemStoreId === selectedStoreFilter || !itemStoreId;
  });
}

function getTextValue(value: unknown, fallback = "Not selected") {
  if (!value) return fallback;

  if (typeof value === "string") return value;

  if (typeof value === "number") return String(value);

  if (typeof value === "object") {
    const obj = value as {
      _id?: string;
      id?: string;
      name?: string;
      title?: string;
      offer?: string;
      slug?: string;
    };

    return (
      obj.name || obj.title || obj.offer || obj.slug || obj._id || obj.id || fallback
    );
  }

  return fallback;
}

function getProductConfigForStore(product: Product, selectedStoreId: string) {
  const configs = getStoreConfigs(product) as Array<{
    storeId?: unknown;
    categoryName?: unknown;
    categoryId?: unknown;
    category?: unknown;
  }>;

  if (!configs.length) return null;

  if (selectedStoreId && selectedStoreId !== "all") {
    const found = configs.find(
      (config) => normalizeStoreValue(config.storeId) === selectedStoreId
    );

    if (found) return found;
  }

  return configs[0];
}

function getProductCategoryLabels(
  product: Product,
  selectedStoreId: string,
  categories: Category[]
) {
  const configs = getStoreConfigs(product) as Array<{
    storeId?: unknown;
    categoryName?: unknown;
    categoryId?: unknown;
    category?: unknown;
  }>;

  if (configs.length) {
    const relevantConfigs =
      selectedStoreId && selectedStoreId !== "all"
        ? configs.filter(
            (config) => normalizeStoreValue(config.storeId) === selectedStoreId
          )
        : configs;

    const labels = relevantConfigs
      .map((config) => {
        const directName = String(config.categoryName || "").trim();
        if (directName) return directName;

        const categoryValue = String(config.categoryId || config.category || "").trim();
        const foundCategory = categories.find((category) => {
          const categoryValues = [
            (category as any)._id,
            (category as any).id,
            (category as any).slug,
            category.name,
          ]
            .map((value) => getTextValue(value, "").trim().toLowerCase())
            .filter(Boolean);

          return categoryValues.includes(categoryValue.toLowerCase());
        });

        return foundCategory?.name || categoryValue;
      })
      .filter(Boolean);

    return Array.from(new Set(labels));
  }

  return [getProductCategoryLabel(categories, product)].filter(Boolean);
}

function getProductCategoryLabel(categories: Category[], product: Product) {
  const config = getProductConfigForStore(product, "all");
  const source = (config || product) as Product;

  const productObj = source as Product & {
    category?: unknown;
    categoryId?: unknown;
    categoryName?: unknown;
    categorySlug?: unknown;
  };

  const directCategoryName = String(productObj.categoryName || "").trim();

  if (directCategoryName) {
    return directCategoryName;
  }

  const productStoreId = normalizeStoreValue((config as any)?.storeId) || getItemStoreId(product);

  const productCategoryValues = [
    productObj.categoryId,
    productObj.category,
    productObj.categorySlug,
  ]
    .map((value) => getTextValue(value, "").trim().toLowerCase())
    .filter(Boolean);

  const foundCategory = categories.find((category) => {
    const categoryStoreId = getItemStoreId(category);

    if (
      productStoreId &&
      categoryStoreId &&
      String(productStoreId) !== String(categoryStoreId)
    ) {
      return false;
    }

    const categoryId = getSafeId(category);
    const categorySlug = String(
      (category as Category & { slug?: string }).slug || ""
    );

    const categoryValues = [category._id, categoryId, category.name, categorySlug]
      .map((value) => getTextValue(value, "").trim().toLowerCase())
      .filter(Boolean);

    return productCategoryValues.some((value) =>
      categoryValues.includes(value)
    );
  });

  return (
    foundCategory?.name ||
    getTextValue(productObj.categoryName, "") ||
    getTextValue(productObj.category, "") ||
    getTextValue(productObj.categoryId, "No Category")
  );
}
function dedupeCategoriesForFilter(categories: Category[]) {
  const seen = new Set<string>();

  return categories.filter((category) => {
    const name = String(category.name || "").trim();
    const key = name.toLowerCase();

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function attachStoreId<T>(item: T, storeId: string): T {
  if (!item || typeof item !== "object") return item;

  return {
    ...(item as object),
    storeId,
  } as T;
}

function addTempId<T>(item: T, tempId: string): T {
  if (!item || typeof item !== "object") return item;

  const obj = item as Record<string, unknown>;

  if (obj._id || obj.id) return item;

  return {
    ...obj,
    id: tempId,
  } as T;
}

type CategoryWithStoreMeta = Category & {
  storeIds?: unknown[];
  storeConfigId?: unknown;
  configId?: unknown;
  categoryId?: unknown;
  storeId?: unknown;
  categoryName?: unknown;
  slug?: unknown;
};

function getCategoryUiRowKeys(category: unknown) {
  if (!category || typeof category !== "object") return [];

  const obj = category as CategoryWithStoreMeta;

  const storeConfigId = String(obj.storeConfigId || obj.configId || "").trim();
  const storeId = getItemStoreId(category).toLowerCase();

  const categoryName = String(
    obj.name || obj.categoryName || obj.slug || obj.categoryId || ""
  )
    .trim()
    .toLowerCase();

  const tempId = String((obj as any).id || "").trim();

  const keys: string[] = [];

  // Best key: each store config row is unique
  if (storeConfigId) {
    keys.push(`config:${storeConfigId}`);
  }

  // Optimistic/new row key: store + category name
  if (storeId && categoryName) {
    keys.push(`store-category:${storeId}|${categoryName}`);
  }

  // Temp row key, but only store-specific
  if (tempId && tempId.startsWith("temp-") && storeId) {
    keys.push(`temp:${storeId}|${tempId}`);
  }

  return keys.filter(Boolean);
}

function sameCategoryUiRow(first: unknown, second: unknown) {
  const firstKeys = getCategoryUiRowKeys(first);
  const secondKeys = getCategoryUiRowKeys(second);

  return firstKeys.some((key) => secondKeys.includes(key));
}

function sortUiCategoryRows(categories: Category[]) {
  return [...categories].sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );
}

function upsertUiCategoryRows(currentRows: Category[], nextRows: Category[]) {
  if (!nextRows.length) return currentRows;

  const mergedRows = [...currentRows];

  nextRows.forEach((nextRow) => {
    const existingIndex = mergedRows.findIndex((currentRow) =>
      sameCategoryUiRow(currentRow, nextRow)
    );

    if (existingIndex >= 0) {
      mergedRows[existingIndex] = {
        ...(mergedRows[existingIndex] as object),
        ...(nextRow as object),
      } as Category;

      return;
    }

    mergedRows.unshift(nextRow);
  });

  return sortUiCategoryRows(mergedRows);
}

function removeTempCategoryRows(categories: Category[], tempId: string) {
  return categories.filter((category) => {
    const keys = getCategoryUiRowKeys(category);
    return !keys.some((key) => key.includes(tempId));
  });
}
function getCategoryTargetStoreIds(
  category: Category,
  fallbackStoreId: string,
  stores: StoreItem[] = []
) {
  const categoryObj = category as CategoryWithStoreMeta;

  const storeIds = Array.isArray(categoryObj.storeIds)
    ? categoryObj.storeIds
        .map((storeId) => normalizeStoreValue(storeId))
        .filter((storeId) => storeId && storeId !== "all")
    : [];

  if (storeIds.length) {
    return Array.from(new Set(storeIds));
  }

  const directStoreId = normalizeStoreValue(categoryObj.storeId);

  if (directStoreId && directStoreId !== "all") {
    return [directStoreId];
  }

  const fallback = normalizeStoreValue(fallbackStoreId);

  if (fallback && fallback !== "all") {
    return [fallback];
  }

  return getUniqueStoreIds(getAllStoreIds(stores));
}

function buildOptimisticCategoryRows(
  category: Category,
  fallbackStoreId: string,
  tempId: string,
  stores: StoreItem[] = []
) {
  const targetStoreIds = getCategoryTargetStoreIds(
    category,
    fallbackStoreId,
    stores
  );

  if (!targetStoreIds.length) {
    return [addTempId(category, tempId) as Category];
  }

  return targetStoreIds.map((storeId, index) => {
    const configId = `${tempId}-config-${storeId}`;

    const row = {
      ...(category as object),
      id: `${tempId}-${index}`,
      storeId,
      storeConfigId: configId,
      configId,
    } as CategoryWithStoreMeta;

    delete row.storeIds;

    return row as Category;
  });
}

function optimisticUpsert<T>(
  items: T[],
  item: T,
  isEdit: boolean,
  fallbackId: string
): T[] {
  const safeItem = addTempId(item, fallbackId);
  const itemId = getSafeId(safeItem) || fallbackId;

  if (!isEdit) {
    return [safeItem, ...items];
  }

  return items.map((current) => {
    const currentId = getSafeId(current);

    if (currentId !== itemId) {
      return current;
    }

    return {
      ...(current as object),
      ...(safeItem as object),
    } as T;
  });
}