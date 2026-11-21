"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { CardView } from "@/components/card-view";
import { Button } from "@/components/ui/button";
import { api, signIn } from "@/lib/api";
import { useMyCards } from "@/lib/cards";

export default function InventoryPage() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { cards, loading } = useMyCards();
  const [images, setImages] = useState<Record<string, string>>({});
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!address) return;
    api<{ cards: { tokenId: string; imageUrl?: string; revealed: boolean }[] }>("/inventory")
      .then((body) => {
        const next: Record<string, string> = {};
        for (const card of body.cards) if (card.imageUrl) next[card.tokenId] = card.imageUrl;
        setImages(next);
        setSigned(true);
      })
      .catch(() => setSigned(false));
  }, [address]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold">Inventory</p>
          <h1 className="mt-2 font-display text-5xl">Your sealed drawer.</h1>
        </div>
        {address && !signed && (
          <Button
            variant="outline"
            onClick={() => signIn((message) => signMessageAsync({ message }), address, chainId || 31337).then(() => setSigned(true))}
          >
            Sign in for private art
          </Button>
        )}
      </div>
      {!address && <p className="mt-8 text-muted">Connect to see cards only your wallet can read.</p>}
      {loading && <p className="mt-8 text-muted">Listening to the chain…</p>}
      {address && !loading && cards.length === 0 && <p className="mt-8 text-muted">No cards yet. The pack desk is open.</p>}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.tokenId} href={`/card/${card.tokenId}`} className="block">
            <CardView card={{ ...card, imageUrl: images[card.tokenId] }} face={false} />
            <p className="mt-2 truncate text-sm">{card.revealed ? card.name : "Sealed"}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
