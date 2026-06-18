import { NextResponse } from "next/server";
import { validatePromoCode } from "@/lib/promo";

export async function POST(req: Request) {
  try {
    const { code, subtotal } = await req.json();
    const result = await validatePromoCode(String(code || ""), Number(subtotal || 0));

    if (!result.valid) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      discountAmount: result.discountAmount,
      code: result.code,
      message: result.message,
    });
  } catch (error) {
    console.error("PROMO VALIDATE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to validate promo code" },
      { status: 500 }
    );
  }
}
