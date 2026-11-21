"use client";

import { abis, ABILITIES, ELEMENTS, RARITIES } from "@pullhaus/shared";
import type { Abi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CardView } from "@/components/card-view";
import { Button } from "@/components/ui/button";
import { toDisplay } from "@/lib/cards";
import { isDeployed, useHouse } from "@/lib/house";
import { api } from "@/lib/api";
import { useSend } from "@/lib/tx";

export default function CardPage() {
  const params = useParams<{ id: string }>();
  const { deployment } = useHouse();
  const { address } = useAccount();
  const send = useSend();
  const [image, setImage] = useState<string | null>(null);
  const mine = useReadContract({
    address: deployment.cards,
    abi: abis.cards as Abi,
    functionName: "ownerCard",
    args: [BigInt(params.id || "0")],
    account: address,
    query: { enabled: Boolean(address && isDeployed(deployment) && params.id) },
  });
  const pub = useReadContract({
    address: deployment.cards,
    abi: abis.cards as Abi,
    functionName: "publicCard",
    args: [BigInt(params.id || "0")],
    query: { enabled: isDeployed(deployment) && Boolean(params.id) },
  });
  const source = (mine.data as any) || null;
  const visible = source || (pub.data as any);
  const card = visible?.exists === false ? null : visible ? toDisplay(params.id, visible, image) : null;

  useEffect(() => {
    if (!params.id) return;
    api<{ card: { imageUrl?: string; lore?: string; name?: string } | null }>(`/cards/${params.id}/private`)
      .then((body) => setImage(body.card?.imageUrl || null))
      .catch(() => api<{ card: { imageUrl?: string } | null }>(`/cards/${params.id}`).then((body) => setImage(body.card?.imageUrl || null)).catch(() => {}));
  }, [params.id]);

  if (!card) return <section className="px-4 py-16 text-muted">This card is not on the desk.</section>;
  const ownerView = Boolean(source);
  return (
    <section className="mx-auto grid max-w-5xl gap-8 px-4 py-14 md:grid-cols-[320px_1fr]">
      <CardView card={card} face={ownerView || card.revealed} />
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">{card.revealed ? "Revealed" : ownerView ? "Private view" : "Sealed"}</p>
        <h1 className="mt-2 font-display text-5xl">{ownerView || card.revealed ? card.name : "Sealed card"}</h1>
        {(ownerView || card.revealed) && (
          <>
            <p className="mt-4 max-w-xl text-muted">{card.lore}</p>
            <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
              <Stat label="ATK" value={card.atk} />
              <Stat label="DEF" value={card.def} />
              <Stat label="SPD" value={card.spd} />
            </dl>
            <p className="mt-4 text-sm text-muted">
              {RARITIES[card.rarity]} · {ELEMENTS[card.element]} · {ABILITIES[card.ability]} · level {card.level}
            </p>
          </>
        )}
        {ownerView && !card.revealed && (
          <Button className="mt-6" onClick={() => send("Revealing", { address: deployment.cards, abi: abis.cards as Abi, functionName: "reveal", args: [BigInt(card.tokenId)] }).then(() => mine.refetch())}>
            Reveal onchain
          </Button>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-3">
      <dt className="text-xs uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className="font-display text-3xl">{value}</dd>
    </div>
  );
}
