import MenuManagementClient from "./menumanagementclient";
import { getAdminMenuPayload } from "@/lib/server/admin-menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MenuManagementPage() {
  const initialData = await getAdminMenuPayload().catch((error) => {
    console.error("ADMIN MENU INITIAL DATA ERROR:", error);

    return {
      loaded: true,
      products: [],
      categories: [],
      modifierGroups: [],
      upsellRules: [],
    };
  });

  return <MenuManagementClient initialData={initialData} />;
}
