import { NextResponse } from "next/server";
import { getStoreMenuProductDetails } from "@/lib/server/menuproducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteProps = {
  params: Promise<{ slug: string; productId: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { slug, productId } = await params;

    if (!slug || !productId) {
      return NextResponse.json(
        {
          success: false,
          product: null,
          message: "Store slug and product id are required.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const product = await getStoreMenuProductDetails(slug, productId);

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          product: null,
          message: "Product not found.",
        },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        product,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Store menu product detail API error:", error);

    return NextResponse.json(
      {
        success: false,
        product: null,
        message: "Failed to load product details.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
