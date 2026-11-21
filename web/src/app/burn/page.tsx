"use client";

import { abis, TIERS } from "@pullhaus/shared";
import { useEffect, useState } from "react";
import type { Abi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { isDeployed, useHouse } from "@/lib/house";
import { useSend } from "@/lib/tx";
import { pull } from "@/lib/utils";

function Counter({ value }: { value: number }) {
  const [label, setLabel] = useState("0");
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const exact = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 800);
      const eased = 1 - (1 - p) ** 3;
      setLabel(p === 1 ? exact : (value * eased).toLocaleString(undefined, { maximumFractionDigits: 0 }));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span>{label}</span>;
}

export default function BurnPage() {
  const { address } = useAccount();
  const { deployment } = useHouse();
  const send = useSend();
  const ready = Boolean(address && isDeployed(deployment));
  const points = useReadContract({ address: deployment.rewards, abi: abis.rewards as Abi, functionName: "lifetimePoints", args: address ? [address] : undefined, query: { enabled: ready } });
  const tier = useReadContract({ address: deployment.rewards, abi: abis.rewards as Abi, functionName: "tierOf", args: address ? [address] : undefined, query: { enabled: ready } });
  const epochId = useReadContract({ address: deployment.rewards, abi: abis.rewards as Abi, functionName: "currentEpoch", query: { enabled: isDeployed(deployment) } });
  const id = (epochId.data as bigint | undefined) ?? 0n;
  const epoch = useReadContract({ address: deployment.rewards, abi: abis.rewards as Abi, functionName: "epochs", args: [id], query: { enabled: isDeployed(deployment) && id > 0n } });
  const claimable = useReadContract({ address: deployment.rewards, abi: abis.rewards as Abi, functionName: "claimable", args: [id, address!], query: { enabled: ready && id > 0n } });
  const local = useReadContract({ address: deployment.rewards, abi: abis.rewards as Abi, functionName: "localTools", query: { enabled: isDeployed(deployment) } });
  const tierIndex = Number(tier.data ?? 0);
  const info = TIERS[tierIndex] ?? TIERS[0];
  const epochRow: any = epoch.data;
  const finalized = Boolean(epochRow?.finalized ?? epochRow?.[5]);
  const pool = epochRow?.pool ?? epochRow?.[2];

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Burn desk</p>
      <h1 className="mt-2 font-display text-5xl">Points, then perks.</h1>
      <p className="mt-3 max-w-xl text-muted">A burn point is a record of tokens that left circulation. The epoch pool only pays out tokens that pack sales and fees actually deposited.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="glass rounded-[28px] p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Lifetime burn</p>
          <p className="mt-3 font-display text-5xl"><Counter value={Number(pull(points.data as bigint).replace(/,/g, ""))} /></p>
          <p className="text-muted">$PULL burned</p>
        </article>
        <article className="glass rounded-[28px] p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Tier</p>
          <p className="mt-3 font-display text-5xl">{info.name}</p>
          <p className="text-muted">{info.perk}</p>
        </article>
        <article className="glass rounded-[28px] p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Epoch {id.toString()}</p>
          <p className="mt-3 font-display text-5xl">{pull(pool)}</p>
          <p className="text-muted">{finalized ? "Finalized" : "Open"} · claimable {pull(claimable.data as bigint)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={!claimable.data || claimable.data === 0n}
              onClick={() => send("Claiming", { address: deployment.rewards, abi: abis.rewards as Abi, functionName: "claim", args: [id] }).then(() => claimable.refetch())}
            >
              Claim
            </Button>
            {Boolean(local.data) && (
              <Button variant="outline" onClick={() => send("Ending epoch", { address: deployment.rewards, abi: abis.rewards as Abi, functionName: "debugEndEpoch" }).then(() => epoch.refetch())}>
                End epoch
              </Button>
            )}
            <Button variant="ghost" onClick={() => send("Finalizing", { address: deployment.rewards, abi: abis.rewards as Abi, functionName: "finalizeEpoch", args: [id] }).then(() => epoch.refetch())}>
              Finalize
            </Button>
          </div>
        </article>
      </div>
      <ol className="mt-8 grid gap-3 md:grid-cols-5">
        {TIERS.map((item) => (
          <li key={item.id} className={`rounded-2xl border p-4 ${item.id === tierIndex ? "border-gold" : "border-line"}`}>
            <p className="font-display text-2xl">{item.name}</p>
            <p className="text-xs text-muted">{item.perk}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
