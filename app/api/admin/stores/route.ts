import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    await connectMongoDB();

    const stores = await Store.find({})
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      stores,
    });
  } catch (error) {
    console.error("GET STORES ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch stores.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectMongoDB();

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

    const existingStore = await Store.findOne({ slug });

    if (existingStore) {
      return NextResponse.json(
        {
          success: false,
          message: "Store already exists with this name.",
        },
        { status: 409 }
      );
    }

    const store = await Store.create({
      name,
      slug,
      location,
      phone,
      openingHours,
      deliveryFee: Number(body.deliveryFee ?? 0),
      taxRate: Number(body.taxRate ?? 0),
      minimumOrder: Number(body.minimumOrder ?? 0),
      status: "Active",
      sortOrder: 0,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Store created successfully.",
        store,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE STORE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create store.",
      },
      { status: 500 }
    );
  }
}