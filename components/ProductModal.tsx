"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { X, Plus, Minus } from "lucide-react";
import { useCartStore, type CartItem } from "@/app/store/[slug]/usecartstore";

interface ProductModalProps {
  product: ProductLike | null;
  isOpen: boolean;
  onClose: () => void;
}

type AnyRecord = Record<string, unknown>;

type ToppingSide = "left" | "right" | "whole";

type ProductLike = {
  id?: string;
  _id?: string;
  title?: string;
  name?: string;
  description?: string;
  image?: string;
  category?: string;
  categorySlug?: string;
  price?: string | number;
  numericPrice?: string | number;
  sizes?: unknown[];
  modifierGroups?: unknown[];
  attachedModifierGroups?: unknown[];
};

type ProductSize = {
  id: string;
  name: string;
  label: string;
  price: number;
  sortOrder: number;
};

type ModifierOption = {
  id: string;
  optionId: string;
  name: string;
  status: string;
  price: number;
  pricesBySize: Record<string, number>;
  sortOrder: number;
};

type ModifierGroup = {
  id: string;
  modifierGroupId: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  status: string;
  options: ModifierOption[];
};

type SelectedModifierDetail = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
  side: ToppingSide;
  isPizzaTopping: boolean;
};

const FALLBACK_IMAGE = "/images/placeholder-food.png";

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function cleanNumber(value: unknown) {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : 0;
  }

  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();

    if (["true", "yes", "1", "required", "active"].includes(lower)) {
      return true;
    }

    if (["false", "no", "0", "optional", "inactive"].includes(lower)) {
      return false;
    }
  }

  return fallback;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getProductId(product: ProductLike) {
  return readString(
    product.id ||
      product._id ||
      slugify(product.title || product.name || "product")
  );
}

function getSizeLabel(size: ProductSize) {
  return readString(size.label || size.name || size.id, "Regular");
}

function getSizeId(size: ProductSize) {
  return readString(size.id || slugify(getSizeLabel(size)), "regular");
}

function getModifierSideKey(group: ModifierGroup, option: ModifierOption) {
  return `${group.id}__${option.optionId}`;
}

function isPizzaProduct(product: ProductLike | null) {
  const value = [
    product?.category,
    product?.categorySlug,
    product?.title,
    product?.name,
  ]
    .map((item) => readString(item).toLowerCase())
    .join(" ");

  return value.includes("pizza") || value.includes("pizzas");
}

function isToppingGroup(group: ModifierGroup) {
  const name = group.name.toLowerCase();
  return name.includes("topping") || name.includes("toppings");
}

function isPizzaToppingGroup(product: ProductLike | null, group: ModifierGroup) {
  return isPizzaProduct(product) && isToppingGroup(group);
}

function getOptionPrice(option: ModifierOption, selectedSize: ProductSize | null) {
  if (!selectedSize) return cleanNumber(option.price);

  const sizeKeys = [
    selectedSize.id,
    selectedSize.name,
    selectedSize.label,
    slugify(selectedSize.id),
    slugify(selectedSize.name),
    slugify(selectedSize.label),
  ].filter(Boolean);

  for (const key of sizeKeys) {
    const exactValue = option.pricesBySize[key];

    if (exactValue !== undefined && exactValue !== null) {
      return cleanNumber(exactValue);
    }
  }

  return cleanNumber(option.price);
}

function readPricesBySize(option: AnyRecord) {
  const output: Record<string, number> = {};

  const directPrices =
    option.pricesBySize ||
    option.priceBySize ||
    option.sizePrices ||
    option.pricingBySize ||
    option.sizePricing;

  if (isRecord(directPrices)) {
    Object.entries(directPrices).forEach(([key, value]) => {
      output[key] = cleanNumber(value);
      output[slugify(key)] = cleanNumber(value);
    });
  }

  if (Array.isArray(directPrices)) {
    directPrices.forEach((item) => {
      if (!isRecord(item)) return;

      const sizeKey = readString(
        item.sizeId || item.id || item.size || item.name || item.label
      );

      if (!sizeKey) return;

      const price = cleanNumber(item.price || item.amount || item.value);
      output[sizeKey] = price;
      output[slugify(sizeKey)] = price;
    });
  }

  return output;
}

function normalizeSizes(product: ProductLike | null): ProductSize[] {
  const rawSizes = readArray(product?.sizes);

  if (rawSizes.length > 0) {
    return rawSizes
      .map((rawSize: unknown, index: number): ProductSize => {
        const size = isRecord(rawSize) ? rawSize : {};

        const label = readString(
          size.label || size.name || size.size || size.title,
          "Regular"
        );

        return {
          id: readString(size.id || size.sizeId || slugify(label), `size-${index}`),
          name: readString(size.name || size.label || label, label),
          label,
          price: cleanNumber(
            size.price || size.amount || product?.numericPrice || product?.price
          ),
          sortOrder: cleanNumber(size.sortOrder ?? index),
        };
      })
      .sort((a: ProductSize, b: ProductSize) => a.sortOrder - b.sortOrder);
  }

  const fallbackPrice = cleanNumber(product?.numericPrice || product?.price);

  return [
    {
      id: "regular",
      name: "Regular",
      label: "Regular",
      price: fallbackPrice,
      sortOrder: 0,
    },
  ];
}


function getModifierRequirement(group: ModifierGroup, selectedCount = 0) {
  const rawMinSelect = cleanNumber(group.minSelect);
  const rawMaxSelect = cleanNumber(group.maxSelect);
  const isRequired = group.required || rawMinSelect > 0;
  const minRequired = isRequired ? Math.max(1, rawMinSelect) : 0;

  // If admin marked the group required but forgot maxSelect, treat single-required
  // groups like radio groups so users cannot choose multiple cheeses/sizes by mistake.
  const maxSelect = rawMaxSelect > 0 ? rawMaxSelect : isRequired && minRequired === 1 ? 1 : 0;
  const isSatisfied = !isRequired || selectedCount >= minRequired;
  const remaining = Math.max(minRequired - selectedCount, 0);

  return {
    isRequired,
    minRequired,
    maxSelect,
    isSatisfied,
    remaining,
  };
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "bg-[#27ae60] text-white"
      : tone === "danger"
        ? "bg-[#ee5b64] text-white"
        : "bg-white text-zinc-500 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400";

  return (
    <span
      className={`inline-flex min-w-[74px] items-center justify-center rounded-full px-3 py-1 text-[10px] font-black uppercase leading-none ${toneClass}`}
    >
      {label}
    </span>
  );
}

function normalizeModifierGroups(product: ProductLike | null): ModifierGroup[] {
  const rawGroups =
    readArray(product?.modifierGroups).length > 0
      ? readArray(product?.modifierGroups)
      : readArray(product?.attachedModifierGroups);

  return rawGroups
    .filter((rawGroup: unknown) => isRecord(rawGroup))
    .map((rawGroup: unknown, groupIndex: number): ModifierGroup => {
      const group = rawGroup as AnyRecord;

      const groupName = readString(group.name || group.title, "Options");

      const rawOptions =
        readArray(group.options).length > 0
          ? readArray(group.options)
          : readArray(group.modifierOptions);

      const normalizedOptions = rawOptions
        .filter((rawOption: unknown) => isRecord(rawOption))
        .map((rawOption: unknown, optionIndex: number): ModifierOption => {
          const option = rawOption as AnyRecord;
          const optionName = readString(option.name || option.title, "Option");

          return {
            id: readString(
              option.id || option.optionId || slugify(optionName),
              `option-${optionIndex}`
            ),
            optionId: readString(
              option.optionId || option.id || slugify(optionName),
              `option-${optionIndex}`
            ),
            name: optionName,
            status: readString(option.status, "Active"),
            price: cleanNumber(option.price || option.amount || option.extraPrice),
            pricesBySize: readPricesBySize(option),
            sortOrder: cleanNumber(option.sortOrder ?? optionIndex),
          };
        })
        .filter((option: ModifierOption) => option.status !== "Inactive")
        .sort((a: ModifierOption, b: ModifierOption) => a.sortOrder - b.sortOrder);

      const minSelect = cleanNumber(
        group.minSelect ?? group.min ?? group.minimum ?? group.minRequired ?? 0
      );

      const maxSelect = cleanNumber(
        group.maxSelect ?? group.max ?? group.maximum ?? group.maxAllowed ?? 0
      );

      const required = readBoolean(group.required, minSelect > 0);

      return {
        id: readString(
          group.id || group.modifierGroupId || slugify(groupName),
          `group-${groupIndex}`
        ),
        modifierGroupId: readString(
          group.modifierGroupId || group.id || slugify(groupName),
          `group-${groupIndex}`
        ),
        name: groupName,
        required,
        minSelect,
        maxSelect,
        sortOrder: cleanNumber(group.sortOrder ?? groupIndex),
        status: readString(group.status, "Active"),
        options: normalizedOptions,
      };
    })
    .filter((group: ModifierGroup) => {
      return group.status !== "Inactive" && group.options.length > 0;
    })
    .sort((a: ModifierGroup, b: ModifierGroup) => a.sortOrder - b.sortOrder);
}

export default function ProductModal({
  product,
  isOpen,
  onClose,
}: ProductModalProps) {
  const addItem = useCartStore((state) => state.addItem);

  const sizes = useMemo<ProductSize[]>(() => {
    return normalizeSizes(product);
  }, [product]);

  const modifierGroups = useMemo<ModifierGroup[]>(() => {
    return normalizeModifierGroups(product);
  }, [product]);

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [selectedModifierSides, setSelectedModifierSides] = useState<
    Record<string, ToppingSide>
  >({});
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isOpen || !product) return;

    setQuantity(1);
    setNote("");
    setFormError("");
    setSelectedModifiers({});
    setSelectedModifierSides({});
    setSelectedSize(sizes[0] || null);
  }, [isOpen, product, sizes]);

  const activeSize = selectedSize || sizes[0] || null;

  const selectedModifierDetails = useMemo<SelectedModifierDetail[]>(() => {
    const details: SelectedModifierDetail[] = [];

    modifierGroups.forEach((group: ModifierGroup) => {
      const selectedOptionIds = selectedModifiers[group.id] || [];
      const pizzaToppingGroup = isPizzaToppingGroup(product, group);

      group.options.forEach((option: ModifierOption) => {
        if (!selectedOptionIds.includes(option.optionId)) return;

        const sideKey = getModifierSideKey(group, option);

        details.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.optionId,
          optionName: option.name,
          price: getOptionPrice(option, activeSize),
          side: pizzaToppingGroup ? selectedModifierSides[sideKey] || "whole" : "whole",
          isPizzaTopping: pizzaToppingGroup,
        });
      });
    });

    return details;
  }, [modifierGroups, selectedModifiers, selectedModifierSides, activeSize, product]);

  const unitPrice = useMemo(() => {
    const basePrice = cleanNumber(activeSize?.price);

    const modifierTotal = selectedModifierDetails.reduce(
      (total: number, item: SelectedModifierDetail) => {
        return total + cleanNumber(item.price);
      },
      0
    );

    return basePrice + modifierTotal;
  }, [activeSize, selectedModifierDetails]);

  const totalPrice = (unitPrice * quantity).toFixed(2);

  function handleModifierToggle(group: ModifierGroup, option: ModifierOption) {
    const currentSelected = selectedModifiers[group.id] || [];
    const requirement = getModifierRequirement(group, currentSelected.length);
    const maxSelect = requirement.maxSelect;
    const inputType = maxSelect === 1 ? "radio" : "checkbox";
    const alreadySelected = currentSelected.includes(option.optionId);

    if (
      !alreadySelected &&
      inputType === "checkbox" &&
      maxSelect > 0 &&
      currentSelected.length >= maxSelect
    ) {
      setFormError(`You can select maximum ${maxSelect} from ${group.name}.`);
      return;
    }

    setFormError("");

    setSelectedModifiers((current: Record<string, string[]>) => {
      const groupSelected = current[group.id] || [];
      const isAlreadySelected = groupSelected.includes(option.optionId);

      if (isAlreadySelected) {
        return {
          ...current,
          [group.id]: groupSelected.filter((id: string) => id !== option.optionId),
        };
      }

      if (maxSelect === 1) {
        return {
          ...current,
          [group.id]: [option.optionId],
        };
      }

      return {
        ...current,
        [group.id]: [...groupSelected, option.optionId],
      };
    });

    setSelectedModifierSides((current) => {
      const next = { ...current };
      const sideKey = getModifierSideKey(group, option);
      const pizzaToppingGroup = isPizzaToppingGroup(product, group);

      if (maxSelect === 1) {
        group.options.forEach((groupOption) => {
          delete next[getModifierSideKey(group, groupOption)];
        });
      }

      if (alreadySelected) {
        delete next[sideKey];
        return next;
      }

      if (pizzaToppingGroup) {
        next[sideKey] = current[sideKey] || "whole";
      }

      return next;
    });
  }

  function handleToppingSideChange(
    group: ModifierGroup,
    option: ModifierOption,
    side: ToppingSide
  ) {
    const sideKey = getModifierSideKey(group, option);

    setSelectedModifierSides((current) => ({
      ...current,
      [sideKey]: side,
    }));
  }

  const firstMissingRequiredGroup = useMemo(() => {
    return modifierGroups.find((group: ModifierGroup) => {
      const selectedCount = selectedModifiers[group.id]?.length || 0;
      return !getModifierRequirement(group, selectedCount).isSatisfied;
    });
  }, [modifierGroups, selectedModifiers]);

  const isOrderDisabled = Boolean(!product || !activeSize || firstMissingRequiredGroup);

  function validateRequiredModifiers() {
    for (const group of modifierGroups) {
      const selectedCount = selectedModifiers[group.id]?.length || 0;
      const requirement = getModifierRequirement(group, selectedCount);

      if (!requirement.isSatisfied) {
        setFormError(
          `Please select at least ${requirement.minRequired} from ${group.name}.`
        );
        return false;
      }

      if (requirement.maxSelect > 0 && selectedCount > requirement.maxSelect) {
        setFormError(`Please select maximum ${requirement.maxSelect} from ${group.name}.`);
        return false;
      }
    }

    setFormError("");
    return true;
  }

  function handleAddToCart() {
    if (!product || !activeSize) return;

    if (isOrderDisabled) {
      if (firstMissingRequiredGroup) {
        const selectedCount = selectedModifiers[firstMissingRequiredGroup.id]?.length || 0;
        const requirement = getModifierRequirement(
          firstMissingRequiredGroup,
          selectedCount
        );

        setFormError(
          `Please select at least ${requirement.minRequired} from ${firstMissingRequiredGroup.name}.`
        );
      }

      return;
    }

    if (!validateRequiredModifiers()) return;

    const productId = getProductId(product);
    const title = readString(product.title || product.name, "Product");
    const image = readString(product.image, FALLBACK_IMAGE);
    const category = readString(product.category || product.categorySlug);

    const modifierKey = selectedModifierDetails
      .map((item: SelectedModifierDetail) => {
        return `${item.groupId}:${item.optionId}:${item.price}:${item.side}`;
      })
      .sort()
      .join("|");

    const legacyToppings = selectedModifierDetails.reduce<Record<string, string>>(
      (acc: Record<string, string>, item: SelectedModifierDetail) => {
        acc[`${item.groupName}: ${item.optionName}`] = item.side || "whole";
        return acc;
      },
      {}
    );

    const itemToAdd = {
      cartId: `${productId}-${getSizeId(activeSize)}-${modifierKey}-${Date.now()}`,
      id: productId,
      category,
      title,
      image,
      price: unitPrice,
      quantity,
      size: {
        id: getSizeId(activeSize),
        name: activeSize.name,
        label: getSizeLabel(activeSize),
        price: cleanNumber(activeSize.price),
      },

      toppings: legacyToppings,
      sauces: [],

      modifiers: selectedModifierDetails,
      modifierGroups: selectedModifierDetails,
      note,
    } as CartItem & {
      modifiers: SelectedModifierDetail[];
      modifierGroups: SelectedModifierDetail[];
      note: string;
    };

    addItem(itemToAdd);
    onClose();
  }

  if (!isOpen || !product) return null;

  const title = readString(product.title || product.name, "Product");
  const image = readString(product.image, FALLBACK_IMAGE);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#121212] w-full max-w-lg h-full md:h-auto md:rounded-3xl overflow-hidden md:max-h-[92vh] flex flex-col shadow-2xl relative text-black dark:text-white">
        <div className="flex items-center justify-between p-5 border-b dark:border-zinc-800 bg-white dark:bg-[#121212] sticky top-0 z-10">
          <h2 className="text-xl font-black uppercase tracking-tight">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-black text-white rounded-full hover:scale-110 transition-transform"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-grow p-0 no-scrollbar">
          <div className="relative w-full aspect-[16/10]">
            <Image src={image} alt={title} fill className="object-cover" />
          </div>

          <div className="p-6 space-y-10">
            {product.description && (
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                {product.description}
              </p>
            )}

            <section className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900/80">
              <div className="flex items-center justify-between gap-4 mb-3">
                <h3 className="font-black uppercase text-sm tracking-widest">
                  Choose Size
                </h3>

                <StatusBadge label="Selected ✓" tone="success" />
              </div>

              <div className="space-y-2">
                {sizes.map((size: ProductSize) => {
                  const sizeLabel = getSizeLabel(size);
                  const sizeId = getSizeId(size);
                  const isSelected = activeSize
                    ? getSizeId(activeSize) === sizeId
                    : false;

                  return (
                    <label
                      key={sizeId}
                      className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#2f80ed] bg-white shadow-sm ring-1 ring-[#2f80ed] dark:bg-black"
                          : "border-transparent bg-white/70 hover:bg-white dark:bg-black/40 dark:hover:bg-black"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="size"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedSize(size);
                            setFormError("");
                          }}
                          className="w-5 h-5 accent-black"
                        />

                        <span className="font-black text-sm">{sizeLabel}</span>
                      </div>

                      <span className="font-black text-sm">
                        ${cleanNumber(size.price).toFixed(2)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {modifierGroups.map((group: ModifierGroup) => {
              const selectedCount = selectedModifiers[group.id]?.length || 0;
              const requirement = getModifierRequirement(group, selectedCount);
              const minRequired = requirement.minRequired;
              const maxSelect = requirement.maxSelect;
              const isRequired = requirement.isRequired;
              const isSatisfied = requirement.isSatisfied;
              const inputType = maxSelect === 1 ? "radio" : "checkbox";
              const pizzaToppingGroup = isPizzaToppingGroup(product, group);
              const badgeLabel = isRequired
                ? isSatisfied
                  ? "Selected ✓"
                  : `Choose ${requirement.remaining || minRequired}`
                : "Optional";
              const badgeTone = isRequired
                ? isSatisfied
                  ? "success"
                  : "danger"
                : "neutral";

              return (
                <section
                  key={group.id}
                  className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900/80"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-black uppercase text-sm tracking-widest">
                        {group.name}
                      </h3>

                      <p className="text-[11px] text-zinc-500 mt-1 leading-tight">
                        {isRequired && `Select at least ${minRequired}`}
                        {isRequired && maxSelect > 0 && " · "}
                        {maxSelect > 0 && `Select up to ${maxSelect}`}
                        {!isRequired && maxSelect === 0 && "Optional"}
                      </p>
                    </div>

                    <StatusBadge label={badgeLabel} tone={badgeTone} />
                  </div>

                  <div className="space-y-2">
                    {group.options.map((option: ModifierOption) => {
                      const optionPrice = getOptionPrice(option, activeSize);
                      const selectedIds = selectedModifiers[group.id] || [];
                      const isSelected = selectedIds.includes(option.optionId);
                      const sideKey = getModifierSideKey(group, option);
                      const selectedSide = selectedModifierSides[sideKey] || "whole";
                      const reachedLimit =
                        inputType === "checkbox" &&
                        maxSelect > 0 &&
                        !isSelected &&
                        selectedCount >= maxSelect;

                      return (
                        <div
                          key={option.optionId}
                          className={`rounded-xl border transition-all ${
                            isSelected
                              ? "border-[#2f80ed] bg-white shadow-sm ring-1 ring-[#2f80ed] dark:bg-black"
                              : reachedLimit
                                ? "border-transparent bg-white/40 opacity-60 dark:bg-black/30"
                                : "border-transparent bg-white/70 hover:bg-white dark:bg-black/40 dark:hover:bg-black"
                          }`}
                        >
                          <label
                            className={`flex items-center justify-between gap-3 p-3.5 ${
                              reachedLimit ? "cursor-not-allowed" : "cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type={inputType}
                                name={group.id}
                                checked={isSelected}
                                disabled={reachedLimit}
                                onChange={() => handleModifierToggle(group, option)}
                                className="w-5 h-5 accent-black rounded"
                              />

                              <span className="text-sm font-bold leading-tight">
                                {option.name}
                              </span>
                            </div>

                            <span className="text-sm font-black text-zinc-500 min-w-[64px] text-right">
                              {optionPrice > 0
                                ? `+$${optionPrice.toFixed(2)}`
                                : ""}
                            </span>
                          </label>

                          {pizzaToppingGroup && isSelected && (
                            <div className="mb-3 ml-11 flex w-fit flex-wrap items-center rounded-full bg-zinc-100 dark:bg-zinc-900 p-1 shadow-sm">
                              {[
                                { value: "left" as ToppingSide, label: "Left Half" },
                                { value: "right" as ToppingSide, label: "Right Half" },
                                { value: "whole" as ToppingSide, label: "Whole" },
                              ].map((side) => {
                                const active = selectedSide === side.value;

                                return (
                                  <button
                                    key={side.value}
                                    type="button"
                                    onClick={() =>
                                      handleToppingSideChange(group, option, side.value)
                                    }
                                    className={`flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-black transition-all ${
                                      active
                                        ? "bg-[#1a1a1a] text-white shadow-md"
                                        : "text-zinc-600 hover:text-black dark:text-zinc-300 dark:hover:text-white"
                                    }`}
                                  >
                                    <span
                                      className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                        active
                                          ? "border-white"
                                          : "border-zinc-500 dark:border-zinc-400"
                                      }`}
                                    >
                                      {side.value === "left" && (
                                        <span
                                          className={`block h-3 w-1.5 rounded-l-full ${
                                            active ? "bg-white" : "bg-zinc-700"
                                          }`}
                                        />
                                      )}

                                      {side.value === "right" && (
                                        <span
                                          className={`block h-3 w-1.5 rounded-r-full ml-1.5 ${
                                            active ? "bg-white" : "bg-zinc-700"
                                          }`}
                                        />
                                      )}

                                      {side.value === "whole" && (
                                        <span
                                          className={`block h-2 w-2 rounded-full ${
                                            active ? "bg-white" : "bg-zinc-700"
                                          }`}
                                        />
                                      )}
                                    </span>

                                    {side.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isRequired && !isSatisfied && (
                    <p className="text-[11px] font-semibold text-red-500 mt-2">
                      Required: choose {requirement.remaining || minRequired} more
                    </p>
                  )}
                </section>
              );
            })}

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600">
                {formError}
              </div>
            )}

            <section className="pb-6">
              <h3 className="font-black uppercase text-sm tracking-widest mb-4">
                Special Instructions
              </h3>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add special instructions..."
                className="w-full h-20 p-3 border dark:border-zinc-800 rounded-lg bg-transparent outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all resize-none text-sm"
              />

              <p className="text-[11px] text-zinc-500 leading-tight mt-2">
                *Requests may result in upcharges
              </p>
            </section>
          </div>
        </div>

        <div className="p-5 border-t dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-4">
          {isOrderDisabled && firstMissingRequiredGroup && (
            <p className="text-[11px] font-bold text-red-500 text-center">
              Please complete {firstMissingRequiredGroup.name} before adding to order.
            </p>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center bg-white dark:bg-black rounded-full p-1 border dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Minus size={18} />
              </button>

              <span className="w-10 text-center font-black text-lg">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => setQuantity((current) => current + 1)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Plus size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isOrderDisabled}
              className={`flex-grow h-12 rounded-xl flex items-center justify-between px-6 transition-all ${
                isOrderDisabled
                  ? "cursor-not-allowed bg-zinc-300 text-zinc-500 shadow-none dark:bg-zinc-800 dark:text-zinc-500"
                  : "bg-[#1a1a1a] dark:bg-white dark:text-black text-white hover:scale-[1.01] active:scale-95 shadow-lg"
              }`}
            >
              <span className="font-black uppercase tracking-tighter text-xs">
                {isOrderDisabled ? "Complete Required" : "Add to Order"}
              </span>

              <span className="font-black text-lg">${totalPrice}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}