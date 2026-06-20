"use client";

import { useState } from "react";
import type {
  ModifierGroup,
  ModifierGroupAssignment,
  ModifierOption,
} from "../types";
import { ActionButtons, EmptyBox } from "./ui";
import Pagination from "@/components/pagination";

type StoreItem = {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
};

type MongoModifierGroup = ModifierGroup & {
  _id?: string;
  id?: string;
};

type MongoObject = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
};

const ASSIGNMENT_PREVIEW_LIMIT = 3;
const OPTION_PREVIEW_LIMIT = 5;
const PAGE_SIZE = 12;

function getModifierId(group: MongoModifierGroup) {
  return String(group._id || group.id || "").trim();
}

function getModifierKey(group: MongoModifierGroup, fallback: string) {
  return getModifierId(group) || String(group.slug || group.name || fallback);
}

function getStoreValue(store: StoreItem) {
  return String(store.slug || store._id || store.id || store.name || "").trim();
}

function getStoreAliases(store: StoreItem) {
  return [store.slug, store._id, store.id, store.name, getStoreValue(store)]
    .filter(Boolean)
    .map((item) => String(item).trim());
}

function getStoreName(stores: StoreItem[], storeId: string) {
  const cleanStoreId = String(storeId || "").trim();

  if (!cleanStoreId) return "No Store";

  const foundStore = stores.find((store) => {
    return getStoreAliases(store).includes(cleanStoreId);
  });

  return foundStore?.name || cleanStoreId;
}

function getOptionName(option: unknown) {
  if (!option) return "";

  if (typeof option === "string" || typeof option === "number") {
    return String(option);
  }

  if (typeof option === "object") {
    const obj = option as ModifierOption;
    return obj.name || "Option";
  }

  return "";
}

function normalizeAssignment(assignment: unknown): ModifierGroupAssignment | null {
  if (!assignment || typeof assignment !== "object") return null;

  const obj = assignment as ModifierGroupAssignment & MongoObject;

  const storeId = String(obj.storeId || "").trim();
  const categoryId = String(obj.categoryId || "").trim();
  const categoryName = String(obj.categoryName || "").trim();

  if (!storeId || !categoryId || !categoryName) return null;

  return {
    ...obj,
    id: String(obj._id || obj.id || ""),
    storeId,
    categoryId,
    categoryName,
    status: obj.status === "Inactive" ? "Inactive" : "Active",
  };
}

function StatusBadge({ status }: { status?: string }) {
  const inactive = status === "Inactive";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${
        inactive ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
      }`}
    >
      {inactive ? "Inactive" : "Active"}
    </span>
  );
}

function RequiredBadge({ required }: { required?: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${
        required ? "bg-green-800 text-white" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {required ? "Required" : "Optional"}
    </span>
  );
}

export default function ModifierGrid({
  modifierGroups,
  stores = [],
  onEdit,
  onDelete,
}: {
  modifierGroups: ModifierGroup[];
  stores?: StoreItem[];
  onEdit: (modifier: ModifierGroup) => void;
  onDelete: (id: string) => void;
}) {
  const safeModifierGroups = Array.isArray(modifierGroups)
    ? (modifierGroups as MongoModifierGroup[])
    : [];

  const [currentPage, setCurrentPage] = useState(1);

  const totalGroups = safeModifierGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedGroups = safeModifierGroups.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  if (!totalGroups) {
    return <EmptyBox message="No modifier groups found." />;
  }

  return (
    <div className="overflow-hidden rounded-[26px] border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-zinc-950">
              Modifier Groups
            </h3>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              Compact table view for store/category links and options.
            </p>
          </div>

          <span className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-black text-zinc-700">
            {totalGroups} group
            {totalGroups === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-black uppercase tracking-wide text-zinc-500">
              <th className="px-5 py-4">Modifier Group</th>
              <th className="px-5 py-4">Store / Category Links</th>
              <th className="px-5 py-4">Options</th>
              <th className="px-5 py-4">Required</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {paginatedGroups.map((group, index) => {
              const groupId = getModifierId(group);
              const groupKey = getModifierKey(group, `${group.name}-${index}`);

              const options = Array.isArray(group.options)
                ? group.options.map((option) => getOptionName(option)).filter(Boolean)
                : [];

              const assignments = Array.isArray(group.assignments)
                ? (group.assignments
                    .map((assignment) => normalizeAssignment(assignment))
                    .filter(Boolean) as ModifierGroupAssignment[])
                : [];

              const previewOptions = options.slice(0, OPTION_PREVIEW_LIMIT);
              const hiddenOptionsCount = Math.max(
                options.length - OPTION_PREVIEW_LIMIT,
                0
              );

              const previewAssignments = assignments.slice(
                0,
                ASSIGNMENT_PREVIEW_LIMIT
              );
              const hiddenAssignmentsCount = Math.max(
                assignments.length - ASSIGNMENT_PREVIEW_LIMIT,
                0
              );

              return (
                <tr key={groupKey} className="align-top hover:bg-zinc-50/60">
                  <td className="px-5 py-5">
                    <div className="min-w-[220px]">
                      <p className="font-black text-zinc-950">{group.name}</p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-black text-zinc-600">
                          {options.length} option
                          {options.length === 1 ? "" : "s"}
                        </span>

                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-black text-zinc-600">
                          {assignments.length} link
                          {assignments.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    <div className="min-w-[300px]">
                      {assignments.length ? (
                        <div className="space-y-2">
                          {previewAssignments.map(
                            (assignment, assignmentIndex) => (
                              <div
                                key={`${groupKey}-assignment-preview-${
                                  assignment.id || assignmentIndex
                                }`}
                                className="rounded-2xl border border-zinc-200 bg-white px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-zinc-900">
                                      {getStoreName(stores, assignment.storeId)}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs font-bold text-zinc-500">
                                      {assignment.categoryName}
                                    </p>
                                  </div>

                                  <StatusBadge status={assignment.status} />
                                </div>
                              </div>
                            )
                          )}

                          {hiddenAssignmentsCount > 0 ? (
                            <details className="group">
                              <summary className="cursor-pointer list-none text-xs font-black text-green-700">
                                View {hiddenAssignmentsCount} more link
                                {hiddenAssignmentsCount === 1 ? "" : "s"}
                              </summary>

                              <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                                {assignments
                                  .slice(ASSIGNMENT_PREVIEW_LIMIT)
                                  .map((assignment, assignmentIndex) => (
                                    <div
                                      key={`${groupKey}-assignment-hidden-${
                                        assignment.id || assignmentIndex
                                      }`}
                                      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-black text-zinc-900">
                                            {getStoreName(
                                              stores,
                                              assignment.storeId
                                            )}
                                          </p>
                                          <p className="mt-0.5 truncate text-xs font-bold text-zinc-500">
                                            {assignment.categoryName}
                                          </p>
                                        </div>

                                        <StatusBadge status={assignment.status} />
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </details>
                          ) : null}
                        </div>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-500">
                          No links
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    <div className="min-w-[320px] max-w-[420px]">
                      {options.length ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {previewOptions.map((optionName, optionIndex) => (
                              <span
                                key={`${groupKey}-option-preview-${optionIndex}-${optionName}`}
                                className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-700"
                              >
                                {optionName}
                              </span>
                            ))}

                            {hiddenOptionsCount > 0 ? (
                              <span className="rounded-full bg-green-50 px-3 py-2 text-xs font-black text-green-700">
                                +{hiddenOptionsCount} more
                              </span>
                            ) : null}
                          </div>

                          {hiddenOptionsCount > 0 ? (
                            <details>
                              <summary className="cursor-pointer list-none text-xs font-black text-green-700">
                                View all options
                              </summary>

                              <div className="mt-2 max-h-36 overflow-y-auto rounded-2xl border border-zinc-100 bg-white p-3">
                                <div className="flex flex-wrap gap-2">
                                  {options.map((optionName, optionIndex) => (
                                    <span
                                      key={`${groupKey}-option-all-${optionIndex}-${optionName}`}
                                      className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-700"
                                    >
                                      {optionName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </details>
                          ) : null}
                        </div>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-500">
                          No options
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    <RequiredBadge required={Boolean(group.required)} />
                  </td>

                  <td className="px-5 py-5">
                    <StatusBadge status={group.status || "Active"} />
                  </td>

                  <td className="px-5 py-5 text-right">
                    <ActionButtons
                      onEdit={() => onEdit(group)}
                      onDelete={() => {
                        if (!groupId) {
                          alert(
                            "Modifier group ID missing. Please refresh and try again."
                          );
                          return;
                        }

                        const confirmed = window.confirm(
                          "This will delete the global modifier group and all store/category assignments. Continue?"
                        );

                        if (!confirmed) return;

                        onDelete(groupId);
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={totalGroups}
        pageSize={PAGE_SIZE}
        itemLabel="modifier groups"
        onPageChange={setCurrentPage}
      />
    </div>
  );
}