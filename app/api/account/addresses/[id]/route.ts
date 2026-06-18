import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";
import connectMongoDB from "@/lib/mongodb";
import CustomerAddress from "@/models/customeraddress";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, message: "Invalid address ID" }, { status: 400 });
    }

    await connectMongoDB();
    await CustomerAddress.deleteOne({ _id: id, clerkUserId: userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ADDRESS DELETE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete address" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, message: "Invalid address ID" }, { status: 400 });
    }

    const body = await req.json();
    await connectMongoDB();

    if (body.isDefault) {
      await CustomerAddress.updateMany({ clerkUserId: userId }, { $set: { isDefault: false } });
    }

    const address = await CustomerAddress.findOneAndUpdate(
      { _id: id, clerkUserId: userId },
      {
        $set: {
          label: body.label,
          street: body.street,
          city: body.city,
          state: body.state,
          zip: body.zip,
          isDefault: body.isDefault,
        },
      },
      { new: true }
    );

    if (!address) {
      return NextResponse.json({ success: false, message: "Address not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, address });
  } catch (error) {
    console.error("ADDRESS PATCH ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update address" },
      { status: 500 }
    );
  }
}
