"use client";

import { abis, RARITIES, RARITY_COLORS } from "@pullhaus/shared";
import { motion } from "framer-motion";
import type { Abi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { isDeployed, useHouse } from "@/lib/house";

function five(value: any): number[] {
  if (!value) return [6200, 2600, 1000, 200, 0];
  if (Array.isArray(value)) return value.map(Number);
  return [value.common, value.rare, value.epic, value.legendary, value.mythic].map(Number);
}

export default function OddsPage() {
  const { deployment } = useHouse();
  const { address } = useAccount();
  const base = useReadContract({ address: deployment.packs, abi: abis.packs as Abi, functionName: "baseOdds", query: { enabled: isDeployed(deployment) } });
  const mine = useReadContract({
    address: deployment.packs,
    abi: abis.packs as Abi,
    functionName: "oddsFor",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && isDeployed(deployment)) },
  });
  const rows = five(mine.data || base.data);
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Published odds</p>
      <h1 className="mt-2 font-display text-5xl">The table is public.</h1>
      <p className="mt-4 text-muted">
        These weights are stored on the pack contract and can be read by anyone before a token is spent. Mythic stays at zero in the standard table. Mythic cards are forged by sacrificing legendaries or by a large burn. A tier shifts weight out of common toward rare, epic, and legendary. It does not create a hidden prize.
      </p>
      <div className="mt-8 space-y-4">
        {RARITIES.map((name, index) => (
          <div key={name}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{name}</span>
              <span>{(rows[index] / 100).toFixed(2)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full" style={{ background: RARITY_COLORS[index] }} initial={{ width: 0 }} animate={{ width: `${rows[index] / 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted">
        18+ entertainment. Burn points and epoch claims are perks funded by disclosed splits. They are not wages and not an offer of profit. Operators can block countries with an environment list.
      </p>
    </section>
  );
}
