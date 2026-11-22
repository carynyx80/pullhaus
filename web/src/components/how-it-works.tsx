"use client";

import { TIERS } from "@pullhaus/shared";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  bpsLabel,
  CONTRACT_DEFAULTS,
  formatDuration,
  formatPullNumber,
  splitAmount,
  useEconomics,
  type Share,
} from "@/lib/economics";
import { pull } from "@/lib/utils";

const STEPS = [
  {
    kicker: "01",
    title: "Buy $PULL",
    body: "Swap BNB, USDT, or USDC on BNB Smart Chain once a PancakeSwap V2 pair has liquidity. Until then, $PULL is bought on Flap.sh, where it trades on a bonding curve. Tax tokens migrate to PancakeSwap V2. Non-tax tokens migrate to PancakeSwap Infinity.",
    href: "/swap",
    cta: "Open the swap desk",
  },
  {
    kicker: "02",
    title: "Burn it for a sealed pack",
    body: "Opening a pack spends $PULL. The contract splits that spend, then mints the cards to you and leaves them sealed.",
    href: "/packs",
    cta: "See the packs",
  },
  {
    kicker: "03",
    title: "VRF rolls the rarity",
    body: "Chainlink VRF picks the rarity on-chain. The card stays sealed. Public views do not show its traits until you reveal it.",
    href: "/odds",
    cta: "Read the odds",
  },
  {
    kicker: "04",
    title: "Art, stats, and lore",
    body: "The seed grows a name, a picture, and a line of lore. Stats come from that seed and the rarity. A model may restyle the words and the image. It does not change the numbers.",
    href: "/inventory",
    cta: "Your atelier",
  },
  {
    kicker: "05",
    title: "Fuse, then battle",
    body: "Burn a duplicate to level a card, or fuse matches into the next rarity. Mythic is not in the pack table. A battle narrates the stats of revealed cards. It does not move tokens.",
    href: "/forge",
    cta: "The forge",
  },
  {
    kicker: "06",
    title: "Trade what you reveal",
    body: "Only a revealed card can be listed. The marketplace holds it in escrow until somebody buys it or you take it back.",
    href: "/market",
    cta: "The market",
  },
] as const;

const FAQ = [
  {
    q: "Where does $PULL come from?",
    a: "On BNB Smart Chain it launches on Flap.sh. It trades on Flap's bonding curve until 80% of supply is sold, then migrates. Tax tokens, whose address ends in 7777, migrate to a PancakeSwap V2 pool. Non-tax tokens, whose address ends in 8888, migrate to a PancakeSwap Infinity CL pool. This app swaps through the V2 router only when a V2 pair with liquidity exists. Before that, buy on Flap. The mainnet token has not launched, so the swap desk stays on “Launching soon” until an address is configured. On BSC testnet the game uses MockPULL from a faucet, which is not the mainnet token.",
  },
  {
    q: "What happens to the tokens I spend?",
    a: "Pack opens, forge payments, and the marketplace fee use one split. The default is 50% burned, 30% deposited in the epoch pool, and 20% sent to the treasury. The treasury receives whatever is left after the other two legs, so the three parts add up to the whole amount. Points accrue on the burned part only.",
  },
  {
    q: "How does a claim work?",
    a: "An epoch collects pool deposits that arrive while it is open. After the end time, anyone can finalize it. Your claim is that epoch’s pool multiplied by your points, divided by all points earned during it. An empty pool, or no points of your own, pays zero. The claim is a share of tokens that were actually deposited. It is not wages, yield, or a promised return.",
  },
  {
    q: "What do tiers change?",
    a: "Lifetime burn points set a tier: Ash, Ember, Kindling, Hearth, then Atelier. A tier shifts odds weight out of common. Half of the shift goes to rare, 30% to epic, and the rest to legendary. Mythic stays at zero. Atelier can also open a pack early when that pack has an early window.",
  },
  {
    q: "Can I pull a mythic?",
    a: "The default pack table gives mythic a weight of zero. A mythic is fused from two legendaries, or from one legendary together with the mythic burn.",
  },
  {
    q: "Is a sealed card private?",
    a: "Public contract views stay quiet until the owner reveals the card, and the site hides sealed traits from other people. This version is not a zero-knowledge proof. An indexer with a role on the card contract can still read the sealed record. The seal hides a card in the product. It is not cryptographic privacy.",
  },
] as const;

export function HowItWorks({ compact = false }: { compact?: boolean }) {
  const economics = useEconomics();
  const reduce = useReducedMotion();
  const aligned = sameShare(economics.pack, economics.forge) && sameShare(economics.pack, economics.market);
  return (
    <section id={compact ? "how-it-works" : undefined} className={compact ? "" : "mx-auto max-w-6xl px-4 py-14"}>
      <p className="text-xs uppercase tracking-[0.22em] text-gold">{compact ? "How it works" : "A walk through the atelier"}</p>
      <h2 className={`mt-3 font-display leading-[0.95] ${compact ? "text-5xl sm:text-6xl" : "text-5xl sm:text-7xl"}`}>
        From a token
        <br />
        to a card you keep.
      </h2>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
        Six steps. The odds are published before you spend anything. Points are a record of what you burned, and a claim only pays tokens the pool actually received.
      </p>
      <motion.ol
        className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.07 } } }}
      >
        {STEPS.map((step, index) => (
          <motion.li
            key={step.kicker}
            variants={{
              hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 18 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
            }}
            className="glass flex flex-col rounded-[28px] p-6"
          >
            <StepMark index={index} reduce={Boolean(reduce)} />
            <h3 className="mt-5 font-display text-3xl">{step.title}</h3>
            <p className="mt-3 flex-1 leading-7 text-muted">{step.body}</p>
            <Link href={step.href} className="mt-5 text-sm text-gold hover:text-ink">
              {step.cta}
            </Link>
          </motion.li>
        ))}
      </motion.ol>

      <div className="mt-8 glass rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Every burn</p>
            <h3 className="mt-2 font-display text-4xl">Where a spend goes.</h3>
          </div>
          <p className="max-w-sm text-sm text-muted">{sourceLine(economics.pack, aligned)}</p>
        </div>
        <SplitBar share={economics.pack} reduce={Boolean(reduce)} />
        <p className="mt-4 leading-7 text-muted">{packSentence(economics.pack)}</p>
        {compact ? null : aligned ? null : (
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <ShareCard title="Packs" share={economics.pack} />
            <ShareCard title="Forge" share={economics.forge} />
            <ShareCard title="Marketplace fee" share={economics.market} />
          </div>
        )}
      </div>

      {compact ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/how-it-works">The full walkthrough</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/swap">Get $PULL</Link>
          </Button>
        </div>
      ) : (
        <FullStory economics={economics} />
      )}
    </section>
  );
}

function FullStory({ economics }: { economics: ReturnType<typeof useEconomics> }) {
  const marketSentence = feeSentence(economics.market);
  return (
    <>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="glass rounded-[32px] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Epoch pool</p>
          <h3 className="mt-2 font-display text-4xl">A share of what was deposited.</h3>
          <p className="mt-4 leading-7 text-muted">
            Points equal the amount burned. They are counted in lifetime points, in the current season, and in the open epoch. A burn that lands while no epoch is open still raises your tier. It does not enter an epoch you missed. Deposits that arrive with no epoch open wait in a pending pool until the next one starts.
          </p>
          <p className="mt-4 leading-7 text-muted">{epochSentence(economics.epochSeconds)}</p>
          <p className="mt-4 leading-7 text-muted">
            After finalize, claim pays pool × your epoch points ÷ everyone’s epoch points. Division leaves no fraction of a wei, so dust can remain in the contract. Nothing in that formula promises a profit.
          </p>
        </article>
        <article className="glass rounded-[32px] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Marketplace</p>
          <h3 className="mt-2 font-display text-4xl">The fee is the only cut.</h3>
          <p className="mt-4 leading-7 text-muted">{marketSentence}</p>
          <p className="mt-4 text-sm text-muted">
            {economics.market.live ? "Fee and split read from the marketplace contract." : "Default fee written in PullhausMarketplace. An admin can change it, up to 20%."}
          </p>
        </article>
      </div>

      <article className="mt-4 glass rounded-[32px] p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Tiers</p>
        <h3 className="mt-2 font-display text-4xl">Burns lean the table.</h3>
        <p className="mt-4 max-w-3xl leading-7 text-muted">{tierSentence(economics.tiers.live)}</p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TIERS.map((tier) => (
            <li key={tier.id} className="rounded-2xl border border-line p-4">
              <p className="font-display text-2xl">{tier.name}</p>
              <p className="mt-1 text-sm text-gold">{tierThreshold(tier.id, economics)}</p>
              <p className="mt-2 text-xs leading-5 text-muted">{tier.perk}</p>
              <p className="mt-2 text-xs text-ink">Odds shift {bpsLabel(economics.boosts.values[tier.id] ?? 0)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          {economics.boosts.live ? "Shifts read from the pack contract." : "Shifts written in PullhausPacks: 0, 1.5%, 3%, 5%, and 8%."} Half of a shift moves to rare, 30% to epic, and the remainder to legendary.
        </p>
      </article>

      <article className="mt-4 glass rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Published odds</p>
            <h3 className="mt-2 font-display text-4xl">The table, before you burn.</h3>
          </div>
          <Link href="/odds" className="text-sm text-gold hover:text-ink">
            Open the live table
          </Link>
        </div>
        <div className="mt-6 space-y-3">
          {["Common", "Rare", "Epic", "Legendary", "Mythic"].map((name, index) => (
            <div key={name}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{name}</span>
                <span>{bpsLabel(economics.odds.values[index] ?? 0)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gold/80" style={{ width: `${(economics.odds.values[index] ?? 0) / 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          {economics.odds.live ? "Weights read from the pack contract." : "Default weights written in PullhausPacks."} Weights are out of 10,000. Mythic stays at zero in that table.
        </p>
      </article>

      <ForgeNote economics={economics} />

      <article className="mt-4">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Questions</p>
        <h3 className="mt-2 font-display text-4xl">Short answers.</h3>
        <FaqList />
      </article>

      <aside className="mt-4 rounded-[32px] border border-gold/40 bg-gold/10 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Before you play</p>
        <h3 className="mt-2 font-display text-4xl">This is not financial advice.</h3>
        <p className="mt-4 leading-7 text-muted">
          Pullhaus is a game of chance on BNB Chain for people 18 and older. Nothing here is financial, legal, or tax advice. Burn points and epoch claims depend on activity and on tokens that pack sales, forge payments, and marketplace fees actually deposit. They can be zero. They are not wages, yield, or a guaranteed return. Odds are published before a token is spent. Check the law where you live before you play a game of chance.
        </p>
      </aside>
    </>
  );
}

function ForgeNote({ economics }: { economics: ReturnType<typeof useEconomics> }) {
  const costs = economics.costs;
  const fuse = costs ? costs.fuse : BigInt(CONTRACT_DEFAULTS.fuseBasePull) * 10n ** 18n;
  const upgrade = costs ? costs.upgrade : BigInt(CONTRACT_DEFAULTS.upgradeBasePull) * 10n ** 18n;
  const mythic = costs ? costs.mythic : null;
  return (
    <article className="mt-4 glass rounded-[32px] p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-gold">Forge prices</p>
      <h3 className="mt-2 font-display text-4xl">Duplicates, then a rarer card.</h3>
      <ul className="mt-5 space-y-3 leading-7 text-muted">
        <li>An upgrade burns one card of the same rarity and costs the upgrade base times the card’s current level. The level stops at 20. Base {costs ? "on this deployment" : "written in the forge"}: {pull(upgrade)} $PULL.</li>
        <li>Three matching cards below legendary fuse for the fuse base times one, two, or three, for common, rare, and epic. That is {pull(fuse)}, {pull(fuse * 2n)}, and {pull(fuse * 3n)} $PULL {costs ? "right now" : "at the written base"}.</li>
        <li>Two legendaries fuse for eight times the fuse base: {pull(fuse * 8n)} $PULL.</li>
        <li>
          One legendary fuses into a mythic for the mythic burn
          {mythic ? `: ${pull(mythic)} $PULL on this deployment.` : ". The forge is constructed at 25,000 $PULL. The deploy script keeps that off Anvil and uses 500 $PULL on Anvil, unless MYTHIC_BURN is set."}
        </li>
      </ul>
      <p className="mt-4 text-sm text-muted">
        {costs ? "Prices read from the forge contract." : "Upgrade and fuse bases are 50 and 75 $PULL in PullhausForge and in the deploy script."} The same burn split applies to the $PULL spent here. The new card is minted sealed.
      </p>
    </article>
  );
}

function FaqList() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mt-4 divide-y divide-white/10">
      {FAQ.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.q}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : index)}
            >
              <span className="font-display text-2xl">{item.q}</span>
              <span aria-hidden className="text-gold">
                {expanded ? "–" : "+"}
              </span>
            </button>
            {expanded ? <p className="max-w-3xl pb-4 leading-7 text-muted">{item.a}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function StepMark({ index, reduce }: { index: number; reduce: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <motion.span
        className="grid size-12 place-items-center rounded-full border border-gold/50 font-display text-lg text-gold"
        animate={reduce ? undefined : { y: [0, index % 2 ? -4 : 4, 0] }}
        transition={{ duration: 5 + index * 0.3, repeat: Infinity, ease: "easeInOut" }}
      >
        0{index + 1}
      </motion.span>
      <span className="h-px flex-1 bg-gradient-to-r from-gold/50 to-transparent" />
    </div>
  );
}

function SplitBar({ share, reduce }: { share: Share; reduce: boolean }) {
  const parts = [
    { label: "Burned", bps: share.burnBps, className: "bg-ember" },
    { label: "Reward pool", bps: share.rewardBps, className: "bg-gold" },
    { label: "Treasury", bps: share.treasuryBps, className: "bg-[#f6efe4]/70" },
  ];
  return (
    <div className="mt-6">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
        {parts.map((part) => (
          <motion.div
            key={part.label}
            className={part.className}
            initial={{ width: reduce ? `${part.bps / 100}%` : 0 }}
            whileInView={{ width: `${part.bps / 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: reduce ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        {parts.map((part) => (
          <div key={part.label}>
            <dt className="text-muted">{part.label}</dt>
            <dd className="font-display text-2xl">{bpsLabel(part.bps)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ShareCard({ title, share }: { title: string; share: Share }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{title}</p>
      <p className="mt-2 font-display text-2xl">
        {bpsLabel(share.burnBps)} · {bpsLabel(share.rewardBps)} · {bpsLabel(share.treasuryBps)}
      </p>
      <p className="text-xs text-muted">{share.live ? "Read from this contract" : "Contract default"}</p>
    </div>
  );
}

function sameShare(a: Share, b: Share) {
  return a.burnBps === b.burnBps && a.rewardBps === b.rewardBps && a.treasuryBps === b.treasuryBps;
}

function sourceLine(share: Share, aligned: boolean) {
  if (!share.live) return "Default shares written in the pack, forge, and marketplace contracts. Live values replace them when this deployment can be read.";
  if (aligned) return "Read from the pack, forge, and marketplace contracts on this deployment. All three match.";
  return "Read from this deployment. The contracts do not all use the same shares, so the bar shows packs.";
}

function packSentence(share: Share) {
  const parts = splitAmount(10_000, share.burnBps, share.rewardBps);
  return `On a 100 $PULL pack at these shares, ${coins(parts.burn)} is burned, ${coins(parts.reward)} goes to the reward pool, and ${coins(parts.treasury)} goes to the treasury. Points earned on that pack: ${coins(parts.burn)}.`;
}

function feeSentence(market: Share & { feeBps: number }) {
  const price = 10_000;
  const fee = Math.floor((price * market.feeBps) / 10_000);
  const parts = splitAmount(fee, market.burnBps, market.rewardBps);
  const seller = price - fee;
  return `The fee is ${bpsLabel(market.feeBps)} of the sale. On a 100 $PULL sale, the seller receives ${coins(seller)}. The ${coins(fee)} fee splits into ${coins(parts.burn)} burned, ${coins(parts.reward)} for the pool, and ${coins(parts.treasury)} for the treasury. The buyer earns ${coins(parts.burn)} points, because points follow the burn.`;
}

function coins(hundredths: number) {
  return `${(hundredths / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} $PULL`;
}

function epochSentence(seconds: number | null) {
  if (seconds !== null) {
    return `The open epoch on this deployment runs for ${formatDuration(seconds)}. Anyone can finalize it once that time has passed, and an admin starts the next one.`;
  }
  return `The deploy script opens the first epoch for ${formatDuration(CONTRACT_DEFAULTS.anvilEpochSeconds)} on Anvil and ${formatDuration(CONTRACT_DEFAULTS.publicEpochSeconds)} on every other chain, unless EPOCH_DURATION is set. The published BSC testnet deployment used 1 day. A later epoch lasts however long the admin passes to startEpoch.`;
}

function tierSentence(live: boolean) {
  if (live) return "Thresholds below are lifetime burn points read from PullhausRewards on this deployment. Crossing one moves you up a tier.";
  return `Thresholds live on PullhausRewards. The contract is constructed at ${CONTRACT_DEFAULTS.constructorTiersPull.map(formatPullNumber).join(" / ")} $PULL. The deploy script replaces those on every chain other than Anvil with ${CONTRACT_DEFAULTS.publicTiersPull.map(formatPullNumber).join(" / ")} $PULL, unless TIER1 through TIER4 are set.`;
}

function tierThreshold(id: number, economics: ReturnType<typeof useEconomics>) {
  if (id === 0) return economics.tiers.live ? `Under ${pull(economics.tiers.wei[0])} $PULL` : "Before the first threshold";
  if (economics.tiers.live) return `${pull(economics.tiers.wei[id - 1])} $PULL burned`;
  return "Set at deploy";
}
