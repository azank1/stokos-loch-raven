import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";
import { Store } from "lucide-react";
import AdminSignInAlert from "./adminsigninalert";

export default function AdminSignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0F3F24] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/10">
            <Store size={28} className="text-white" />
          </div>

          <h1 className="text-2xl font-black text-white">Stoko&apos;s Admin</h1>
          <p className="mt-2 text-sm text-white/55">
            Sign in to access the admin dashboard
          </p>
        </div>

        <Suspense fallback={null}>
          <AdminSignInAlert />
        </Suspense>

        <SignIn
          routing="hash"
          forceRedirectUrl="/admin"
          signUpUrl="/admin/sign-up"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full rounded-[24px] border border-zinc-200/50 bg-white shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-zinc-950",
              card: "w-full bg-transparent shadow-none border-none p-6 md:p-8",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "rounded-2xl border border-zinc-200 font-semibold dark:border-zinc-800 dark:bg-zinc-900 dark:text-white",
              formButtonPrimary:
                "rounded-2xl bg-[#0F3F24] hover:bg-[#146C38] font-black",
              footerActionLink: "text-green-700 font-bold hover:text-green-900 dark:text-green-500 dark:hover:text-green-400",
              footer: "bg-zinc-50 border-t border-zinc-100 dark:bg-zinc-900/50 dark:border-zinc-800/80 px-6 py-4 md:px-8",
            },
          }}
        />
      </div>
    </main>
  );
}
