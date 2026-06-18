import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLoyaltyAccount } from "@/lib/loyalty";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const account = await getLoyaltyAccount(userId);
    return NextResponse.json({ success: true, account });
  } catch (error) {
    console.error("LOYALTY GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load loyalty account" },
      { status: 500 }
    );
  }
}
