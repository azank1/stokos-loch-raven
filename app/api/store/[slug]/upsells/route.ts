import { NextResponse } from "next/server";
import { getCartUpsells } from "@/lib/server/cart-upsells";

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = await req.json();
    const categoryIds = Array.isArray(body?.categoryIds)
      ? body.categoryIds.map(String)
      : [];

    const upsells = await getCartUpsells(slug, categoryIds);

    return NextResponse.json({ success: true, upsells });
  } catch (error) {
    console.error("CART UPSELLS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load upsells" },
      { status: 500 }
    );
  }
}
