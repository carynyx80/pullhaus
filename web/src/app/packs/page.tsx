"use client";

import { abis, RARITIES } from "@pullhaus/shared";
import { AnimatePresence, motion } from "framer-motion";
import { parseEventLogs, maxUint256, type Abi } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import Link from "next/link";
import { useState } from "react";
import { CardView } from "@/components/card-view";
import { Button } from "@/components/ui/button";
import { toDisplay, type DisplayCard } from "@/lib/cards";
import { isDeployed, useHouse } from "@/lib/house";
import { useSend } from "@/lib/tx";
import { pull } from "@/lib/utils";

type Phase = { stage: "idle" } | { stage: "shake"; name: string } | { stage: "fan"; cards: DisplayCard[] } | { stage: "flip"; card: DisplayCard };

export default function PacksPage() {
  const { deployment } = useHouse();
  const { address } = useAccount();
  const client = usePublicClient();
  const send = useSend();
  const ready = isDeployed(deployment);
  const [phase, setPhase] = useState<Phase>({ stage: "idle" });
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

  async function reveal(card: DisplayCard) {
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
    <section className="mx-auto max-w-6xl px-4 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold">Packs</p>
          <h1 className="mt-2 font-display text-5xl">Pay in ash.</h1>
          <p className="mt-3 max-w-xl text-muted">Half the price is burned. Thirty percent feeds the epoch pool. The card stays sealed until you reveal it.</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Your $PULL</p>
          <p className="font-display text-4xl">{pull(balance.data as bigint)}</p>
          {deployment.mockToken && address ? (
            <Button className="mt-2" variant="outline" size="sm" onClick={faucet}>
              Faucet
            </Button>
          ) : null}
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
            <article key={id.toString()} className="glass rounded-[28px] p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-gold">{count === 1 ? "Single" : `${count} cards`}</p>
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
          <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-[#070604]/88 px-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {phase.stage === "shake" && (
              <div className="text-center">
                <div className="pack-shake mx-auto h-72 w-48 rounded-[28px] border border-gold/50 bg-gradient-to-b from-[#3a2418] to-[#120e0c] shadow-[0_0_80px_rgba(255,106,61,0.45)]" />
                <div className="relative mx-auto mt-[-40px] h-10 w-40">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="ember-bit absolute bottom-0 size-2 rounded-full bg-ember" style={{ left: `${i * 12}%`, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="mt-6 font-display text-3xl">The ash is leaving.</p>
                <p className="text-muted">{phase.name}</p>
              </div>
            )}
            {phase.stage === "fan" && (
              <div className="max-w-5xl text-center">
                <p className="text-xs uppercase tracking-[0.22em] text-gold">Sealed</p>
                <div className="mt-6 flex flex-wrap justify-center gap-4">
                  {phase.cards.map((card) => (
                    <button key={card.tokenId} className="w-40 text-left sm:w-48" onClick={() => reveal(card)}>
                      <CardView card={{ ...card, revealed: false }} />
                    </button>
                  ))}
                </div>
                <Button className="mt-8" variant="outline" onClick={() => setPhase({ stage: "idle" })}>
                  Keep them sealed
                </Button>
              </div>
            )}
            {phase.stage === "flip" && (
              <div className="text-center">
                <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.8 }} className="mx-auto w-64">
                  <CardView card={phase.card} face />
                </motion.div>
                <p className="mt-4 font-display text-3xl">{phase.card.name}</p>
                <p className="text-gold">{RARITIES[phase.card.rarity]}</p>
                <Button className="mt-6" onClick={() => setPhase({ stage: "idle" })}>
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
