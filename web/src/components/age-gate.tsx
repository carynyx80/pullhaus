"use client";

import { useEffect, useState } from "react";
import { Mark } from "./mark";
import { Button } from "./ui/button";

export function AgeGate() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(localStorage.getItem("pullhaus-age") !== "yes");
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#070605]/92 px-6 backdrop-blur-md">
      <div className="glass w-full max-w-md rounded-[32px] p-8">
        <Mark size={72} />
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">Before the door</p>
        <h2 className="mt-3 font-display text-4xl text-ink">This atelier is 18+.</h2>
        <p className="mt-4 text-sm leading-6 text-muted">
          Pullhaus is entertainment. Burn points are perks inside the game. They are not wages, not a promise of profit,
          and not a cash prize. Odds are published on the odds page before you spend a token.
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            onClick={() => {
              localStorage.setItem("pullhaus-age", "yes");
              setOpen(false);
            }}
          >
            I am 18 or older
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "https://www.bnbchain.org")}>
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}
