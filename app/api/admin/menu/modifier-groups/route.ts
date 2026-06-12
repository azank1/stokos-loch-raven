import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import ModifierGroup from "@/models/modifiergroup";
import ModifierGroupAssignment, {
  ALL_CATEGORIES_ID,
  ALL_CATEGORIES_NAME,
} from "@/models/modifiergroupassignment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyObject = Record<string, any>;

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (["true", "yes", "1", "active", "required"].includes(lower)) return true;
    if (["false", "no", "0", "inactive", "off"].includes(lower)) return false;
  }

  return fallback;
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isObjectId(value: unknown) {
  return mongoose.Types.ObjectId.isValid(cleanString(value));
}

function getRecordId(value: unknown) {
  if (!value || typeof value !== "object") return "";

  const obj = value as AnyObject;
  return cleanString(obj._id || obj.id || obj.modifierGroupId);
}

function normalizeOption(option: unknown, index: number) {
  if (typeof option === "string" || typeof option === "number") {
    const name = cleanString(option);
    if (!name) return null;

    return {
      id: slugify(name) || `option-${index + 1}`,
      name,
      status: "Active",
    };
  }

  if (!option || typeof option !== "object") return null;

  const obj = option as AnyObject;
  const name = cleanString(obj.name || obj.label || obj.title || obj.value);

  if (!name) return null;

  return {
    id: cleanString(obj.id) || slugify(name) || `option-${index + 1}`,
    name,
    status: obj.status === "Inactive" ? "Inactive" : "Active",
  };
}

function normalizeOptions(value: unknown) {
  const seen = new Set<string>();
  const rawOptions = Array.isArray(value) ? value : [];

  return rawOptions
    .map((option, index) => normalizeOption(option, index))
    .filter(Boolean)
    .filter((option: any) => {
      const key = cleanString(option.id || option.name).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isAllCategoryValue(value: unknown) {
  const raw = cleanString(value).toLowerCase();
  const slug = slugify(raw);

  return ["all", "all-categories", "all-category", "every-category", "any-category", "*"].includes(raw) ||
    ["all", "all-categories", "all-category", "every-category", "any-category"].includes(slug);
}

function normalizeAssignment(assignment: unknown, modifierGroupId: string, index: number) {
  if (!assignment || typeof assignment !== "object") return null;

  const obj = assignment as AnyObject;
  const storeId = cleanString(obj.storeId || obj.storeSlug || obj.store);
  if (!storeId) return null;

  const inputCategoryId = cleanString(obj.categoryId || obj.category || obj.appliesTo);
  const inputCategoryName = cleanString(obj.categoryName || obj.categoryLabel || obj.name);
  const useAllCategory =
    !inputCategoryId ||
    isAllCategoryValue(inputCategoryId) ||
    isAllCategoryValue(inputCategoryName);

  return {
    modifierGroupId,
    storeId,
    categoryId: useAllCategory
      ? ALL_CATEGORIES_ID
      : inputCategoryId || slugify(inputCategoryName),
    categoryName: useAllCategory
      ? ALL_CATEGORIES_NAME
      : inputCategoryName || inputCategoryId,
    sortOrder: cleanNumber(obj.sortOrder ?? index),
    status: obj.status === "Inactive" ? "Inactive" : "Active",
  };
}

function normalizeGroupPayload(body: AnyObject) {
  const raw = body?.data && typeof body.data === "object" ? body.data : body;
  const name = cleanString(raw.name || raw.title);

  return {
    _id: cleanString(raw._id || raw.id),
    name,
    slug: slugify(raw.slug || name),
    options: normalizeOptions(raw.options),
    assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
    required: cleanBoolean(raw.required, false),
    minSelect: cleanNumber(raw.minSelect),
    maxSelect: cleanNumber(raw.maxSelect),
    sortOrder: cleanNumber(raw.sortOrder),
    status: raw.status === "Inactive" ? "Inactive" : "Active",
  };
}

async function getGroupsWithAssignments(query: AnyObject = {}) {
  const groupQuery: AnyObject = {};

  if (query.status) {
    groupQuery.status = query.status;
  }

  if (query.search) {
    const search = cleanString(query.search);
    groupQuery.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  const groupsRaw = await ModifierGroup.find(groupQuery)
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const groups = toPlain(groupsRaw) as AnyObject[];
  const groupIds = groups
    .map((group) => getRecordId(group))
    .filter(Boolean);

  const assignmentsRaw = groupIds.length
    ? await ModifierGroupAssignment.find({ modifierGroupId: { $in: groupIds } })
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean()
    : [];

  const assignments = toPlain(assignmentsRaw) as AnyObject[];
  const assignmentsByGroup = new Map<string, AnyObject[]>();

  assignments.forEach((assignment) => {
    const groupId = cleanString(assignment.modifierGroupId);
    if (!assignmentsByGroup.has(groupId)) assignmentsByGroup.set(groupId, []);
    assignmentsByGroup.get(groupId)?.push(assignment);
  });

  return groups.map((group) => {
    const id = getRecordId(group);

    return {
      ...group,
      id,
      modifierGroupId: id,
      assignments: assignmentsByGroup.get(id) || [],
    };
  });
}

async function replaceAssignments(modifierGroupId: string, assignments: unknown[]) {
  await ModifierGroupAssignment.deleteMany({ modifierGroupId });

  const assignmentMap = new Map<string, AnyObject>();

  assignments
    .map((assignment, index) => normalizeAssignment(assignment, modifierGroupId, index))
    .filter(Boolean)
    .forEach((assignment: any) => {
      const key = `${assignment.modifierGroupId}::${assignment.storeId}::${assignment.categoryId}`;
      assignmentMap.set(key, assignment);
    });

  const cleanAssignments = Array.from(assignmentMap.values());

  if (cleanAssignments.length > 0) {
    await ModifierGroupAssignment.insertMany(cleanAssignments);
  }

  return cleanAssignments;
}

export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const groups = await getGroupsWithAssignments({
      search: searchParams.get("search") || "",
      status: searchParams.get("status") || "",
    });

    return NextResponse.json({
      success: true,
      data: groups,
      modifierGroups: groups,
    });
  } catch (error) {
    console.error("Modifier groups GET error:", error);

    return NextResponse.json(
      {
        success: false,
        data: [],
        modifierGroups: [],
        message: "Failed to load modifier groups",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const payload = normalizeGroupPayload(body);

    if (!payload.name) {
      return NextResponse.json(
        { success: false, message: "Modifier group name required" },
        { status: 400 }
      );
    }

    if (payload.options.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one modifier option is required" },
        { status: 400 }
      );
    }

    const group = await ModifierGroup.create({
      name: payload.name,
      slug: payload.slug,
      options: payload.options,
      required: payload.required,
      minSelect: payload.minSelect,
      maxSelect: payload.maxSelect,
      sortOrder: payload.sortOrder,
      status: payload.status,
    });

    const modifierGroupId = String(group._id);
    await replaceAssignments(modifierGroupId, payload.assignments);

const allGroups = (await getGroupsWithAssignments()) as AnyObject[];

const data = allGroups.find(
  (item) => getRecordId(item) === modifierGroupId
);

    return NextResponse.json({
      success: true,
      data,
      modifierGroup: data,
      message: "Modifier group saved",
    });
  } catch (error: any) {
    console.error("Modifier groups POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.code === 11000
            ? "Modifier group with this name/slug already exists"
            : "Failed to save modifier group",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const payload = normalizeGroupPayload(body);

    if (!payload._id) {
      return NextResponse.json(
        { success: false, message: "Modifier group id required" },
        { status: 400 }
      );
    }

    if (!payload.name) {
      return NextResponse.json(
        { success: false, message: "Modifier group name required" },
        { status: 400 }
      );
    }

    if (payload.options.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one modifier option is required" },
        { status: 400 }
      );
    }

    const query = isObjectId(payload._id)
      ? { _id: new mongoose.Types.ObjectId(payload._id) }
      : { slug: payload._id };

    const group = await ModifierGroup.findOneAndUpdate(
      query,
      {
        name: payload.name,
        slug: payload.slug,
        options: payload.options,
        required: payload.required,
        minSelect: payload.minSelect,
        maxSelect: payload.maxSelect,
        sortOrder: payload.sortOrder,
        status: payload.status,
      },
      { new: true, runValidators: true }
    );

    if (!group) {
      return NextResponse.json(
        { success: false, message: "Modifier group not found" },
        { status: 404 }
      );
    }

    const modifierGroupId = String(group._id);
    await replaceAssignments(modifierGroupId, payload.assignments);

const allGroups = (await getGroupsWithAssignments()) as AnyObject[];

const data = allGroups.find(
  (item) => getRecordId(item) === modifierGroupId
);

    return NextResponse.json({
      success: true,
      data,
      modifierGroup: data,
      message: "Modifier group updated",
    });
  } catch (error: any) {
    console.error("Modifier groups PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.code === 11000
            ? "Modifier group with this name/slug already exists"
            : "Failed to update modifier group",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    let id = cleanString(searchParams.get("id") || searchParams.get("_id"));

    if (!id) {
      try {
        const body = await request.json();
        id = cleanString(body?._id || body?.id || body?.modifierGroupId);
      } catch {}
    }

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Modifier group id required" },
        { status: 400 }
      );
    }

    const query = isObjectId(id)
      ? { _id: new mongoose.Types.ObjectId(id) }
      : { slug: id };

    const group = await ModifierGroup.findOneAndDelete(query);

    if (group?._id) {
      await ModifierGroupAssignment.deleteMany({ modifierGroupId: String(group._id) });
    }

    return NextResponse.json({
      success: true,
      message: "Modifier group deleted",
    });
  } catch (error) {
    console.error("Modifier groups DELETE error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to delete modifier group" },
      { status: 500 }
    );
  }
}
