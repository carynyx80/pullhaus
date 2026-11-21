"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { CardView } from "@/components/card-view";
import { Button } from "@/components/ui/button";
import type { DisplayCard } from "@/lib/cards";

const samples: DisplayCard[] = [
  { tokenId: "1", revealed: true, rarity: 3, level: 1, element: 0, atk: 96, def: 88, spd: 74, ability: 0, setId: 1, seed: "11", name: "Auri wick of the Last Heat", lore: "" },
  { tokenId: "2", revealed: true, rarity: 2, level: 1, element: 1, atk: 70, def: 81, spd: 90, ability: 1, setId: 1, seed: "29", name: "Lune glass Beneath the Wax", lore: "" },
  { tokenId: "3", revealed: true, rarity: 4, level: 1, element: 4, atk: 120, def: 110, spd: 104, ability: 11, setId: 1, seed: "77", name: "Noor dusk the Unopened", lore: "" },
];

export default function HomePage() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const glow = useTransform(scrollYProgress, [0, 1], [0.2, 0.85]);
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-ember/30 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 md:grid-cols-[1.1fr_0.9fr] md:pt-24">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gold">BNB Chain · sealed atelier</p>
            <h1 className="mt-4 font-display text-5xl leading-[0.95] text-ink sm:text-7xl">
              Burn the token.
              <br />
              Keep the card.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Pullhaus turns $PULL into sealed cards. The odds are public. The art is grown from the same randomness that mints the card. Points buy perks, not promises.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/packs">Open a pack</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/odds">Read the odds</Link>
              </Button>
            </div>
          </div>
          <div className="relative h-[460px]">
            {samples.map((card, index) => (
              <motion.div
                key={card.tokenId}
                className="absolute left-1/2 w-48 sm:w-56"
                style={{ x: "-50%", top: index * 18 }}
                animate={{ y: [0, index % 2 ? 10 : -12, 0], rotate: [-8 + index * 8, -6 + index * 8, -8 + index * 8] }}
                transition={{ duration: 6 + index, repeat: Infinity, ease: "easeInOut" }}
              >
                <CardView card={card} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <div className="overflow-hidden border-y border-line py-4 text-sm uppercase tracking-[0.28em] text-gold">
        <motion.div animate={{ x: ["0%", "-50%"] }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }} className="flex w-[200%] gap-10 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, copy) => (
            <span key={copy}>Common · Rare · Epic · Legendary · Mythic is forged · Burn points · Public odds · Sealed until you say so ·</span>
          ))}
        </motion.div>
      </div>
      <section ref={ref} className="mx-auto grid max-w-6xl gap-10 px-4 py-24 md:grid-cols-2">
        <motion.div style={{ y }} className="glass relative overflow-hidden rounded-[32px] p-8">
          <motion.div style={{ opacity: glow }} className="absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-ember blur-3xl" />
          <p className="text-xs uppercase tracking-[0.22em] text-gold">The ritual</p>
          <h2 className="mt-3 font-display text-5xl">Ash, then a seal.</h2>
          <ol className="mt-8 space-y-6 text-muted">
            <li><span className="text-ink">01 Burn.</span> A share of the pack price leaves circulation. The rest funds the epoch pool and the treasury.</li>
            <li><span className="text-ink">02 Seal.</span> Chainlink VRF rolls the card. Public getters stay quiet until you reveal.</li>
            <li><span className="text-ink">03 Keep.</span> Level it, fuse it, list it, or send it into the arena.</li>
          </ol>
        </motion.div>
        <div className="grid gap-4">
          {[
            ["Burn points", "Every real burn — packs, upgrades, fusions, fees — accrues points for that wallet."],
            ["Tiers", "Ash, Ember, Kindling, Hearth, Atelier. Higher tiers shift odds and open earlier doors."],
            ["Epoch pool", "Pack revenue and market fees fill a weekly pool. Claim a pro-rata share of what was actually deposited."],
          ].map(([title, copy]) => (
            <article key={title} className="glass rounded-3xl p-6">
              <h3 className="font-display text-3xl">{title}</h3>
              <p className="mt-2 text-muted">{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
