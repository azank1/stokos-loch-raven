import { SignUp } from "@clerk/nextjs";
import { Store } from "lucide-react";

export default function AdminSignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0F3F24] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/10">
            <Store size={28} className="text-white" />
          </div>

          <h1 className="text-2xl font-black text-white">Stoko&apos;s Admin</h1>
          <p className="mt-2 text-sm text-white/55">
            Create your admin account
          </p>
        </div>

        <SignUp
          routing="hash"
          forceRedirectUrl="/admin"
          signInUrl="/admin/sign-in"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "rounded-[24px] border border-white/10 bg-white shadow-2xl",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "rounded-2xl border border-zinc-200 font-semibold",
              formButtonPrimary:
                "rounded-2xl bg-[#0F3F24] hover:bg-[#146C38] font-black",
              footerActionLink: "text-green-700 font-bold hover:text-green-900",
            },
          }}
        />
      </div>
    </main>
  );
}
