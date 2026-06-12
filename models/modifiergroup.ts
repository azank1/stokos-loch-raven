import mongoose, { Schema } from "mongoose";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function cleanOptions(values: unknown) {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();

  return values
    .map((item, index) => {
      if (typeof item === "string" || typeof item === "number") {
        const name = String(item || "").trim();
        if (!name) return null;

        const id = slugify(name) || `option-${index + 1}`;
        const key = id.toLowerCase();

        if (seen.has(key)) return null;
        seen.add(key);

        return {
          id,
          name,
          status: "Active",
        };
      }

      if (!item || typeof item !== "object") return null;

      const option = item as {
        id?: unknown;
        name?: unknown;
        label?: unknown;
        title?: unknown;
        value?: unknown;
        status?: unknown;
      };

      const name = String(
        option.name || option.label || option.title || option.value || ""
      ).trim();

      if (!name) return null;

      const id = String(option.id || slugify(name) || `option-${index + 1}`);
      const key = id.toLowerCase();

      if (seen.has(key)) return null;
      seen.add(key);

      return {
        id,
        name,
        status: option.status === "Inactive" ? "Inactive" : "Active",
      };
    })
    .filter(Boolean);
}

const ModifierOptionSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { _id: false }
);

const ModifierGroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    // Global options only.
    // Store/category assignment is stored in modifiergroupassignments.
    // Option prices are handled later inside ProductForm.
    options: {
      type: [ModifierOptionSchema],
      default: [],
    },

    required: {
      type: Boolean,
      default: false,
    },

    minSelect: {
      type: Number,
      default: 0,
    },

    maxSelect: {
      type: Number,
      default: 0,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "modifiergroups",
  }
);

ModifierGroupSchema.pre("validate", function () {
  const doc = this as any;

  doc.name = String(doc.name || "").trim();
  doc.options = cleanOptions(doc.options);

  doc.required = Boolean(doc.required);
  doc.minSelect = cleanNumber(doc.minSelect);
  doc.maxSelect = cleanNumber(doc.maxSelect);
  doc.sortOrder = cleanNumber(doc.sortOrder);
  doc.status = doc.status === "Inactive" ? "Inactive" : "Active";

  doc.slug = slugify(doc.slug || doc.name || `modifier-group-${Date.now()}`);
});

ModifierGroupSchema.index({ name: 1 });

const ModifierGroup =
  mongoose.models.ModifierGroup ||
  mongoose.model("ModifierGroup", ModifierGroupSchema);

export default ModifierGroup;
