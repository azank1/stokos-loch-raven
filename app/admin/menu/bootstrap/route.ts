import { NextResponse } from "next/server";
import { getAdminMenuPayload } from "@/lib/server/admin-menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await getAdminMenuPayload();

    return NextResponse.json({
      success: true,
      data,
      products: data.products,
      categories: data.categories,
      modifierGroups: data.modifierGroups,
      upsellRules: data.upsellRules,
    });
  } catch (error: any) {
    console.error("ADMIN MENU BOOTSTRAP ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load admin menu data",
        data: {
          loaded: true,
          products: [],
          categories: [],
          modifierGroups: [],
          upsellRules: [],
        },
      },
      { status: 500 }
    );
  }
}
