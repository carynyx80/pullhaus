"use client";

import { TIERS } from "@pullhaus/shared";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { pull, short } from "@/lib/utils";

type Row = { rank: number; address: string; points: string; tier: number };

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [season, setSeason] = useState(1);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ season: number; rows: Row[] }>("/leaderboard")
      .then((body) => {
        setSeason(body.season);
        setRows(body.rows);
      })
      .catch(() => setError("The board is waiting on the indexer."));
  }, []);
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Season {season}</p>
      <h1 className="mt-2 font-display text-5xl">Who burned.</h1>
      <p className="mt-3 text-muted">A season board of burn points. It is a leaderboard of perks, not a payout table.</p>
      {error && <p className="mt-6 text-muted">{error}</p>}
      <ol className="mt-8 space-y-2">
        {rows.length === 0 && !error && <li className="text-muted">No burns in this season yet.</li>}
        {rows.map((row) => (
          <li key={row.address} className="glass flex items-center justify-between rounded-2xl px-4 py-3">
            <span className="text-gold">#{row.rank}</span>
            <span>{short(row.address)}</span>
            <span className="text-muted">{TIERS[row.tier]?.name}</span>
            <span className="font-display text-2xl">{pull(row.points)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
