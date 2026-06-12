import { NextResponse } from "next/server";
import { getStoreMenuCategories } from ".././../../../../../lib/server/menucategories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RouteParams = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          categories: [],
          message: "Store slug is required.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const categories = await getStoreMenuCategories(slug);

    return NextResponse.json(
      {
        success: true,
        categories,
        updatedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Public menu categories GET error:", error);

    return NextResponse.json(
      {
        success: false,
        categories: [],
        message: "Failed to load categories.",
      },
      { status: 500 }
    );
  }
}