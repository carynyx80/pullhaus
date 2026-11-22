"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { pull, short } from "@/lib/utils";

const HOUSE = ["Burn", "Pull", "Reveal", "Seal", "Forge", "Common", "Rare", "Epic", "Legendary", "Mythic is fused"];

type Row = { address: string; points: string };

export function LiveTicker() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<{ rows: Row[] }>("/leaderboard")
      .then((body) => setRows(body.rows ?? []))
      .catch(() => {
        setRows([]);
        setFailed(true);
      });
  }, []);

  const live = Boolean(rows && rows.length > 0);
  const items = live ? rows!.map((row) => `${short(row.address)} burned ${pull(row.points)}`) : HOUSE;
  const line = items.join("   ·   ");
  const label = live ? "Live season burns" : failed ? "House line" : rows ? "House line · no season burns yet" : "House line";

  return (
    <div className="flex items-center gap-4 overflow-hidden border-y border-line bg-black/35 py-3">
      <p className="shrink-0 pl-4 font-mono text-[10px] uppercase tracking-[0.28em] text-gold sm:pl-6">{label}</p>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="ticker-track flex w-max gap-10 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.22em] text-ink/80">
          <span>{line}</span>
          <span aria-hidden="true">{line}</span>
        </div>
      </div>
    </div>
  );
}
