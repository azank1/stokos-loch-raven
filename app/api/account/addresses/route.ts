import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectMongoDB from "@/lib/mongodb";
import CustomerAddress from "@/models/customeraddress";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectMongoDB();
    const addresses = await CustomerAddress.find({ clerkUserId: userId })
      .sort({ isDefault: -1, updatedAt: -1 })
      .lean();

    return NextResponse.json({ success: true, addresses });
  } catch (error) {
    console.error("ADDRESSES GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load addresses" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const street = String(body.street || "").trim();
    if (!street) {
      return NextResponse.json({ success: false, message: "Street is required" }, { status: 400 });
    }

    await connectMongoDB();

    if (body.isDefault) {
      await CustomerAddress.updateMany({ clerkUserId: userId }, { $set: { isDefault: false } });
    }

    const address = await CustomerAddress.create({
      clerkUserId: userId,
      label: String(body.label || "Home").trim(),
      street,
      city: String(body.city || "").trim(),
      state: String(body.state || "").trim(),
      zip: String(body.zip || "").trim(),
      isDefault: Boolean(body.isDefault),
    });

    return NextResponse.json({ success: true, address });
  } catch (error) {
    console.error("ADDRESSES POST ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to save address" },
      { status: 500 }
    );
  }
}
