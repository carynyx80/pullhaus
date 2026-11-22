"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "./mark";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "./ui/sheet";

const links = [
  ["Packs", "/packs"],
  ["Swap", "/swap"],
  ["Inventory", "/inventory"],
  ["Forge", "/forge"],
  ["Burn", "/burn"],
  ["Board", "/leaderboard"],
  ["Market", "/market"],
  ["Arena", "/battle"],
  ["Odds", "/odds"],
  ["How it works", "/how-it-works"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-[#070605]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark size={42} />
            <span className="font-display text-[1.7rem] leading-none tracking-tight">Pullhaus</span>
          </Link>
          <nav className="ml-4 hidden min-w-0 flex-1 items-center gap-3 overflow-x-auto lg:flex">
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] ${path === href ? "text-ink" : "text-muted hover:text-ink"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/connect" className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:text-ink sm:block">
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
                <Link href="/" className="flex items-center gap-3">
                  <Mark size={48} />
                  <span className="font-display text-3xl leading-none">Pullhaus</span>
                </Link>
                <div className="mt-8 flex flex-col gap-3">
                  <SheetClose asChild>
                    <Link href="/" className="font-display text-4xl uppercase">
                      Atelier
                    </Link>
                  </SheetClose>
                  {links.map(([label, href]) => (
                    <SheetClose asChild key={href}>
                      <Link href={href} className="font-display text-4xl uppercase">
                        {label}
                      </Link>
                    </SheetClose>
                  ))}
                  <SheetClose asChild>
                    <Link href="/admin" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                      Admin
                    </Link>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto mt-24 max-w-6xl px-4 pb-12 text-sm text-muted">
        <div className="hairline mb-6 h-px" />
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="flex items-center gap-3">
            <Mark size={48} />
            <div>
              <p className="font-display text-3xl leading-none text-ink">Pullhaus</p>
              <p className="mt-2 max-w-sm">On BNB Chain. Burn points are perks, not a promise of profit.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.16em]">
            <Link href="/how-it-works">How it works</Link>
            <Link href="/swap">Get $PULL</Link>
            <Link href="/odds">Published odds</Link>
            <Link href="/admin">Admin</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
