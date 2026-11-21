import { encodeAbiParameters, keccak256 } from "viem";
import type { Odds } from "./constants.js";

/** Twin of `CardMath.sol`. The encoding is part of the protocol; do not drift it. */
export function mix(seed: bigint, salt: bigint): bigint {
  return BigInt(
    keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [seed, salt])),
  );
}

export type DerivedStats = {
  atk: number;
  def: number;
  spd: number;
  element: number;
  ability: number;
};

export function deriveStats(seed: bigint, rarity: number): DerivedStats {
  const a = mix(seed, 1n);
  const b = mix(seed, 2n);
  const c = mix(seed, 3n);
  const base = 30 + rarity * 18;
  const spread = 20 + rarity * 6;
  const span = BigInt(spread + 1);
  return {
    element: Number(seed % 5n),
    ability: Number(a % 12n),
    atk: base + Number(a % span),
    def: base + Number(b % span),
    spd: base + Number(c % span),
  };
}

export function scaledStat(base: number, level: number): number {
  const lv = level <= 0 ? 1 : level;
  return Math.floor((base * (100 + (lv - 1) * 8)) / 100);
}

export function rollRarity(seed: bigint, odds: Odds): number {
  const ticket = Number(mix(seed, 99n) % 10_000n);
  const cuts = [odds.common, odds.rare, odds.epic, odds.legendary, odds.mythic];
  let cum = 0;
  for (let i = 0; i < cuts.length; i++) {
    cum += cuts[i];
    if (ticket < cum) return i;
  }
  return 4;
}

export function applyTier(odds: Odds, boosts: number[], tier: number): Odds {
  const t = Math.min(4, Math.max(0, tier));
  const boost = boosts[t] ?? 0;
  if (boost === 0 || odds.common <= boost) return { ...odds };
  const toRare = Math.floor(boost / 2);
  const toEpic = Math.floor((boost * 3) / 10);
  const toLeg = boost - toRare - toEpic;
  return {
    common: odds.common - boost,
    rare: odds.rare + toRare,
    epic: odds.epic + toEpic,
    legendary: odds.legendary + toLeg,
    mythic: odds.mythic,
  };
}

export function cardSeed(randomWord: bigint, requestId: bigint, index: number): bigint {
  return BigInt(
    keccak256(
      encodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
        [randomWord, requestId, BigInt(index)],
      ),
    ),
  );
}
