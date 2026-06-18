import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Clock } from "lucide-react";

const stores = [
  {
    name: "Towson",
    slug: "towson",
    address: "6821 Loch Raven Blvd,\nLoch Raven, MD 21286",
    phone: "410-296-6066",
    hours: "Daily: 11am - 11:30pm",
    facebook:
      "https://www.facebook.com/people/Stokos-Towson/100066667372039/",
    yelp: "https://www.yelp.com/biz/stokos-towson",
    google: "https://share.google/mFcJdRzLeeEuM8D2o",
  },
  {
    name: "Baltimore - York",
    slug: "york",
    address: "5503 York Rd,\nBaltimore, MD 21212",
    phone: "410-433-4161",
    hours: "Daily: 11am - 12am",
    facebook: "https://www.facebook.com/people/Stokos/100066313219435/",
    yelp: "https://www.yelp.com/biz/stokos-baltimore",
    google: "https://share.google/auEBQDz2qngc08fkJ",
  },
  {
    name: "Liberty",
    slug: "liberty",
    address: "8624 Liberty Rd\nRandallstown, MD 21133",
    phone: "410-655-0009",
    hours: "Sun - Thu: 10am - 10pm\nFri - Sat: 10am - 11pm",
    facebook: "",
    yelp: "",
    google: "https://share.google/8X2nSgI5Oi6Y73Wnk",
  },
];

export default function MainFooter() {
  return (
    <footer
      id="contact"
      className="w-full bg-green-800 text-white transition-colors duration-300 dark:bg-[#003b11]"
    >
      <div className="mx-auto w-full max-w-[1320px] px-5 py-10 sm:px-6 md:px-8 md:py-12 lg:px-8 lg:py-16">
        <div className="grid gap-10 xl:grid-cols-[0.75fr_2.25fr] xl:gap-14">
          {/* Brand */}
          <div className="max-w-[520px]">
            <Link href="/" className="inline-flex">
              <Image
                src="/images/newstokoslogo.png"
                alt="Stoko's Logo"
                width={180}
                height={70}
                priority
                className="h-11 w-auto object-contain md:h-12 lg:h-[58px]"
              />
            </Link>

            <p className="mt-5 max-w-[440px] text-[15px] font-medium leading-7 text-white/80 md:mt-4 md:text-[14px] md:leading-6 lg:mt-6 lg:text-[15px] lg:leading-7">
              Fresh pizza, wings, subs, salads, and local favorites from your
              nearest Stoko’s location.
            </p>
          </div>

          {/* Stores */}
          <div className="grid gap-8 md:grid-cols-3 md:gap-5 lg:gap-6 xl:gap-0">
            {stores.map((store, index) => (
              <div
                key={store.slug}
                className={`min-w-0 ${
                  index !== 0
                    ? "md:border-l md:border-white/20 md:pl-5 lg:pl-6 xl:pl-8"
                    : ""
                }`}
              >
                <h3 className="min-h-[42px] text-[19px] font-black uppercase leading-tight tracking-wide text-white md:text-[18px] lg:min-h-[54px] lg:text-[21px]">
                  {store.name}
                </h3>

                <div className="mt-4 space-y-4 md:space-y-3 lg:mt-5 lg:space-y-4">
                  <div className="flex items-start gap-3 text-[14px] font-medium leading-6 text-white/80 md:gap-2 md:text-[12px] md:leading-5 lg:gap-3 lg:text-[14px] lg:leading-6">
                    <MapPin className="mt-1 h-[18px] w-[18px] shrink-0 text-white md:h-[15px] md:w-[15px] lg:h-[18px] lg:w-[18px]" />
                    <p className="whitespace-pre-line break-words">
                      {store.address}
                    </p>
                  </div>

                  <div className="flex items-start gap-3 text-[14px] font-medium leading-6 text-white/80 md:gap-2 md:text-[12px] md:leading-5 lg:gap-3 lg:text-[14px] lg:leading-6">
                    <Clock className="mt-1 h-[18px] w-[18px] shrink-0 text-white md:h-[15px] md:w-[15px] lg:h-[18px] lg:w-[18px]" />
                    <p className="whitespace-pre-line break-words">
                      {store.hours}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[15px] font-black text-white md:gap-2 md:text-[13px] lg:gap-3 lg:text-[15px]">
                    <Phone className="h-[18px] w-[18px] shrink-0 text-white md:h-[15px] md:w-[15px] lg:h-[18px] lg:w-[18px]" />
                    <a
                      href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
                      className="break-words transition hover:text-white/75"
                    >
                      {store.phone}
                    </a>
                  </div>
                </div>

                {/* Social Icons */}
                <div className="mt-6 flex items-center gap-3 md:mt-5 md:gap-2 lg:mt-7 lg:gap-3">
                  {store.facebook && (
                    <a
                      href={store.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${store.name} Facebook`}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-blue-700 transition hover:scale-105 md:h-8 md:w-8 md:text-xs lg:h-9 lg:w-9 lg:text-sm"
                    >
                      f
                    </a>
                  )}

                  {store.yelp && (
                    <a
                      href={store.yelp}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${store.name} Yelp`}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-black text-red-600 transition hover:scale-105 md:h-8 md:w-8 md:text-[10px] lg:h-9 lg:w-9 lg:text-xs"
                    >
                      Yelp
                    </a>
                  )}

                  <a
                    href={store.google}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${store.name} Google`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-green-700 transition hover:scale-105 md:h-8 md:w-8 md:text-xs lg:h-9 lg:w-9 lg:text-sm"
                  >
                    G
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 flex flex-col gap-5 border-t border-white/15 pt-7 text-sm font-medium text-white/75 md:mt-10 md:flex-row md:items-center md:justify-between md:pr-16 lg:mt-14 lg:pr-0">
          <p>© {new Date().getFullYear()} Stoko&apos;s. All rights reserved.</p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <a href="#stores" className="transition hover:text-white">
              Stores
            </a>

            <a href="#testimonials" className="transition hover:text-white">
              Testimonials
            </a>

            <a href="#contact" className="transition hover:text-white">
              Contact
            </a>

            <Link href="/track" className="transition hover:text-white">
              Track Order
            </Link>

            <Link href="/admin/sign-in" className="transition hover:text-white/50 text-white/30 text-xs">
              Staff Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}