import { NextResponse } from "next/server";
import { getStoreMenuProducts } from "@/lib/server/menuproducts";

export const runtime = "nodejs";
export const revalidate = 30;

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          products: [],
          menuProducts: [],
          message: "Store slug is required.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const products = await getStoreMenuProducts(slug);

    return NextResponse.json(
      {
        success: true,
        products,
        menuProducts: products,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Store menu products API error:", error);

    return NextResponse.json(
      {
        success: false,
        products: [],
        menuProducts: [],
        message: "Failed to load store products",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
