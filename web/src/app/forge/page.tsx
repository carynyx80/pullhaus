"use client";

import { abis, RARITIES } from "@pullhaus/shared";
import type { Abi } from "viem";
import { useState } from "react";
import { useReadContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { useMyCards } from "@/lib/cards";
import { isDeployed, useHouse } from "@/lib/house";
import { useSend } from "@/lib/tx";
import { pull } from "@/lib/utils";

export default function ForgePage() {
  const { deployment } = useHouse();
  const { cards, refetch } = useMyCards();
  const send = useSend();
  const [keep, setKeep] = useState<string>("");
  const [burn, setBurn] = useState<string>("");
  const [picked, setPicked] = useState<string[]>([]);
  const costs = useReadContract({
    address: deployment.forge,
    abi: abis.forge as Abi,
    functionName: "upgradeBase",
    query: { enabled: isDeployed(deployment) },
  });
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((item) => item !== id) : [...cur, id].slice(0, 3)));

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Forge</p>
      <h1 className="mt-2 font-display text-5xl">Spend a duplicate. Or three.</h1>
      <p className="mt-3 max-w-xl text-muted">
        Upgrade burns one matching card and some $PULL to raise a level. Fusion burns three cards of the same rarity below legendary, two legendaries, or one legendary plus a large burn, and mints the next rarity sealed. Mythic does not come from packs.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <button key={card.tokenId} onClick={() => toggle(card.tokenId)} className={`rounded-3xl border p-3 text-left ${picked.includes(card.tokenId) ? "border-gold" : "border-line"}`}>
            <p className="font-display text-xl">{card.name}</p>
            <p className="text-sm text-muted">{RARITIES[card.rarity]} · lv {card.level} · #{card.tokenId}</p>
          </button>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          disabled={picked.length !== 2}
          onClick={async () => {
            const [a, b] = picked;
            setKeep(a);
            setBurn(b);
            await send("Upgrading", { address: deployment.forge, abi: abis.forge as Abi, functionName: "upgrade", args: [BigInt(a), BigInt(b)] });
            setPicked([]);
            refetch();
          }}
        >
          Upgrade pair
        </Button>
        <Button
          variant="gold"
          disabled={picked.length < 1}
          onClick={async () => {
            await send("Fusing", { address: deployment.forge, abi: abis.forge as Abi, functionName: "fuse", args: [picked.map((id) => BigInt(id))] });
            setPicked([]);
            refetch();
          }}
        >
          Fuse selection
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted">Upgrade base {pull(costs.data as bigint)} $PULL × current level. Select exactly two cards to upgrade, or 1–3 to fuse.</p>
      {(keep || burn) && <p className="text-sm text-muted">Last upgrade kept #{keep} and burned #{burn}.</p>}
    </section>
  );
}
