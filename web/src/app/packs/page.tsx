"use client";

import { abis, RARITIES, RARITY_COLORS } from "@pullhaus/shared";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { parseEventLogs, maxUint256, type Abi } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import Link from "next/link";
import { useState } from "react";
import { CardView } from "@/components/card-view";
import { Button } from "@/components/ui/button";
import { toDisplay, type DisplayCard } from "@/lib/cards";
import { SPECIMENS } from "@/lib/specimens";
import { isDeployed, useHouse } from "@/lib/house";
import { useSend } from "@/lib/tx";
import { pull } from "@/lib/utils";

type Phase = { stage: "idle" } | { stage: "shake"; name: string } | { stage: "fan"; cards: DisplayCard[] } | { stage: "flip"; card: DisplayCard };

export default function PacksPage() {
  const reduce = useReducedMotion();
  const { deployment } = useHouse();
  const { address } = useAccount();
  const client = usePublicClient();
  const send = useSend();
  const ready = isDeployed(deployment);
  const [phase, setPhase] = useState<Phase>({ stage: "idle" });
  const [preview, setPreview] = useState(false);
  const idQuery = useReadContract({
    address: deployment.packs,
    abi: abis.packs as Abi,
    functionName: "allPackIds",
    query: { enabled: ready },
  });
  const ids = (idQuery.data as bigint[] | undefined) ?? [];
  const packs = useReadContracts({
    contracts: ids.map((id) => ({ address: deployment.packs, abi: abis.packs as Abi, functionName: "packTypes", args: [id] })),
    query: { enabled: ids.length > 0 },
  });
  const balance = useReadContract({
    address: deployment.pull,
    abi: abis.pull as Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && ready) },
  });

  async function faucet() {
    await send("Minting test $PULL", { address: deployment.pull, abi: abis.pull as Abi, functionName: "faucet" });
    balance.refetch();
  }

  async function openPack(index: number) {
    if (!client || !address) return;
    const row: any = packs.data?.[index]?.result;
    const id = ids[index];
    const name = row?.name ?? row?.[0];
    const price = BigInt(row?.price ?? row?.[1] ?? 0);
    setPhase({ stage: "shake", name });
    const before = (await client.readContract({ address: deployment.cards, abi: abis.cards as Abi, functionName: "myCards", account: address })) as any;
    const beforeIds = new Set<string>(((before?.ids ?? before?.[0] ?? []) as bigint[]).map((item) => item.toString()));
    const allowance = (await client.readContract({
      address: deployment.pull,
      abi: abis.pull as Abi,
      functionName: "allowance",
      args: [address, deployment.packs],
    })) as bigint;
    if (allowance < price) {
      await send("Approving $PULL", { address: deployment.pull, abi: abis.pull as Abi, functionName: "approve", args: [deployment.packs, maxUint256] });
    }
    const hash = await send("Burning for a pack", { address: deployment.packs, abi: abis.packs as Abi, functionName: "openPack", args: [id] });
    const receipt = await client.getTransactionReceipt({ hash });
    const requested = parseEventLogs({ abi: abis.packs as Abi, logs: receipt.logs, eventName: "PackRequested" });
    const requestId = (requested[0] as { args: { requestId: bigint } }).args.requestId;
    if (deployment.mockVrf) {
      await send("Breaking the seal", { address: deployment.vrfCoordinator, abi: abis.vrf as Abi, functionName: "fulfillDeterministic", args: [requestId] });
    }
    const after = (await client.readContract({ address: deployment.cards, abi: abis.cards as Abi, functionName: "myCards", account: address })) as any;
    const nextIds: bigint[] = after?.ids ?? after?.[0] ?? [];
    const rows: any[] = after?.cards_ ?? after?.[1] ?? [];
    const fresh = nextIds.map((tokenId, i) => toDisplay(tokenId, rows[i])).filter((card) => !beforeIds.has(card.tokenId));
    setPhase({ stage: "fan", cards: fresh });
    balance.refetch();
  }

  async function previewTear() {
    setPreview(true);
    setPhase({ stage: "shake", name: "Specimen" });
    await new Promise((resolve) => setTimeout(resolve, reduce ? 0 : 1100));
    setPhase({ stage: "fan", cards: SPECIMENS.map((card) => ({ ...card, revealed: false })) });
  }

  function closeCeremony() {
    setPreview(false);
    setPhase({ stage: "idle" });
  }

  async function reveal(card: DisplayCard) {
    if (preview) {
      setPhase({ stage: "flip", card: { ...card, revealed: true } });
      return;
    }
    setPhase({ stage: "flip", card });
    await send("Revealing the card", { address: deployment.cards, abi: abis.cards as Abi, functionName: "reveal", args: [BigInt(card.tokenId)] });
    setPhase({ stage: "flip", card: { ...card, revealed: true } });
  }

  const prices = ids.flatMap((_, index) => {
    const row: any = packs.data?.[index]?.result;
    if (!row) return [];
    const active = Boolean(row.active ?? row[7]);
    const price = BigInt(row.price ?? row[1] ?? 0);
    return active && price > 0n ? [price] : [];
  });
  const cheapest = prices.length > 0 ? prices.reduce((low, price) => (price < low ? price : low)) : null;
  const held = typeof balance.data === "bigint" ? balance.data : null;
  const shortOnPull = Boolean(address && held !== null && cheapest !== null && held < cheapest);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-gold">Packs</p>
          <h1 className="mt-3 font-display text-6xl sm:text-8xl">Pay in ash.</h1>
          <p className="mt-3 max-w-xl text-muted">Half the price is burned. Thirty percent feeds the epoch pool. The card stays sealed until you reveal it.</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Your $PULL</p>
          <p className="font-mono text-4xl">{pull(balance.data as bigint)}</p>
          {deployment.mockToken && address ? (
            <Button className="mt-2" variant="outline" size="sm" onClick={faucet}>
              Faucet
            </Button>
          ) : null}
          <Button className="mt-2" variant="outline" size="sm" onClick={() => void previewTear()}>
            Preview the tear
          </Button>
          <p className="mt-2 text-xs text-muted">Specimen. Does not burn.</p>
        </div>
      </div>
      {shortOnPull ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-gold/40 bg-gold/10 px-5 py-4">
          <p className="text-sm text-muted">Your balance is below the smallest pack. Get $PULL before the next burn.</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/swap">Get $PULL</Link>
          </Button>
        </div>
      ) : null}
      {!address ? <p className="mt-8 text-muted">Connect a wallet to open a pack.</p> : null}
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {ids.map((id, index) => {
          const row: any = packs.data?.[index]?.result;
          if (!row) return null;
          const name = row.name ?? row[0];
          const price = row.price ?? row[1];
          const count = Number(row.count ?? row[2]);
          const minTier = Number(row.minTier ?? row[4]);
          return (
            <article key={id.toString()} className="glass group relative overflow-hidden rounded-[28px] p-6">
              <Image src="/brand/mark.png" alt="" width={160} height={160} className="pointer-events-none absolute -right-6 -top-8 size-36 opacity-90 motion-safe:transition motion-safe:duration-500 motion-safe:group-hover:rotate-6" />
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">{count === 1 ? "Single" : `${count} cards`}</p>
              <h2 className="mt-2 font-display text-4xl">{name}</h2>
              <p className="mt-2 text-muted">{pull(price)} $PULL {minTier > 0 ? `· tier ${minTier}` : ""}</p>
              <Button className="mt-6" disabled={!address} onClick={() => openPack(index)}>
                Burn and open
              </Button>
            </article>
          );
        })}
      </div>
      <AnimatePresence>
        {phase.stage !== "idle" && (
          <motion.div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[#070605]/92 px-4 py-10 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {phase.stage === "fan" && !reduce ? (
              <motion.div aria-hidden className="pointer-events-none absolute inset-0 bg-[#fff6ee]" initial={{ opacity: 0.92 }} animate={{ opacity: 0 }} transition={{ duration: 0.55 }} />
            ) : null}
            {phase.stage === "shake" && (
              <div className="relative text-center">
                <div className={`${reduce ? "" : "pack-shake"} relative mx-auto aspect-[3/4.15] w-52`}>
                  <div className="pack-face absolute inset-0 overflow-hidden rounded-[28px] shadow-[0_0_90px_rgba(255,122,69,0.55)]">
                    <div className="pack-crimp absolute inset-x-3 top-3 h-2.5" />
                    <div className="pack-crimp absolute inset-x-3 bottom-3 h-2.5" />
                    <Image src="/brand/logo.png" alt="" width={280} height={280} className="absolute left-1/2 top-[46%] w-[78%] -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div className="relative mx-auto mt-4 h-10 w-40">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="ember-bit absolute bottom-0 size-2 rounded-full bg-ember" style={{ left: `${i * 12}%`, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="mt-6 font-display text-5xl">The ash is leaving.</p>
                <p className="text-muted">{phase.name}</p>
              </div>
            )}
            {phase.stage === "fan" && (
              <div className="relative max-w-5xl text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-gold">Sealed</p>
                <h2 className="mt-3 font-display text-6xl">The pull.</h2>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  {phase.cards.map((card) => (
                    <button key={card.tokenId} className="w-40 text-left sm:w-48" style={{ filter: `drop-shadow(0 18px 28px ${RARITY_COLORS[card.rarity]}88)` }} onClick={() => reveal(card)}>
                      <CardView card={{ ...card, revealed: false }} />
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted">{preview ? "Specimen tear. Nothing was burned." : "Tap a seal to reveal it."}</p>
                <Button className="mt-6" variant="outline" onClick={closeCeremony}>
                  Keep them sealed
                </Button>
              </div>
            )}
            {phase.stage === "flip" && (
              <div className="relative text-center">
                {!reduce ? (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -inset-24 rounded-full blur-3xl"
                    style={{ background: RARITY_COLORS[phase.card.rarity] }}
                    initial={{ opacity: 0.75 }}
                    animate={{ opacity: 0.2 }}
                  />
                ) : null}
                <motion.div initial={reduce ? false : { rotateY: 180, scale: 0.86 }} animate={{ rotateY: 0, scale: 1 }} transition={{ duration: reduce ? 0 : 0.8 }} className="relative mx-auto w-64" style={{ transformStyle: "preserve-3d" }}>
                  <CardView card={phase.card} face />
                </motion.div>
                <p className="mt-4 font-display text-5xl">{phase.card.revealed ? phase.card.name : "Still sealed"}</p>
                <p className="font-mono text-sm uppercase tracking-[0.22em] text-gold">{RARITIES[phase.card.rarity]}</p>
                {preview ? <p className="mt-2 text-sm text-muted">Preview. Nothing was burned. Stats come from the card math.</p> : null}
                <Button className="mt-6" onClick={closeCeremony}>
                  Done
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
