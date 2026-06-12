import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import Categories from "@/components/categories";
import { STORES } from "@/lib/data/stores";
import { notFound } from "next/navigation";
import StartOrder from "@/components/startorder";
import Footer from "@/components/footer";
import BackToTop from "@/components/backtotop";
import DealsSection from "@/components/dealssection";
import CartSidebar from "@/components/cartsidebar";
import ScrollMenu from "@/components/scrollmenu";
import MenuSectionsClient from "@/components/menusectionclient";
import DevClientOnly from "@/components/devclientonly";
import { getStoreMenuCategories } from "@/lib/server/menucategories";
import { getStoreMenuProducts } from "@/lib/server/menuproducts";

export const revalidate = 60;
export const dynamicParams = true;

type StorePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type MenuCategoryTab = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  sortOrder?: number;
};

type DbCategory = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  sortOrder?: number;
};

const POPULAR_CATEGORY: MenuCategoryTab = {
  id: "trending",
  slug: "trending",
  name: "Popular Menu Items",
  description: "",
  image: "",
  sortOrder: -1,
};

const MENU_COUPON_CATEGORY_KEYS = new Set([
  "menu-coupons",
  "menu-coupon",
  "menu-coupon-category",
  "coupons",
  "coupon",
  "deals",
  "deal",
  "menu-deals",
  "menu-deal",
]);

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPopularCategory(category: Partial<DbCategory | MenuCategoryTab>) {
  const id = slugify(category.id);
  const slug = slugify(category.slug);
  const name = slugify(category.name);

  return (
    id === "trending" ||
    slug === "trending" ||
    name === "trending" ||
    name === "popular-menu-items" ||
    name === "popular-items" ||
    name === "popular-menu-item"
  );
}

function isMenuCouponsCategory(category: Partial<DbCategory | MenuCategoryTab>) {
  const keys = [category.id, category.slug, category.name]
    .filter(Boolean)
    .map((value) => slugify(value));

  return keys.some((key) => MENU_COUPON_CATEGORY_KEYS.has(key));
}

function normalizeCategory(category: DbCategory): MenuCategoryTab {
  const name = String(category.name || "").trim();
  const cleanSlug = slugify(category.slug || category.id || category._id || name);

  return {
    id: cleanSlug,
    slug: cleanSlug,
    name,
    description: category.description || "",
    image: category.image || "",
    sortOrder: Number(category.sortOrder || 0),
  };
}

function buildCategories(dbCategories: DbCategory[]) {
  const seen = new Set<string>();

  const realCategories = dbCategories
    .filter((category) => !isPopularCategory(category))
    .map((category) => normalizeCategory(category))
    .filter((category) => {
      if (isMenuCouponsCategory(category)) return false;

      const key = slugify(category.slug || category.id || category.name);

      if (!key) return false;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

  return [POPULAR_CATEGORY, ...realCategories];
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;

  const store = STORES.find((store) => store.slug === slug);

  if (!store) {
    notFound();
  }

  const [dbCategories, dbProducts] = await Promise.all([
    getStoreMenuCategories(slug),
    getStoreMenuProducts(slug),
  ]);

  const categories = buildCategories(dbCategories);

  return (
    <main className="min-h-screen bg-white dark:bg-black">
      <DevClientOnly>
        <ScrollMenu />

        <Navbar />
        <CartSidebar />
        <StartOrder />
        <Hero />

        <Categories storeSlug={slug} initialCategories={categories} />

        <DealsSection
          storeSlug={slug}
          categories={categories}
          initialProducts={dbProducts}
        />

        <MenuSectionsClient
          storeSlug={slug}
          categories={categories}
          initialProducts={dbProducts}
        />

        <BackToTop />

        <Footer store={store} />
      </DevClientOnly>
    </main>
  );
}
