import { NextResponse } from "next/server";
import { getStoreMenuProducts } from "@/lib/server/menuproducts";

export const runtime = "nodejs";
export const revalidate = 60;

type RouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { slug } = await params;

    const products = await getStoreMenuProducts(slug);

    return NextResponse.json(
      {
        success: true,
        products,
        menuProducts: products,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
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
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
