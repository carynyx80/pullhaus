"use client";

import { resolveBattle, type Fighter } from "@pullhaus/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useMyCards, type DisplayCard } from "@/lib/cards";

function fighter(card: DisplayCard): Fighter {
  return {
    id: card.tokenId,
    name: card.name,
    atk: card.atk,
    def: card.def,
    spd: card.spd,
    element: card.element,
    ability: card.ability,
    level: card.level,
    seed: BigInt(card.seed || "0"),
  };
}

export default function BattlePage() {
  const { cards } = useMyCards();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [winner, setWinner] = useState("");

  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Arena</p>
      <h1 className="mt-2 font-display text-5xl">Two cards. One seed.</h1>
      <p className="mt-3 text-muted">The winner is fixed by stats, level, element, and the card seeds. Narration can be rewritten by a model. It cannot change the result.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Select label="Your card" value={a} onChange={setA} cards={cards} />
        <Select label="Opponent" value={b} onChange={setB} cards={cards} />
      </div>
      <Button
        className="mt-6"
        disabled={!a || !b || a === b}
        onClick={async () => {
          const left = cards.find((card) => card.tokenId === a);
          const right = cards.find((card) => card.tokenId === b);
          if (!left || !right) return;
          const local = resolveBattle(fighter(left), fighter(right));
          try {
            const remote = await api<{ result: { narration: string; rounds: { line: string }[]; winnerId: string } }>("/battles", {
              method: "POST",
              body: JSON.stringify({ attackerId: a, defenderId: b }),
            });
            setLines(remote.result.narration.split(/(?<=\.)\s+/));
            setWinner(remote.result.winnerId);
          } catch {
            setLines(local.rounds.map((round) => round.line));
            setWinner(local.winnerId);
          }
        }}
      >
        Begin
      </Button>
      {winner && (
        <div className="mt-8 space-y-3">
          <p className="font-display text-3xl">Card #{winner} keeps the floor.</p>
          {lines.map((line, index) => (
            <p key={index} className="glass rounded-2xl px-4 py-3 text-muted">{line}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function Select({ label, value, onChange, cards }: { label: string; value: string; onChange: (value: string) => void; cards: DisplayCard[] }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <select className="mt-1 h-11 w-full rounded-2xl border border-line bg-black/30 px-3 text-ink" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {cards.map((card) => (
          <option key={card.tokenId} value={card.tokenId}>#{card.tokenId} {card.name}</option>
        ))}
      </select>
    </label>
  );
}
