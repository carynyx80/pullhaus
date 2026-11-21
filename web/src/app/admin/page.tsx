"use client";

import { abis } from "@pullhaus/shared";
import type { Abi } from "viem";
import { useState } from "react";
import { useReadContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { isDeployed, useHouse } from "@/lib/house";
import { useSend } from "@/lib/tx";

export default function AdminPage() {
  const { deployment } = useHouse();
  const send = useSend();
  const ready = isDeployed(deployment);
  const paused = useReadContract({ address: deployment.packs, abi: abis.packs as Abi, functionName: "paused", query: { enabled: ready } });
  const [odds, setOdds] = useState(["6200", "2600", "1000", "200", "0"]);
  const sum = odds.reduce((total, item) => total + Number(item || 0), 0);
  const targets = [
    ["Packs", deployment.packs, abis.packs],
    ["Market", deployment.marketplace, abis.marketplace],
    ["Forge", deployment.forge, abis.forge],
    ["Rewards", deployment.rewards, abis.rewards],
  ] as const;

  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Admin</p>
      <h1 className="mt-2 font-display text-5xl">The house rules.</h1>
      <p className="mt-3 text-muted">Only the admin role can change these. Packs are {paused.data ? "paused" : "open"}.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {targets.map(([label, address, abi]) => (
          <span key={label} className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => send(`Pausing ${label}`, { address, abi: abi as Abi, functionName: "pause" }).then(() => paused.refetch())}>
              Pause {label}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => send(`Unpausing ${label}`, { address, abi: abi as Abi, functionName: "unpause" })}>
              Unpause
            </Button>
          </span>
        ))}
      </div>
      <form
        className="glass mt-8 rounded-3xl p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const [common, rare, epic, legendary, mythic] = odds.map(Number);
          await send("Setting odds", {
            address: deployment.packs,
            abi: abis.packs as Abi,
            functionName: "setOdds",
            args: [{ common, rare, epic, legendary, mythic }],
          });
        }}
      >
        <Label>Odds in basis points · sum {sum}</Label>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {odds.map((value, index) => (
            <Input key={index} value={value} onChange={(event) => setOdds(odds.map((item, i) => (i === index ? event.target.value : item)))} />
          ))}
        </div>
        <Button className="mt-4" type="submit" disabled={sum !== 10000}>
          Publish odds
        </Button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => send("Starting epoch", { address: deployment.rewards, abi: abis.rewards as Abi, functionName: "startEpoch", args: [7n * 24n * 60n * 60n] })}>
          Start 7-day epoch
        </Button>
        <Button variant="outline" onClick={() => send("Next season", { address: deployment.rewards, abi: abis.rewards as Abi, functionName: "advanceSeason" })}>
          Advance season
        </Button>
      </div>
    </section>
  );
}
