"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

export type ModifierGroupFormRef = {
  submit: () => void;
};

type StoreItem = {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  status?: string;
};

type CategoryItem = {
  _id?: string;
  id?: string;
  name: string;
  slug?: string;
  storeId?: string;
  storeIds?: string[];
  status?: string;
  storeConfigs?: Array<{
    storeId?: string;
    available?: boolean;
    isAvailable?: boolean;
    status?: string;
  }>;
};

type ModifierOptionState = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
};

type ModifierGroupAssignmentState = {
  _id?: string;
  id?: string;
  storeId: string;
  categoryId: string;
  categoryName: string;
  status: "Active" | "Inactive";
  sortOrder: number;
};

type ModifierGroupItem = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  options?: Array<string | Partial<ModifierOptionState>>;
  assignments?: ModifierGroupAssignmentState[];
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  sortOrder?: number;
  status?: "Active" | "Inactive";
};

type ModifierGroupFormProps = {
  item: ModifierGroupItem | null;
  stores?: StoreItem[];
  categories?: CategoryItem[];
  selectedStoreId?: string;
  onSave: (value: any) => void;
  onCancel?: () => void;
};

const ALL_CATEGORIES_ID = "all";
const ALL_CATEGORIES_NAME = "All Categories";

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanNumber(value: unknown) {
  const number = Number(String(value ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function blockBadNumberKeys(event: KeyboardEvent<HTMLInputElement>) {
  if (["-", "+", "e", "E", "."].includes(event.key)) {
    event.preventDefault();
  }
}

function getStoreId(store: StoreItem | null | undefined) {
  if (!store) return "";
  return String(store.slug || store._id || store.id || "").trim();
}

function getStoreName(stores: StoreItem[], storeId: string) {
  const cleanStoreId = String(storeId || "").trim();
  const found = stores.find((store) => getStoreId(store) === cleanStoreId);
  return found?.name || cleanStoreId || "Store";
}

function getCategoryId(category: CategoryItem | null | undefined) {
  if (!category) return "";
  return String(category._id || category.id || category.slug || "").trim();
}

function categoryMatchesStore(category: CategoryItem, storeId: string) {
  const cleanStoreId = String(storeId || "").trim();

  if (category.status === "Inactive" || category.status === "Hidden") {
    return false;
  }

  const storeConfigs = Array.isArray(category.storeConfigs)
    ? category.storeConfigs
    : [];

  if (storeConfigs.length > 0) {
    return storeConfigs.some((config) => {
      const configStoreId = String(config.storeId || "").trim();
      const available = config.available !== false && config.isAvailable !== false;
      const active = config.status !== "Inactive" && config.status !== "Hidden";

      return configStoreId === cleanStoreId && available && active;
    });
  }

  const legacyStoreId = String(category.storeId || "").trim();

  if (legacyStoreId) {
    return legacyStoreId === cleanStoreId;
  }

  if (Array.isArray(category.storeIds) && category.storeIds.length > 0) {
    return category.storeIds
      .map((item) => String(item || "").trim())
      .includes(cleanStoreId);
  }

  return true;
}

function getCategoriesForStore(categories: CategoryItem[], storeId: string) {
  const uniqueByName = new Map<string, CategoryItem>();

  categories.forEach((category) => {
    if (!categoryMatchesStore(category, storeId)) return;

    const name = String(category.name || "").trim();
    if (!name) return;

    const key = name.toLowerCase();
    if (!uniqueByName.has(key)) uniqueByName.set(key, category);
  });

  return Array.from(uniqueByName.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function normalizeOptions(value: unknown) {
  const rawOptions = Array.isArray(value) ? value : [];
  const seen = new Set<string>();

  return rawOptions
    .map((option, index) => {
      if (typeof option === "string" || typeof option === "number") {
        const name = String(option || "").trim();
        if (!name) return null;

        const id = slugify(name) || `option-${index + 1}`;
        const key = id.toLowerCase();

        if (seen.has(key)) return null;
        seen.add(key);

        return { id, name, status: "Active" as const };
      }

      if (!option || typeof option !== "object") return null;

      const obj = option as Partial<ModifierOptionState> & {
        label?: unknown;
        title?: unknown;
        value?: unknown;
      };

      const name = String(
        obj.name || obj.label || obj.title || obj.value || ""
      ).trim();

      if (!name) return null;

      const id = String(obj.id || slugify(name) || `option-${index + 1}`).trim();
      const key = id.toLowerCase();

      if (seen.has(key)) return null;
      seen.add(key);

      return {
        id,
        name,
        status: obj.status === "Inactive" ? "Inactive" : ("Active" as const),
      };
    })
    .filter(Boolean) as ModifierOptionState[];
}

function optionsToText(options: ModifierOptionState[]) {
  return options.map((option) => option.name).join("\n");
}

function parseOptionsText(value: string) {
  const tokens = String(value || "")
    .split(/[\n,;|]+/g)
    .map((item) => item.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);

  return normalizeOptions(tokens);
}

function normalizeAssignment(
  assignment: Partial<ModifierGroupAssignmentState> | undefined,
  fallbackStoreId: string
): ModifierGroupAssignmentState {
  const categoryId = String(assignment?.categoryId || "").trim();
  const categoryName = String(assignment?.categoryName || "").trim();
  const isAll =
    slugify(categoryId) === ALL_CATEGORIES_ID ||
    slugify(categoryName) === "all-categories";

  return {
    _id: assignment?._id,
    id: assignment?.id,
    storeId: String(assignment?.storeId || fallbackStoreId || "").trim(),
    categoryId: isAll || !categoryId ? ALL_CATEGORIES_ID : categoryId,
    categoryName: isAll || !categoryName ? ALL_CATEGORIES_NAME : categoryName,
    status: assignment?.status === "Inactive" ? "Inactive" : "Active",
    sortOrder: cleanNumber(assignment?.sortOrder || 0),
  };
}

function createBlankAssignment(storeId: string): ModifierGroupAssignmentState {
  return normalizeAssignment(
    {
      storeId,
      categoryId: ALL_CATEGORIES_ID,
      categoryName: ALL_CATEGORIES_NAME,
      status: "Active",
      sortOrder: 0,
    },
    storeId
  );
}

function getStoreKey(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function uniqueAssignmentsByStore(
  assignments: ModifierGroupAssignmentState[],
  fallbackStoreId: string
) {
  const seen = new Set<string>();

  return assignments
    .map((assignment) => normalizeAssignment(assignment, fallbackStoreId))
    .filter((assignment) => {
      const storeKey = getStoreKey(assignment.storeId);

      if (!storeKey) return true;
      if (seen.has(storeKey)) return false;

      seen.add(storeKey);
      return true;
    });
}

const ModifierGroupForm = forwardRef<ModifierGroupFormRef, ModifierGroupFormProps>(
  function ModifierGroupForm(
    {
      item,
      stores = [],
      categories = [],
      selectedStoreId = "",
      onSave,
      onCancel,
    },
    ref
  ) {
    const safeStores = Array.isArray(stores) ? stores : [];
    const safeCategories = Array.isArray(categories) ? categories : [];
    const firstStoreId =
      selectedStoreId || getStoreId(safeStores[0]) || item?.assignments?.[0]?.storeId || "";

    const [name, setName] = useState(String(item?.name || ""));
    const [optionsText, setOptionsText] = useState(() =>
      optionsToText(normalizeOptions(item?.options || []))
    );
    const [required, setRequired] = useState(Boolean(item?.required));
    const [minSelect, setMinSelect] = useState(String(item?.minSelect ?? 0));
    const [maxSelect, setMaxSelect] = useState(String(item?.maxSelect ?? 0));
    const [status, setStatus] = useState<"Active" | "Inactive">(
      item?.status === "Inactive" ? "Inactive" : "Active"
    );
    const [assignments, setAssignments] = useState<ModifierGroupAssignmentState[]>(
      () => {
        const rawAssignments = Array.isArray(item?.assignments)
          ? item?.assignments || []
          : [];

        if (rawAssignments.length > 0) {
          const uniqueAssignments = uniqueAssignmentsByStore(
            rawAssignments.map((assignment) =>
              normalizeAssignment(assignment, firstStoreId)
            ),
            firstStoreId
          );

          return uniqueAssignments.length > 0
            ? uniqueAssignments
            : [createBlankAssignment(firstStoreId)];
        }

        return [createBlankAssignment(firstStoreId)];
      }
    );

    const parsedOptions = useMemo(() => parseOptionsText(optionsText), [optionsText]);

    const selectableStoreIds = useMemo(() => {
      const storeIds = safeStores
        .map((store) => getStoreId(store))
        .filter(Boolean);

      return Array.from(new Set(storeIds));
    }, [safeStores]);

    const selectedStoreKeys = useMemo(() => {
      return new Set(
        assignments
          .map((assignment) => getStoreKey(assignment.storeId))
          .filter(Boolean)
      );
    }, [assignments]);

    const canAddMoreAssignments =
      selectableStoreIds.length === 0
        ? assignments.length === 0
        : selectedStoreKeys.size < selectableStoreIds.length;

    const getAvailableStoresForAssignment = (index: number) => {
      const currentStoreKey = getStoreKey(assignments[index]?.storeId);

      const selectedByOtherRows = new Set(
        assignments
          .filter((_, assignmentIndex) => assignmentIndex !== index)
          .map((assignment) => getStoreKey(assignment.storeId))
          .filter(Boolean)
      );

      return safeStores.filter((store) => {
        const storeId = getStoreId(store);
        const storeKey = getStoreKey(storeId);

        if (!storeId || !storeKey) return false;

        return storeKey === currentStoreKey || !selectedByOtherRows.has(storeKey);
      });
    };

    const updateAssignment = (
      index: number,
      updater: (assignment: ModifierGroupAssignmentState) => ModifierGroupAssignmentState
    ) => {
      setAssignments((current) =>
        current.map((assignment, assignmentIndex) =>
          assignmentIndex === index ? updater(assignment) : assignment
        )
      );
    };

    const handleStoreChange = (index: number, storeId: string) => {
      const cleanStoreId = String(storeId || "").trim();
      const cleanStoreKey = getStoreKey(cleanStoreId);

      if (
        cleanStoreKey &&
        assignments.some(
          (assignment, assignmentIndex) =>
            assignmentIndex !== index &&
            getStoreKey(assignment.storeId) === cleanStoreKey
        )
      ) {
        alert(
          `${getStoreName(
            safeStores,
            cleanStoreId
          )} store already selected. Use one assignment per store.`
        );
        return;
      }

      updateAssignment(index, (assignment) => ({
        ...assignment,
        storeId: cleanStoreId,
        categoryId: ALL_CATEGORIES_ID,
        categoryName: ALL_CATEGORIES_NAME,
      }));
    };

    const handleCategoryChange = (index: number, value: string) => {
      updateAssignment(index, (assignment) => {
        if (value === ALL_CATEGORIES_ID) {
          return {
            ...assignment,
            categoryId: ALL_CATEGORIES_ID,
            categoryName: ALL_CATEGORIES_NAME,
          };
        }

        const storeCategories = getCategoriesForStore(
          safeCategories,
          assignment.storeId
        );
        const selectedCategory = storeCategories.find(
          (category) => getCategoryId(category) === value || category.name === value
        );

        return {
          ...assignment,
          categoryId: getCategoryId(selectedCategory) || value,
          categoryName: selectedCategory?.name || value,
        };
      });
    };

    const addAssignment = () => {
      setAssignments((current) => {
        if (safeStores.length === 0) {
          if (current.length > 0) {
            alert("Please add stores first.");
            return current;
          }

          return [createBlankAssignment("")];
        }

        const selectedKeys = new Set(
          current
            .map((assignment) => getStoreKey(assignment.storeId))
            .filter(Boolean)
        );

        const nextStore = safeStores.find((store) => {
          const storeId = getStoreId(store);
          return storeId && !selectedKeys.has(getStoreKey(storeId));
        });

        const nextStoreId = getStoreId(nextStore);

        if (!nextStoreId) {
          alert("All stores are already selected for this modifier group.");
          return current;
        }

        return [...current, createBlankAssignment(nextStoreId)];
      });
    };

    const removeAssignment = (index: number) => {
      setAssignments((current) => {
        if (current.length <= 1) return current;
        return current.filter((_, assignmentIndex) => assignmentIndex !== index);
      });
    };

    const clearOptions = () => setOptionsText("");

    const submit = () => {
      const cleanName = name.trim();

      if (!cleanName) {
        alert("Modifier group name required.");
        return;
      }

      if (parsedOptions.length === 0) {
        alert("At least one modifier option is required.");
        return;
      }

      const cleanAssignments = assignments
        .map((assignment) => normalizeAssignment(assignment, firstStoreId))
        .filter((assignment) => assignment.storeId);

      if (cleanAssignments.length === 0) {
        alert("Select at least one store/category assignment.");
        return;
      }

      const duplicateStoreAssignment = cleanAssignments.find(
        (assignment, index) =>
          cleanAssignments.findIndex(
            (item) => getStoreKey(item.storeId) === getStoreKey(assignment.storeId)
          ) !== index
      );

      if (duplicateStoreAssignment) {
        alert(
          `${getStoreName(
            safeStores,
            duplicateStoreAssignment.storeId
          )} store is selected more than once. Use one assignment per store.`
        );
        return;
      }

      onSave({
        ...(item || {}),
        _id: item?._id,
        id: item?.id,
        name: cleanName,
        slug: item?.slug || slugify(cleanName),
        options: parsedOptions,
        assignments: cleanAssignments,
        required,
        minSelect: cleanNumber(minSelect),
        maxSelect: cleanNumber(maxSelect),
        status,
        sortOrder: cleanNumber(item?.sortOrder || 0),
        replaceAssignments: true,
      });
    };

    useImperativeHandle(ref, () => ({ submit }));

    return (
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-xs font-black text-zinc-700">
            Modifier Group Name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Fixing"
            className="h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-bold outline-none transition focus:border-green-700"
          />
        </div>

        <div className="rounded-[22px] border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-zinc-900">
                Modifier Options
              </h3>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-zinc-500">
                Add option names only. Commas, new lines, bullets, semicolon and pipe are supported.
                Prices will be handled later in Product Form.
              </p>
            </div>

            <button
              type="button"
              onClick={clearOptions}
              className="rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-600 transition hover:bg-red-100"
            >
              Clear Options
            </button>
          </div>

          <textarea
            value={optionsText}
            onChange={(event) => setOptionsText(event.target.value)}
            placeholder={"Pepperoni\nSausage\nHam\nBacon"}
            className="min-h-[160px] w-full rounded-2xl border border-zinc-200 p-4 text-sm font-bold outline-none transition focus:border-green-700"
          />

          <p className="mt-2 text-xs font-bold text-zinc-500">
            {parsedOptions.length} option{parsedOptions.length === 1 ? "" : "s"} ready to save
          </p>
        </div>

        <div className="rounded-[22px] border border-zinc-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-zinc-900">
                Where This Group Appears
              </h3>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                Select a store and choose one category, or choose All Categories for that store.
                A store can only be selected once in this modifier group.
              </p>
            </div>

            <button
              type="button"
              onClick={addAssignment}
              disabled={!canAddMoreAssignments}
              className="rounded-full bg-green-700 px-4 py-2 text-xs font-black text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add Store/Category
            </button>
          </div>

          <div className="space-y-4">
            {assignments.map((assignment, index) => {
              const storeCategories = getCategoriesForStore(
                safeCategories,
                assignment.storeId
              );
              const availableStores = getAvailableStoresForAssignment(index);

              return (
                <div
                  key={`${assignment.storeId}-${assignment.categoryId}-${index}`}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px]">
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-zinc-400">
                        Store
                      </span>
                      <select
                        value={assignment.storeId}
                        onChange={(event) => handleStoreChange(index, event.target.value)}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-green-700"
                      >
                        <option value="">Select Store</option>
                        {availableStores.map((store) => {
                          const storeId = getStoreId(store);

                          return (
                            <option key={storeId} value={storeId}>
                              {store.name || storeId}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-zinc-400">
                        Category
                      </span>
                      <select
                        value={assignment.categoryId || ALL_CATEGORIES_ID}
                        onChange={(event) => handleCategoryChange(index, event.target.value)}
                        disabled={!assignment.storeId}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-green-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                      >
                        <option value={ALL_CATEGORIES_ID}>All Categories</option>
                        {storeCategories.map((category) => {
                          const categoryId = getCategoryId(category) || category.name;

                          return (
                            <option key={categoryId} value={categoryId}>
                              {category.name}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-zinc-400">
                        Status
                      </span>
                      <select
                        value={assignment.status}
                        onChange={(event) =>
                          updateAssignment(index, (current) => ({
                            ...current,
                            status:
                              event.target.value === "Inactive" ? "Inactive" : "Active",
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-green-700"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-zinc-500">
                      Assignment #{index + 1} — {getStoreName(safeStores, assignment.storeId)} / {assignment.categoryName || ALL_CATEGORIES_NAME}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeAssignment(index)}
                      disabled={assignments.length <= 1}
                      className="rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove Assignment
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                Required
              </p>
              <p className="mt-1 text-sm font-black text-zinc-900">
                Customer must choose
              </p>
            </div>
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
              className="h-5 w-5 accent-green-700"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Min Select
            </span>
            <input
              value={minSelect}
              onKeyDown={blockBadNumberKeys}
              onChange={(event) => setMinSelect(String(cleanNumber(event.target.value)))}
              inputMode="numeric"
              className="h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-bold outline-none transition focus:border-green-700"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Max Select
            </span>
            <input
              value={maxSelect}
              onKeyDown={blockBadNumberKeys}
              onChange={(event) => setMaxSelect(String(cleanNumber(event.target.value)))}
              inputMode="numeric"
              className="h-11 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-bold outline-none transition focus:border-green-700"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-zinc-200 bg-white p-4">
          <label className="block min-w-[180px]">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">
              Group Status
            </span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value === "Inactive" ? "Inactive" : "Active")
              }
              className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-bold outline-none transition focus:border-green-700"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>

          <div className="flex items-center gap-3">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full bg-zinc-100 px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-200"
              >
                Cancel
              </button>
            ) : null}

            <button
              type="button"
              onClick={submit}
              className="rounded-full bg-green-800 px-5 py-3 text-sm font-black text-white transition hover:bg-green-900"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }
);

ModifierGroupForm.displayName = "ModifierGroupForm";

export default ModifierGroupForm;
