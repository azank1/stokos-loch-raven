"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ImagePlus, Upload } from "lucide-react";

import type {
  Category,
  Product,
  UpsellRule,
  UpsellStatus,
} from "../menu/types";
import { FormInput, FormSelect } from "../menu/components/ui";

export type UpsellFormRef = {
  submit: () => void;
};

type StoreItem = {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
};

type CategoryWithStoreData = Category & {
  storeIds?: string[];
  storeConfigs?: Array<{
    storeId?: string;
    available?: boolean;
    status?: string;
  }>;
};

type UpsellStoreConfigState = {
  _id?: string;
  id?: string;
  upsellId?: string;
  storeId: string;
  categoryId: string;
  categoryName: string;
  available: boolean;
  status: UpsellStatus;
  sortOrder?: number;
};

type UpsellFormProps = {
  item: UpsellRule | null;
  categories?: Category[];
  products?: Product[];
  stores?: StoreItem[];
  selectedStoreId?: string;
  onSave: (value: UpsellRule) => void;
};

type UpsellFormState = {
  _id?: string;
  id?: string;
  storeId: string;
  name: string;
  image: string;
  description: string;
  storeConfigs: UpsellStoreConfigState[];
  sortOrder?: number;
  status: UpsellStatus;
};

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

function getStoreValue(store: StoreItem) {
  return (
    normalizeStoreValue(store.slug) ||
    normalizeStoreValue(store._id) ||
    normalizeStoreValue(store.id) ||
    normalizeStoreValue(store.name)
  );
}

function getCategoryId(category: CategoryWithStoreData) {
  return normalizeStoreValue(
    category._id || category.id || category.slug || category.name
  );
}

function cleanStatus(value: unknown): UpsellStatus {
  const status = String(value || "").trim();

  if (["Active", "Paused", "Inactive"].includes(status)) {
    return status as UpsellStatus;
  }

  return "Active";
}

function getStoreName(stores: StoreItem[], storeId: string) {
  const foundStore = stores.find((store) => getStoreValue(store) === storeId);
  return foundStore?.name || storeId;
}

function categoryBelongsToStore(
  category: CategoryWithStoreData,
  storeId: string
) {
  const categoryStoreId = normalizeStoreValue(category.storeId);

  if (categoryStoreId && categoryStoreId === storeId) return true;

  const storeIds = Array.isArray(category.storeIds)
    ? category.storeIds
        .map((value) => normalizeStoreValue(value))
        .filter(Boolean)
    : [];

  if (storeIds.includes(storeId)) return true;

  const storeConfigs = Array.isArray(category.storeConfigs)
    ? category.storeConfigs
    : [];

  return storeConfigs.some((config) => {
    const configStoreId = normalizeStoreValue(config?.storeId);
    const available = config?.available !== false;
    const active = String(config?.status || "Active") !== "Inactive";
    return configStoreId === storeId && available && active;
  });
}

function getCategoriesForStore(categories: Category[], storeId: string) {
  const typedCategories = categories as CategoryWithStoreData[];

  const filtered = typedCategories.filter((category) =>
    categoryBelongsToStore(category, storeId)
  );

  const source = filtered.length ? filtered : typedCategories;
  const map = new Map<string, CategoryWithStoreData>();

  source.forEach((category) => {
    const categoryId = getCategoryId(category);
    if (!categoryId) return;
    if (!map.has(categoryId)) map.set(categoryId, category);
  });

  return Array.from(map.values()).sort(
    (first, second) =>
      Number(first.sortOrder || 0) - Number(second.sortOrder || 0)
  );
}

function getExistingStoreConfigs(item: UpsellRule | null): UpsellStoreConfigState[] {
  if (!item) return [];

  const directConfigs = Array.isArray(item.storeConfigs)
    ? item.storeConfigs
    : [];

  if (directConfigs.length > 0) {
    return directConfigs
      .map((config, index) => ({
        _id: config._id,
        id: config.id,
        upsellId: config.upsellId,
        storeId: normalizeStoreValue(config.storeId),
        categoryId: normalizeStoreValue(config.categoryId),
        categoryName: String(config.categoryName || "").trim(),
        available: config.available !== false,
        status: cleanStatus(config.status),
        sortOrder: Number(config.sortOrder ?? index),
      }))
      .filter((config) => config.storeId);
  }

  const storeIds = Array.isArray(item.storeIds) ? item.storeIds : [];
  const fallbackCategoryId = normalizeStoreValue(
    item.categoryId || item.triggerCategoryId
  );
  const fallbackCategoryName = String(
    item.categoryName ||
      item.categoryType ||
      item.triggerCategoryName ||
      ""
  ).trim();

  if (storeIds.length > 0) {
    return storeIds
      .map((storeId, index) => ({
        _id: undefined,
        id: undefined,
        upsellId: undefined,
        storeId: normalizeStoreValue(storeId),
        categoryId: fallbackCategoryId,
        categoryName: fallbackCategoryName,
        available: true,
        status: "Active" as UpsellStatus,
        sortOrder: index,
      }))
      .filter((config) => config.storeId);
  }

  const storeId = normalizeStoreValue(item.storeId);

  return storeId
    ? [
        {
          _id: undefined,
          id: undefined,
          upsellId: undefined,
          storeId,
          categoryId: fallbackCategoryId,
          categoryName: fallbackCategoryName,
          available: true,
          status: "Active" as UpsellStatus,
          sortOrder: 0,
        },
      ]
    : [];
}

function buildInitialStoreConfigs(
  item: UpsellRule | null,
  stores: StoreItem[],
  defaultStoreId: string
): UpsellStoreConfigState[] {
  const existingConfigs = getExistingStoreConfigs(item);
  const existingMap = new Map(
    existingConfigs.map((config) => [config.storeId, config])
  );

  const storeValues = stores
    .map((store) => getStoreValue(store))
    .filter(Boolean);
  const selectedDefaultStoreId =
    defaultStoreId || storeValues[0] || "towson";

  if (storeValues.length > 0) {
    return storeValues.map((storeId, index) => {
      const existing = existingMap.get(storeId);
      const shouldBeAvailable = item
        ? existing?.available === true
        : storeId === selectedDefaultStoreId;

      return {
        _id: existing?._id,
        id: existing?.id,
        upsellId: existing?.upsellId,
        storeId,
        categoryId: existing?.categoryId || "",
        categoryName: existing?.categoryName || "",
        available: shouldBeAvailable,
        status: shouldBeAvailable
          ? cleanStatus(existing?.status || "Active")
          : "Inactive",
        sortOrder: Number(existing?.sortOrder ?? index),
      };
    });
  }

  const fallbackConfig = existingConfigs[0];

  return [
    {
      _id: fallbackConfig?._id,
      id: fallbackConfig?.id,
      upsellId: fallbackConfig?.upsellId,
      storeId: fallbackConfig?.storeId || selectedDefaultStoreId,
      categoryId: fallbackConfig?.categoryId || "",
      categoryName: fallbackConfig?.categoryName || "",
      available: true,
      status: cleanStatus(fallbackConfig?.status || "Active"),
      sortOrder: Number(fallbackConfig?.sortOrder || 0),
    },
  ];
}

function getCategoryLabel(config: UpsellStoreConfigState) {
  if (!config.available) return "Off";
  return config.categoryName || "No category selected";
}

const UpsellForm = forwardRef<UpsellFormRef, UpsellFormProps>(
  function UpsellForm(
    { item, categories = [], stores = [], selectedStoreId = "", onSave },
    ref
  ) {
    const imageInputRef = useRef<HTMLInputElement | null>(null);

    const defaultStoreId =
      normalizeStoreValue(selectedStoreId) &&
      normalizeStoreValue(selectedStoreId) !== "all"
        ? normalizeStoreValue(selectedStoreId)
        : getStoreValue(stores[0] || ({} as StoreItem));

    const [form, setForm] = useState<UpsellFormState>(() => {
      const storeConfigs = buildInitialStoreConfigs(
        item,
        stores,
        defaultStoreId
      );
      const activeStore =
        storeConfigs.find((config) => config.available)?.storeId ||
        storeConfigs[0]?.storeId ||
        defaultStoreId ||
        "towson";

      if (item) {
        return {
          _id: item._id,
          id: item.id,
          storeId: item.storeId || activeStore,
          name: item.name || "",
          image: item.image || "",
          description: item.description || "",
          storeConfigs,
          sortOrder: item.sortOrder || 0,
          status: item.status || "Active",
        };
      }

      return {
        id: "",
        storeId: activeStore,
        name: "",
        image: "",
        description: "",
        storeConfigs,
        sortOrder: 0,
        status: "Active",
      };
    });

    const [activeStoreId, setActiveStoreId] = useState(() => {
      return (
        form.storeConfigs.find((config) => config.available)?.storeId ||
        form.storeConfigs[0]?.storeId ||
        defaultStoreId ||
        "towson"
      );
    });

    const activeStoreConfig = useMemo(() => {
      return (
        form.storeConfigs.find(
          (config) => config.storeId === activeStoreId
        ) || form.storeConfigs[0]
      );
    }, [activeStoreId, form.storeConfigs]);

    const activeStoreCategories = useMemo(() => {
      if (!activeStoreConfig?.storeId) return [];
      return getCategoriesForStore(categories, activeStoreConfig.storeId);
    }, [activeStoreConfig?.storeId, categories]);

    const selectedStoreConfigs = useMemo(() => {
      return form.storeConfigs.filter((config) => config.available);
    }, [form.storeConfigs]);

    const selectedStoreIds = useMemo(() => {
      return selectedStoreConfigs
        .map((config) => config.storeId)
        .filter(Boolean);
    }, [selectedStoreConfigs]);

    const updateStoreConfig = (
      storeId: string,
      updater: (
        config: UpsellStoreConfigState
      ) => UpsellStoreConfigState
    ) => {
      setForm((prev) => ({
        ...prev,
        storeConfigs: prev.storeConfigs.map((config) =>
          config.storeId === storeId ? updater(config) : config
        ),
      }));
    };

    const toggleStoreAvailability = (storeId: string) => {
      updateStoreConfig(storeId, (config) => {
        const nextAvailable = !config.available;

        return {
          ...config,
          available: nextAvailable,
          status: nextAvailable ? "Active" : "Inactive",
        };
      });

      setActiveStoreId(storeId);
      setForm((prev) => ({ ...prev, storeId }));
    };

    const enableAllStores = () => {
      setForm((prev) => ({
        ...prev,
        storeConfigs: prev.storeConfigs.map((config) => ({
          ...config,
          available: true,
          status:
            config.status === "Inactive" ? "Active" : config.status,
        })),
      }));
    };

    const disableAllStores = () => {
      setForm((prev) => ({
        ...prev,
        storeConfigs: prev.storeConfigs.map((config) => ({
          ...config,
          available: false,
          status: "Inactive" as UpsellStatus,
        })),
      }));
    };

    const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Please upload JPG, PNG, or WEBP image only.");
        event.target.value = "";
        return;
      }

      if (file.size > 1.5 * 1024 * 1024) {
        alert("Image size should be under 1.5MB.");
        event.target.value = "";
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        setForm((prev) => ({
          ...prev,
          image: String(reader.result || ""),
        }));
      };

      reader.readAsDataURL(file);
    };

    const handleCategoryChange = (categoryId: string) => {
      if (!activeStoreConfig) return;

      const category = activeStoreCategories.find(
        (item) => getCategoryId(item) === categoryId
      );

      updateStoreConfig(activeStoreConfig.storeId, (config) => ({
        ...config,
        categoryId,
        categoryName: category?.name || "",
        available: categoryId ? true : config.available,
        status:
          categoryId && config.status === "Inactive"
            ? "Active"
            : config.status,
      }));
    };

    const submit = () => {
      const name = form.name.trim();
      const activeConfigs = form.storeConfigs.filter(
        (config) => config.available && config.status !== "Inactive"
      );

      if (!name) {
        return alert("Upsell name is required.");
      }

      if (activeConfigs.length === 0) {
        return alert("Select at least one store for this upsell item.");
      }

      const missingCategory = activeConfigs.find(
        (config) => !config.categoryId || !config.categoryName
      );

      if (missingCategory) {
        return alert(
          `Select category for ${getStoreName(
            stores,
            missingCategory.storeId
          )}.`
        );
      }

      const primaryConfig = activeConfigs[0];
      const primaryStoreId =
        primaryConfig.storeId || form.storeId || "towson";

      onSave({
        _id: form._id,
        id: form.id,
        storeId: primaryStoreId,
        storeIds: activeConfigs.map((config) => config.storeId),
        storeConfigs: form.storeConfigs.map((config, index) => ({
          _id: config._id,
          id: config.id,
          upsellId: config.upsellId,
          storeId: config.storeId,
          categoryId: config.categoryId,
          categoryName: config.categoryName,
          available: config.available,
          status: config.available
            ? config.status || "Active"
            : "Inactive",
          sortOrder: Number(config.sortOrder ?? index),
        })),
        name,
        image: form.image.trim(),
        description: form.description.trim(),
        categoryId: primaryConfig.categoryId,
        categoryName: primaryConfig.categoryName,
        categoryType: primaryConfig.categoryName,
        sortOrder: Number(form.sortOrder || 0),
        status: form.status || "Active",
      });
    };

    useImperativeHandle(ref, () => ({
      submit,
    }));

    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-zinc-200 p-4">
          <label className="mb-3 block text-xs font-black text-zinc-700">
            Upsell Image
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-green-50 text-xs font-black text-green-800">
              {form.image ? (
                <img
                  src={form.image}
                  alt={form.name || "Upsell"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImagePlus size={22} />
              )}
            </div>

            <div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full bg-green-800 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-green-900"
              >
                <Upload size={14} />
                Upload from PC
              </button>

              <p className="mt-2 text-xs font-semibold text-zinc-500">
                Upload JPG, PNG, or WEBP. Keep image under 1.5MB.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormInput
            label="Upsell Name"
            value={form.name}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                name: value,
              }))
            }
            placeholder="Garlic Bread"
          />

          <FormSelect
            label="Status"
            value={form.status}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                status: value as UpsellStatus,
              }))
            }
            options={["Active", "Paused", "Inactive"]}
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">
            Description
          </label>

          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            rows={3}
            placeholder="Short optional note for admin/customer side display."
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-green-700"
          />
        </div>

        <div className="rounded-3xl border border-zinc-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-zinc-950">
                Store Availability &amp; Category
              </h4>

              <p className="mt-1 text-xs font-semibold text-zinc-500">
                Upsell is added once. Pick a store tab below, then select
                that store&apos;s category and availability.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={enableAllStores}
                className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-800 ring-1 ring-green-100 transition hover:bg-green-100"
              >
                Enable All
              </button>

              <button
                type="button"
                onClick={disableAllStores}
                className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-black text-zinc-700 transition hover:bg-zinc-200"
              >
                Turn Off All
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {form.storeConfigs.map((config) => {
              const storeName = getStoreName(stores, config.storeId);
              const isActive =
                activeStoreConfig?.storeId === config.storeId;

              return (
                <button
                  key={config.storeId}
                  type="button"
                  onClick={() => {
                    setActiveStoreId(config.storeId);
                    setForm((prev) => ({
                      ...prev,
                      storeId: config.storeId,
                    }));
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isActive
                      ? "border-green-700 bg-green-50 text-green-950"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-black">
                        {storeName}
                      </span>
                      <span className="mt-1 block text-xs font-bold text-zinc-500">
                        {getCategoryLabel(config)}
                      </span>
                    </span>

                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-black ${
                        config.available
                          ? "bg-green-100 text-green-800"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {config.available ? "Available" : "Off"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {activeStoreConfig && (
            <div className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h5 className="text-sm font-black text-zinc-950">
                    {getStoreName(stores, activeStoreConfig.storeId)} Store
                    Config
                  </h5>
                  <p className="mt-1 text-xs font-semibold text-zinc-500">
                    {activeStoreConfig.storeId}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    toggleStoreAvailability(activeStoreConfig.storeId)
                  }
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    activeStoreConfig.available
                      ? "bg-green-800 text-white hover:bg-green-900"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {activeStoreConfig.available ? "Available" : "Turn On"}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-black text-zinc-700">
                    Category
                  </label>

                  <select
                    value={activeStoreConfig.categoryId}
                    onChange={(event) =>
                      handleCategoryChange(event.target.value)
                    }
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-900 outline-none transition focus:border-green-700"
                  >
                    <option value="">Select category</option>
                    {activeStoreCategories.map((category) => {
                      const categoryId = getCategoryId(category);

                      return (
                        <option key={categoryId} value={categoryId}>
                          {category.name}
                        </option>
                      );
                    })}
                  </select>

                  {activeStoreCategories.length === 0 && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      No categories found for this store.
                    </p>
                  )}
                </div>

                <FormSelect
                  label="Status"
                  value={activeStoreConfig.status}
                  onChange={(value) =>
                    updateStoreConfig(
                      activeStoreConfig.storeId,
                      (config) => ({
                        ...config,
                        status: value as UpsellStatus,
                        available: value !== "Inactive",
                      })
                    )
                  }
                  options={["Active", "Paused", "Inactive"]}
                />

                <FormInput
                  label="Sort Order"
                  value={String(activeStoreConfig.sortOrder ?? 0)}
                  onChange={(value) =>
                    updateStoreConfig(
                      activeStoreConfig.storeId,
                      (config) => ({
                        ...config,
                        sortOrder: Number(value || 0),
                      })
                    )
                  }
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {form.storeConfigs.length === 0 && (
            <p className="mt-4 text-sm font-semibold text-red-600">
              No stores found. Please add stores first.
            </p>
          )}
        </div>
      </div>
    );
  }
);

UpsellForm.displayName = "UpsellForm";

export default UpsellForm;