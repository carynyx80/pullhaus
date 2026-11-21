"use client";

import { abis } from "@pullhaus/shared";
import { maxUint256, parseEventLogs, type Abi } from "viem";
import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useMyCards } from "@/lib/cards";
import { isDeployed, useHouse } from "@/lib/house";
import { useSend } from "@/lib/tx";
import { pull, short } from "@/lib/utils";

type Listing = { tokenId: string; seller: string; price: bigint };

export default function MarketPage() {
  const { deployment } = useHouse();
  const { address } = useAccount();
  const client = usePublicClient();
  const send = useSend();
  const { cards, refetch } = useMyCards();
  const [listings, setListings] = useState<Listing[]>([]);
  const [tokenId, setTokenId] = useState("");
  const [price, setPrice] = useState("25");

  async function load() {
    if (!client || !isDeployed(deployment)) return;
    const logs = await client.getLogs({ address: deployment.marketplace, fromBlock: 0n, toBlock: "latest" });
    const parsed = parseEventLogs({ abi: abis.marketplace as Abi, logs });
    const map = new Map<string, Listing>();
    for (const log of parsed) {
      const id = (log.args as any).tokenId?.toString();
      if (!id) continue;
      if (log.eventName === "Listed") map.set(id, { tokenId: id, seller: (log.args as any).seller, price: (log.args as any).price });
      if (log.eventName === "Cancelled" || log.eventName === "Sold") map.delete(id);
    }
    setListings([...map.values()]);
  }
  useEffect(() => {
    load().catch(() => {});
    // Listings are reloaded after each trade as well.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, deployment.marketplace]);

  async function ensureApproval() {
    if (!client || !address) return;
    const ok = (await client.readContract({
      address: deployment.cards,
      abi: abis.cards as Abi,
      functionName: "isApprovedForAll",
      args: [address, deployment.marketplace],
    })) as boolean;
    if (!ok) {
      await send("Approving the desk", { address: deployment.cards, abi: abis.cards as Abi, functionName: "setApprovalForAll", args: [deployment.marketplace, true] });
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Marketplace</p>
      <h1 className="mt-2 font-display text-5xl">Revealed cards only.</h1>
      <p className="mt-3 max-w-xl text-muted">A 5% fee is split across burn, the epoch pool, and the treasury. Sealed cards cannot be listed.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {listings.length === 0 && <p className="text-muted">The desk is empty.</p>}
          {listings.map((listing) => (
            <article key={listing.tokenId} className="glass flex items-center justify-between rounded-2xl px-4 py-3">
              <div>
                <p className="font-display text-2xl">#{listing.tokenId}</p>
                <p className="text-sm text-muted">{short(listing.seller)} · {pull(listing.price)} $PULL</p>
              </div>
              <Button
                disabled={!address || listing.seller.toLowerCase() === address.toLowerCase()}
                onClick={async () => {
                  if (!client || !address) return;
                  const allowance = (await client.readContract({ address: deployment.pull, abi: abis.pull as Abi, functionName: "allowance", args: [address, deployment.marketplace] })) as bigint;
                  if (allowance < listing.price) {
                    await send("Approving $PULL", { address: deployment.pull, abi: abis.pull as Abi, functionName: "approve", args: [deployment.marketplace, maxUint256] });
                  }
                  await send("Buying", { address: deployment.marketplace, abi: abis.marketplace as Abi, functionName: "buy", args: [BigInt(listing.tokenId)] });
                  await load();
                  refetch();
                }}
              >
                Buy
              </Button>
            </article>
          ))}
        </div>
        <form
          className="glass h-fit rounded-3xl p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await ensureApproval();
            const wei = BigInt(Math.round(Number(price) * 1e18));
            await send("Listing", { address: deployment.marketplace, abi: abis.marketplace as Abi, functionName: "list", args: [BigInt(tokenId), wei] });
            await load();
          }}
        >
          <Label>Your revealed card</Label>
          <select className="mb-3 h-11 w-full rounded-2xl border border-line bg-black/30 px-3" value={tokenId} onChange={(event) => setTokenId(event.target.value)}>
            <option value="">Select</option>
            {cards.filter((card) => card.revealed).map((card) => (
              <option key={card.tokenId} value={card.tokenId}>#{card.tokenId} {card.name}</option>
            ))}
          </select>
          <Label>Price in $PULL</Label>
          <Input value={price} onChange={(event) => setPrice(event.target.value)} />
          <Button className="mt-4 w-full" type="submit" disabled={!tokenId}>
            List
          </Button>
          <Button
            className="mt-2 w-full"
            type="button"
            variant="outline"
            disabled={!tokenId}
            onClick={async () => {
              await send("Cancelling", { address: deployment.marketplace, abi: abis.marketplace as Abi, functionName: "cancel", args: [BigInt(tokenId)] });
              await load();
            }}
          >
            Cancel listing
          </Button>
        </form>
      </div>
    </section>
  );
}
