import { NextResponse } from "next/server";
import { getStoreMenuPayload } from "@/lib/server/storemenu";

export const runtime = "nodejs";
export const revalidate = 30;

type RouteProps = {
  params: Promise<{ slug: string }>;
};

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { slug } = await params;
    const cleanSlug = slugify(slug);

    if (!cleanSlug) {
      return NextResponse.json(
        {
          success: false,
          store: null,
          categories: [],
          menuCategories: [],
          products: [],
          menuProducts: [],
          modifierGroups: [],
          upsells: [],
          upsellProducts: [],
          counts: {
            categories: 0,
            products: 0,
            modifierGroups: 0,
            upsells: 0,
          },
          message: "Store slug is required.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // ✅ No internal rebuild/snapshot and no broad modifier/upsell collection scan.
    // Product list only needs categories + product cards. Product modal can load details later.
    const payload = await getStoreMenuPayload(cleanSlug);

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=30, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Store single menu API error:", error);

    return NextResponse.json(
      {
        success: false,
        store: null,
        categories: [],
        menuCategories: [],
        products: [],
        menuProducts: [],
        modifierGroups: [],
        upsells: [],
        upsellProducts: [],
        counts: {
          categories: 0,
          products: 0,
          modifierGroups: 0,
          upsells: 0,
        },
        message: "Failed to load store menu.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
