import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { STORES } from "@/lib/data/stores";
import { rebuildStoreMenu } from "@/lib/server/storemenu-rebuilder";
import { clearStoreMenuSnapshotCache } from "@/lib/server/storemenu-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanStoreSlug(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getStaticStoreSlugs() {
  return (Array.isArray(STORES) ? STORES : [])
    .map((store) => cleanStoreSlug(store?.slug))
    .filter(Boolean);
}

function splitSlugList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(cleanStoreSlug).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map(cleanStoreSlug)
    .filter(Boolean);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function safeRevalidateTag(tag: string) {
  try {
    (revalidateTag as any)(tag, "max");
  } catch {
    try {
      (revalidateTag as any)(tag);
    } catch {
      // Ignore revalidation errors in local/dev runtime.
    }
  }
}

function revalidateStore(storeSlug: string) {
  const slug = cleanStoreSlug(storeSlug);
  if (!slug) return;

  clearStoreMenuSnapshotCache(slug);

  safeRevalidateTag("store-menu");
  safeRevalidateTag("store-menu-categories");
  safeRevalidateTag("store-menu-products");
  safeRevalidateTag("store-menu-snapshot");
  safeRevalidateTag(`store-menu-snapshot:${slug}`);

  revalidatePath(`/store/${slug}`);
}

function resolveRequestedStoreSlugs(input: unknown) {
  const slugs = splitSlugList(input);
  const wantsAll = !slugs.length || slugs.includes("all") || slugs.includes("*");

  if (wantsAll) {
    return uniqueValues(getStaticStoreSlugs());
  }

  return uniqueValues(slugs);
}

async function rebuildRequestedStores(storeSlugs: string[], includeData = false) {
  const results: any[] = [];

  for (const storeSlug of storeSlugs) {
    try {
      revalidateStore(storeSlug);

      const snapshot = await rebuildStoreMenu(storeSlug, "manual-api-rebuild");

      revalidateStore(storeSlug);

      results.push({
        success: true,
        storeSlug,
        status: snapshot.status,
        productCount: snapshot.products?.length || 0,
        categoryCount: snapshot.categories?.length || 0,
        version: snapshot.version,
        builtAt: snapshot.builtAt,
        ...(includeData ? { data: snapshot } : {}),
      });
    } catch (error: any) {
      revalidateStore(storeSlug);

      results.push({
        success: false,
        storeSlug,
        message: error?.message || "Failed to rebuild store menu snapshot",
      });
    }
  }

  return results;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const requestedSlug =
      searchParams.get("storeSlug") ||
      searchParams.get("slug") ||
      searchParams.get("storeSlugs") ||
      "all";

    const includeData = searchParams.get("includeData") === "true";
    const storeSlugs = resolveRequestedStoreSlugs(requestedSlug);

    if (!storeSlugs.length) {
      return NextResponse.json(
        {
          success: false,
          message: "No store slugs found to rebuild.",
        },
        { status: 400 }
      );
    }

    const results = await rebuildRequestedStores(storeSlugs, includeData);
    const failed = results.filter((result) => !result.success);
    const rebuilt = results.length - failed.length;

    return NextResponse.json(
      {
        success: rebuilt > 0,
        message: failed.length
          ? `${rebuilt} store menu snapshot(s) rebuilt, ${failed.length} failed.`
          : `${rebuilt} store menu snapshot(s) rebuilt successfully.`,
        correctUrl: "/api/admin/menu/storemenus/rebuild",
        storeSlugs,
        rebuilt,
        failed: failed.length,
        results,
      },
      { status: rebuilt > 0 ? 200 : 500 }
    );
  } catch (error: any) {
    console.error("STORE MENU REBUILD API GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to rebuild store menu snapshot",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const requestedSlug = body.storeSlugs || body.storeSlug || body.slug || "all";
    const includeData = body.includeData === true;
    const storeSlugs = resolveRequestedStoreSlugs(requestedSlug);

    if (!storeSlugs.length) {
      return NextResponse.json(
        {
          success: false,
          message: "No store slugs found to rebuild.",
        },
        { status: 400 }
      );
    }

    const results = await rebuildRequestedStores(storeSlugs, includeData);
    const failed = results.filter((result) => !result.success);
    const rebuilt = results.length - failed.length;

    return NextResponse.json(
      {
        success: rebuilt > 0,
        message: failed.length
          ? `${rebuilt} store menu snapshot(s) rebuilt, ${failed.length} failed.`
          : `${rebuilt} store menu snapshot(s) rebuilt successfully.`,
        correctUrl: "/api/admin/menu/storemenus/rebuild",
        storeSlugs,
        rebuilt,
        failed: failed.length,
        results,
      },
      { status: rebuilt > 0 ? 200 : 500 }
    );
  } catch (error: any) {
    console.error("STORE MENU REBUILD API POST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to rebuild store menu snapshot",
      },
      { status: 500 }
    );
  }
}
