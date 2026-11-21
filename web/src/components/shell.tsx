"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "./ui/sheet";

const links = [
  ["Packs", "/packs"],
  ["Inventory", "/inventory"],
  ["Forge", "/forge"],
  ["Burn", "/burn"],
  ["Board", "/leaderboard"],
  ["Market", "/market"],
  ["Arena", "/battle"],
  ["Odds", "/odds"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-[#100e0c]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-display text-xl">
            <span className="grid size-8 place-items-center rounded-full bg-ember text-xs text-[#2a100b]">P</span>
            Pullhaus
          </Link>
          <nav className="ml-4 hidden items-center gap-4 text-sm text-muted lg:flex">
            {links.map(([label, href]) => (
              <Link key={href} href={href} className={path === href ? "text-ink" : "hover:text-ink"}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/connect" className="hidden text-sm text-muted hover:text-ink sm:block">
              Connect
            </Link>
            <div className="hidden sm:block">
              <ConnectButton chainStatus="full" showBalance={false} />
            </div>
            <Sheet>
              <SheetTrigger className="grid size-10 place-items-center rounded-full border border-line lg:hidden" aria-label="Open menu">
                <Menu size={18} />
              </SheetTrigger>
              <SheetContent>
                <div className="mt-8 flex flex-col gap-4 text-lg">
                  <SheetClose asChild>
                    <Link href="/">Atelier</Link>
                  </SheetClose>
                  {links.map(([label, href]) => (
                    <SheetClose asChild key={href}>
                      <Link href={href}>{label}</Link>
                    </SheetClose>
                  ))}
                  <SheetClose asChild>
                    <Link href="/admin">Admin</Link>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto mt-20 max-w-6xl px-4 pb-10 text-sm text-muted">
        <div className="hairline mb-6 h-px" />
        <div className="flex flex-col justify-between gap-3 sm:flex-row">
          <p>Pullhaus on BNB Chain. Burn points are perks, not a promise of profit.</p>
          <div className="flex gap-4">
            <Link href="/odds">Published odds</Link>
            <Link href="/admin">Admin</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
