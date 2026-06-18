import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import AccountNav from "@/components/accountnav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F6F7F4] text-black">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <div>
            <Link href="/" className="text-xs font-black uppercase tracking-[0.2em] text-green-800">
              Stoko&apos;s
            </Link>
            <h1 className="text-2xl font-black">My Account</h1>
          </div>
          <UserButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
        <AccountNav />
        {children}
      </div>
    </main>
  );
}
