"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { Category, CategoryStatus } from "../menu/types";
import { FormInput, FormSelect } from "../menu/components/ui";

export type CategoryFormRef = {
  submit: () => void;
};

type CategoryWithMongo = Category & {
  _id?: string;
  id?: string;
  slug?: string;
  storeId?: string;
  storeIds?: string[];
  storeSlugs?: string[];
  stores?: string[];
  selectedStores?: string[];
  selectedStoreIds?: string[];
  selectedStoreSlugs?: string[];
  storeConfigs?: Array<{
    storeId?: string;
    storeSlug?: string;
    store?: string;
    available?: boolean;
    isAvailable?: boolean;
    status?: string;
  }>;
};

type CategoryFormProps = {
  item: Category | null;
  categories: Category[];
  selectedStoreId?: string;
  // ✅ IMPORTANT: parent multi-store selector must pass this array
  selectedStoreIds?: string[];
  selectedStores?: string[];
  onSave: (value: CategoryWithMongo) => void;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function slugify(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(value: unknown) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeStoreId(value: unknown) {
  return slugify(value);
}

function uniqueStoreIds(...sources: unknown[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  function add(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }

    if (value && typeof value === "object") {
      const obj = value as any;
      add(obj.storeId || obj.storeSlug || obj.store || obj.slug || obj.id || obj.name);
      return;
    }

    const cleanStoreId = normalizeStoreId(value);
    if (!cleanStoreId || cleanStoreId === "all" || cleanStoreId === "all-stores") return;
    if (seen.has(cleanStoreId)) return;

    seen.add(cleanStoreId);
    output.push(cleanStoreId);
  }

  sources.forEach(add);
  return output;
}

function getCategoryId(category: CategoryWithMongo | null | undefined) {
  if (!category) return "";
  return cleanText(category._id || category.id || category.slug || "");
}

function getCategoryStoreIds(category: CategoryWithMongo) {
  return uniqueStoreIds(
    category.storeIds,
    category.storeSlugs,
    category.stores,
    category.selectedStores,
    category.selectedStoreIds,
    category.selectedStoreSlugs,
    category.storeConfigs
      ?.filter((config) => {
        if (config?.available === false || config?.isAvailable === false) return false;
        if (config?.status === "Inactive" || config?.status === "Hidden") return false;
        return true;
      })
      .map((config) => config.storeId || config.storeSlug || config.store),
    category.storeId
  );
}

function buildInitialForm(
  item: Category | null,
  safeCategories: CategoryWithMongo[],
  selectedStoreId: string,
  selectedStoreIds: string[],
  selectedStores: string[]
): CategoryWithMongo {
  const baseItem = (item || {}) as CategoryWithMongo;

  const targetStoreIds = uniqueStoreIds(
    baseItem.storeIds,
    baseItem.storeSlugs,
    baseItem.stores,
    baseItem.selectedStores,
    baseItem.selectedStoreIds,
    baseItem.selectedStoreSlugs,
    baseItem.storeConfigs,
    selectedStoreIds,
    selectedStores,
    baseItem.storeId,
    selectedStoreId
  );

  if (item) {
    return {
      ...baseItem,
      storeId: targetStoreIds[0] || baseItem.storeId || selectedStoreId,
      storeIds: targetStoreIds,
      storeSlugs: targetStoreIds,
      stores: targetStoreIds,
      selectedStores: targetStoreIds,
      selectedStoreIds: targetStoreIds,
      selectedStoreSlugs: targetStoreIds,
    };
  }

  return {
    id: "",
    storeId: targetStoreIds[0] || selectedStoreId,
    storeIds: targetStoreIds,
    storeSlugs: targetStoreIds,
    stores: targetStoreIds,
    selectedStores: targetStoreIds,
    selectedStoreIds: targetStoreIds,
    selectedStoreSlugs: targetStoreIds,
    name: "",
    status: "Active" as CategoryStatus,
    sortOrder: safeCategories.length + 1,
  };
}

const CategoryForm = forwardRef<CategoryFormRef, CategoryFormProps>(
  function CategoryForm(
    {
      item,
      categories,
      selectedStoreId = "",
      selectedStoreIds = [],
      selectedStores = [],
      onSave,
    },
    ref
  ) {
    const safeCategories = useMemo(
      () => (Array.isArray(categories) ? (categories as CategoryWithMongo[]) : []),
      [categories]
    );

    const [form, setForm] = useState<CategoryWithMongo>(() =>
      buildInitialForm(
        item,
        safeCategories,
        selectedStoreId,
        selectedStoreIds,
        selectedStores
      )
    );

    // ✅ Fix stale modal state when selected stores/item changes
    useEffect(() => {
      setForm(
        buildInitialForm(
          item,
          safeCategories,
          selectedStoreId,
          selectedStoreIds,
          selectedStores
        )
      );
    }, [item, safeCategories, selectedStoreId, selectedStoreIds, selectedStores]);

    const submit = () => {
      const name = cleanText(form.name);

      const targetStoreIds = uniqueStoreIds(
        form.storeIds,
        form.storeSlugs,
        form.stores,
        form.selectedStores,
        form.selectedStoreIds,
        form.selectedStoreSlugs,
        selectedStoreIds,
        selectedStores,
        form.storeId,
        selectedStoreId
      );

      if (!name) return alert("Category name required");

      if (!targetStoreIds.length) {
        return alert("Select at least one store for category");
      }

      const currentId = getCategoryId(form);
      const duplicate = safeCategories.find((category) => {
        const sameName = normalizeText(category.name) === normalizeText(name);
        if (!sameName) return false;

        const categoryId = getCategoryId(category);
        const sameRecord = Boolean(currentId && categoryId && currentId === categoryId);
        if (sameRecord) return false;

        const categoryStoreIds = getCategoryStoreIds(category);
        return targetStoreIds.some((storeId) => categoryStoreIds.includes(storeId));
      });

      if (duplicate) {
        return alert(`Category "${name}" already exists for selected store.`);
      }

      onSave({
        ...form,
        name,
        storeId: targetStoreIds[0],
        storeIds: targetStoreIds,
        storeSlugs: targetStoreIds,
        stores: targetStoreIds,
        selectedStores: targetStoreIds,
        selectedStoreIds: targetStoreIds,
        selectedStoreSlugs: targetStoreIds,
        sortOrder: Number(form.sortOrder || 1),
      });
    };

    useImperativeHandle(ref, () => ({ submit }));

    return (
      <>
        <FormInput
          label="Category Name"
          value={form.name}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              name: value,
            }))
          }
          placeholder="Pizzas"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormInput
            label="Sort Order"
            value={String(form.sortOrder)}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                sortOrder: Number(value || 1),
              }))
            }
            type="number"
            placeholder="1"
          />

          <FormSelect
            label="Status"
            value={form.status}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                status: value as CategoryStatus,
              }))
            }
            options={["Active", "Inactive"]}
          />
        </div>
      </>
    );
  }
);

CategoryForm.displayName = "CategoryForm";

export default CategoryForm;
