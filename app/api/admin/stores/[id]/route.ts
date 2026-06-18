import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@/lib/mongodb";
import Store from "@/models/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoreBody = {
  name?: string;
  slug?: string;
  location?: string;
  phone?: string;
  openingHours?: string;
  deliveryFee?: number;
  taxRate?: number;
  minimumOrder?: number;
};

const createSlug = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectMongoDB();

    const { id } = await context.params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid store ID.",
        },
        { status: 400 }
      );
    }

    const body = (await req.json()) as StoreBody;

    const name = body.name?.trim();
    const slug = createSlug(body.slug || body.name || "");
    const location = body.location?.trim();
    const phone = body.phone?.trim();
    const openingHours = body.openingHours?.trim();

    if (!name || !slug || !location || !phone || !openingHours) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Store name, location, phone number, and opening hours are required.",
        },
        { status: 400 }
      );
    }

    const existingStore = await Store.findOne({
      slug,
      _id: { $ne: id },
    });

    if (existingStore) {
      return NextResponse.json(
        {
          success: false,
          message: "Another store already exists with this name.",
        },
        { status: 409 }
      );
    }

    const store = await Store.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          slug,
          location,
          phone,
          openingHours,
          deliveryFee: Number(body.deliveryFee ?? 0),
          taxRate: Number(body.taxRate ?? 0),
          minimumOrder: Number(body.minimumOrder ?? 0),
        },
      },
      { new: true }
    );

    if (!store) {
      return NextResponse.json(
        {
          success: false,
          message: "Store not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Store updated successfully.",
      store,
    });
  } catch (error) {
    console.error("UPDATE STORE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update store.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectMongoDB();

    const { id } = await context.params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid store ID.",
        },
        { status: 400 }
      );
    }

    const deletedStore = await Store.findByIdAndDelete(id);

    if (!deletedStore) {
      return NextResponse.json(
        {
          success: false,
          message: "Store not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Store deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE STORE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete store.",
      },
      { status: 500 }
    );
  }
}