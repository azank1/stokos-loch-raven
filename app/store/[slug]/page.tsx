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
import { getStoreMenuSnapshot } from "@/lib/server/storemenu-snapshot";

// Public store pages must be served from the StoreMenu snapshot only.
// Admin rebuild updates the snapshot and revalidates this path.
export const dynamic = "force-static";
export const revalidate = 30;
export const dynamicParams = true;

export function generateStaticParams() {
  return STORES.map((store) => ({ slug: store.slug }));
}

type StorePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;

  const store = STORES.find((item) => item.slug === slug);
  if (!store) notFound();

  const snapshot = await getStoreMenuSnapshot(slug);

  const initialCategories = Array.isArray(snapshot.categories)
    ? snapshot.categories
    : [];

  const initialProducts = Array.isArray(snapshot.products)
    ? snapshot.products
    : [];

  return (
    <main className="min-h-screen bg-white dark:bg-black">
      <ScrollMenu />
      <Navbar />
      <CartSidebar />
      <StartOrder />
      <Hero />

      <Categories storeSlug={slug} initialCategories={initialCategories} />

      <DealsSection
        storeSlug={slug}
        categories={initialCategories}
        initialProducts={initialProducts}
      />

      <MenuSectionsClient
        storeSlug={slug}
        categories={initialCategories}
        initialProducts={initialProducts}
      />

      <BackToTop />
      <Footer store={store} />
    </main>
  );
}
