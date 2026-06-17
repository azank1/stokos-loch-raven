"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
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
  stores?: string[];
  storeConfigs?: Array<{
    storeId?: string;
    available?: boolean;
    isAvailable?: boolean;
    status?: string;
  }>;
};

type CategoryFormProps = {
  item: Category | null;
  categories: Category[];
  selectedStoreId?: string;
  selectedStoreIds?: string[];
  onSave: (value: CategoryWithMongo) => void;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizeText(value: unknown) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeStoreId(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueStoreIds(values: unknown[]) {
  return Array.from(
    new Set(values.map(normalizeStoreId).filter(Boolean))
  );
}

function getCategoryId(category: CategoryWithMongo | null | undefined) {
  if (!category) return "";
  return cleanText(category._id || category.id || category.slug || "");
}

function getCategoryStoreIds(category: CategoryWithMongo | null | undefined) {
  if (!category) return [];

  const storeIds: string[] = [];

  if (category.storeId) storeIds.push(category.storeId);

  if (Array.isArray(category.storeIds)) {
    storeIds.push(...category.storeIds);
  }

  if (Array.isArray(category.stores)) {
    storeIds.push(...category.stores);
  }

  if (Array.isArray(category.storeConfigs)) {
    category.storeConfigs.forEach((config) => {
      if (config?.available === false || config?.isAvailable === false) return;
      if (["Inactive", "Hidden"].includes(cleanText(config?.status))) return;
      if (config?.storeId) storeIds.push(config.storeId);
    });
  }

  return uniqueStoreIds(storeIds);
}

const CategoryForm = forwardRef<CategoryFormRef, CategoryFormProps>(
  function CategoryForm(
    {
      item,
      categories,
      selectedStoreId = "",
      selectedStoreIds = [],
      onSave,
    },
    ref
  ) {
    const safeCategories = useMemo(
      () => (Array.isArray(categories) ? (categories as CategoryWithMongo[]) : []),
      [categories]
    );

    const activeSelectedStoreIds = useMemo(() => {
      const fromMulti = uniqueStoreIds(selectedStoreIds);
      const fromSingle = normalizeStoreId(selectedStoreId);

      if (fromMulti.length > 0) return fromMulti;
      if (fromSingle) return [fromSingle];

      return [];
    }, [selectedStoreId, selectedStoreIds]);

    const buildInitialForm = (): CategoryWithMongo => {
      if (item) {
        const editItem = item as CategoryWithMongo;
        const itemStoreIds = getCategoryStoreIds(editItem);
        const finalStoreIds =
          itemStoreIds.length > 0 ? itemStoreIds : activeSelectedStoreIds;

        return {
          ...editItem,
          name: editItem.name || "",
          storeId: finalStoreIds[0] || "",
          storeIds: finalStoreIds,
          status: (editItem.status || "Active") as CategoryStatus,
          sortOrder: Number(editItem.sortOrder || 1),
        };
      }

      return {
        id: "",
        name: "",
        storeId: activeSelectedStoreIds[0] || "",
        storeIds: activeSelectedStoreIds,
        status: "Active" as CategoryStatus,
        sortOrder: safeCategories.length + 1,
      };
    };

    const [form, setForm] = useState<CategoryWithMongo>(buildInitialForm);

    useEffect(() => {
      setForm(buildInitialForm());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item]);

    const submit = () => {
      const name = cleanText(form.name);
      const submitStoreIds = uniqueStoreIds([
        ...(Array.isArray(form.storeIds) ? form.storeIds : []),
        ...(Array.isArray(form.stores) ? form.stores : []),
        ...activeSelectedStoreIds,
        form.storeId,
      ]);

      if (!name) return alert("Category name required");

      if (submitStoreIds.length === 0) {
        return alert("Store is required for category");
      }

      const currentId = getCategoryId(form);

      const duplicate = safeCategories.find((category) => {
        const sameName = normalizeText(category.name) === normalizeText(name);
        if (!sameName) return false;

        const categoryId = getCategoryId(category);
        const sameRecord = Boolean(currentId && categoryId && currentId === categoryId);
        if (sameRecord) return false;

        const categoryStoreIds = getCategoryStoreIds(category);

        return submitStoreIds.some((storeId) => categoryStoreIds.includes(storeId));
      });

      if (duplicate) {
        return alert(`Category "${name}" already exists for selected store.`);
      }

      onSave({
        ...form,
        name,
        storeId: submitStoreIds[0],
        storeIds: submitStoreIds,
        stores: submitStoreIds,
        status: (form.status || "Active") as CategoryStatus,
        sortOrder: Number(form.sortOrder || 1),
      });
    };

    useImperativeHandle(ref, () => ({ submit }));

    return (
      <>
        <FormInput
          label="Category Name"
          value={String(form.name || "")}
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
            value={String(form.sortOrder || 1)}
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
            value={String(form.status || "Active")}
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