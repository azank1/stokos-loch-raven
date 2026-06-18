import { Suspense } from "react";
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
import { getStoreMenuPayload, type StoreMenuApiData } from "@/lib/server/storemenu";

export const dynamic = "force-dynamic";
export const revalidate = 30;
export const dynamicParams = true;

export function generateStaticParams() {
  return STORES.map((store) => ({ slug: store.slug }));
}

type StorePageProps = {
  params: Promise<{ slug: string }>;
};

type MenuCategoryTab = {
  id: string;
  name: string;
  slug: string;
  title?: string;
  description?: string;
  image?: string;
  sortOrder?: number;
};

const EMPTY_MENU_DATA: StoreMenuApiData = {
  success: false,
  store: null,
  categories: [],
  menuCategories: [],
  products: [],
  menuProducts: [],
  modifierGroups: [],
  upsells: [],
  upsellProducts: [],
  counts: {
    categories: 0,
    products: 0,
    modifierGroups: 0,
    upsells: 0,
  },
  updatedAt: "",
};

function pickNonEmptyArray<T>(first?: T[], second?: T[]) {
  if (Array.isArray(first) && first.length > 0) return first;
  if (Array.isArray(second) && second.length > 0) return second;
  return [];
}

async function getInitialStoreMenu(slug: string): Promise<StoreMenuApiData> {
  try {
    return await getStoreMenuPayload(slug);
  } catch (error) {
    console.error("Initial store menu load error:", error);
    return EMPTY_MENU_DATA;
  }
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;

  const store = STORES.find((item) => item.slug === slug);
  if (!store) notFound();

  const initialMenuData = await getInitialStoreMenu(slug);

  const initialCategories = pickNonEmptyArray<MenuCategoryTab>(
    initialMenuData.categories,
    initialMenuData.menuCategories
  );

  const initialProducts = pickNonEmptyArray(
    initialMenuData.products,
    initialMenuData.menuProducts
  );

  return (
    <main className="min-h-screen bg-white dark:bg-black">
      <Suspense fallback={null}>
        <ScrollMenu />
      </Suspense>

      <Navbar />
      <CartSidebar />
      <StartOrder />
      <Hero />

      <Categories storeSlug={slug} initialCategories={initialCategories} />

      <Suspense fallback={null}>
        <DealsSection
          storeSlug={slug}
          categories={initialCategories}
          initialProducts={initialProducts}
        />
      </Suspense>

      <MenuSectionsClient
        storeSlug={slug}
        categories={initialCategories}
        initialProducts={initialProducts}
        initialMenuData={initialMenuData}
      />

      <BackToTop />
      <Footer store={store} />
    </main>
  );
}