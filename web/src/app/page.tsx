"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { HeroPack } from "@/components/hero-pack";
import { HowItWorks } from "@/components/how-it-works";
import { LiveTicker } from "@/components/live-ticker";
import { Magnetic } from "@/components/magnetic";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [48, -48]);
  const glow = useTransform(scrollYProgress, [0, 1], [0.25, 0.8]);

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-24 top-8 h-80 w-80 rounded-full bg-ember/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-16 h-96 w-96 rounded-full bg-gold/15 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-12 md:grid-cols-[1.05fr_0.95fr] md:pt-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.42em] text-gold">BNB Chain · sealed drop</p>
            <h1 className="mt-4 font-display text-[18vw] sm:text-8xl md:text-[6.7rem]">
              Burn.
              <br />
              <span className="foil-text">Pull.</span>
              <br />
              Reveal.
            </h1>
            <p className="mt-5 font-serif text-2xl italic text-gold/90">The seal holds until you say so.</p>
            <p className="mt-4 max-w-xl text-lg leading-8 text-muted">
              Pullhaus turns $PULL into sealed cards. The token launches on Flap.sh. The odds are public. The art is grown from the same randomness that mints the card. Points buy perks, not promises.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic>
                <Button asChild size="lg">
                  <Link href="/packs">Open a pack</Link>
                </Button>
              </Magnetic>
              <Magnetic>
                <Button asChild size="lg" variant="outline">
                  <Link href="/how-it-works">How it works</Link>
                </Button>
              </Magnetic>
              <Magnetic>
                <Button asChild size="lg" variant="ghost">
                  <Link href="/odds">Read the odds</Link>
                </Button>
              </Magnetic>
            </div>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">18+ · Public odds · Points are perks</p>
          </div>
          <HeroPack />
        </div>
      </section>
      <LiveTicker />
      <section ref={ref} className="mx-auto grid max-w-6xl gap-4 px-4 py-20 md:grid-cols-12">
        <motion.div style={reduce ? undefined : { y }} className="glass relative overflow-hidden rounded-[32px] p-8 md:col-span-7">
          <motion.div style={{ opacity: glow }} className="pointer-events-none absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-ember blur-3xl" />
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">The ritual</p>
          <h2 className="mt-3 font-display text-6xl sm:text-7xl">Ash, then a seal.</h2>
          <ol className="mt-8 space-y-6 text-muted">
            <li><span className="font-display text-3xl text-ink">01 Burn.</span> A share of the pack price leaves circulation. The rest funds the epoch pool and the treasury.</li>
            <li><span className="font-display text-3xl text-ink">02 Seal.</span> Chainlink VRF rolls the card. Public getters stay quiet until you reveal.</li>
            <li><span className="font-display text-3xl text-ink">03 Keep.</span> Level it, fuse it, list it, or send it into the arena.</li>
          </ol>
        </motion.div>
        <div className="grid gap-4 md:col-span-5">
          {[
            ["Burn points", "Every real burn — packs, upgrades, fusions, fees — accrues points for that wallet."],
            ["Tiers", "Ash, Ember, Kindling, Hearth, Atelier. Higher tiers shift odds and open earlier doors."],
            ["Epoch pool", "Pack revenue and market fees fill a pool. Claim a pro-rata share of what was actually deposited."],
          ].map(([title, copy]) => (
            <article key={title} className="glass rounded-[28px] p-6">
              <h3 className="font-display text-4xl">{title}</h3>
              <p className="mt-2 text-muted">{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-6">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">Key art</p>
        <div className="overflow-hidden rounded-[32px] border border-line shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <Image
            src="/brand/banner.png"
            alt="Pullhaus. Burn. Pull. Reveal. A foil pack fans holographic cards on BNB Chain."
            width={1500}
            height={500}
            className="h-auto w-full"
          />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <HowItWorks compact />
      </section>
    </div>
  );
}
