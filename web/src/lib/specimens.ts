import { cardIdentity, deriveStats } from "@pullhaus/shared";
import type { DisplayCard } from "./cards";

function specimen(tokenId: string, seed: bigint, rarity: number): DisplayCard {
  const stats = deriveStats(seed, rarity);
  const identity = cardIdentity(seed, rarity, stats.element, stats.ability);
  return {
    tokenId,
    revealed: true,
    rarity,
    level: 1,
    element: stats.element,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    ability: stats.ability,
    setId: 1,
    seed: seed.toString(),
    name: identity.name,
    lore: identity.lore,
  };
}

/** Center card is the published CardMath vector: seed 1, rarity 2. These are not live pulls. */
export const SPECIMENS: DisplayCard[] = [
  specimen("11", 11n, 3),
  specimen("1", 1n, 2),
  specimen("77", 77n, 4),
];
