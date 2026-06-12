import type { Metadata } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Stokos Loch Raven",
  description: "Online Ordering System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${jakarta.variable} min-h-screen bg-white font-sans antialiased dark:bg-black`}
      >
        <main className="min-h-screen">{children}</main>

        <Script
          id="stripe-back-fix"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener("pageshow", function (event) {
                var stripeStarted = sessionStorage.getItem("stripe_checkout_started");

                if (stripeStarted === "1" || event.persisted) {
                  sessionStorage.removeItem("stripe_checkout_started");
                  window.location.reload();
                }
              });
            `,
          }}
        />
      </body>
    </html>
  );
}