"use client";

import { abis, cardIdentity, scaledStat } from "@pullhaus/shared";
import { useMemo } from "react";
import type { Abi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { isDeployed, useHouse } from "./house";

export type DisplayCard = {
  tokenId: string;
  revealed: boolean;
  rarity: number;
  level: number;
  element: number;
  atk: number;
  def: number;
  spd: number;
  ability: number;
  setId: number;
  seed: string;
  name: string;
  lore: string;
  imageUrl?: string | null;
};

export function toDisplay(id: bigint | string, card: any, imageUrl?: string | null): DisplayCard {
  const seed = BigInt(card.seed ?? 0);
  const rarity = Number(card.rarity ?? 0);
  const level = Number(card.level || 1);
  const element = Number(card.element ?? 0);
  const ability = Number(card.ability ?? 0);
  const identity = cardIdentity(seed, rarity, element, ability);
  return {
    tokenId: id.toString(),
    revealed: Boolean(card.revealed),
    rarity,
    level,
    element,
    atk: scaledStat(Number(card.atk ?? 0), level),
    def: scaledStat(Number(card.def ?? 0), level),
    spd: scaledStat(Number(card.spd ?? 0), level),
    ability,
    setId: Number(card.setId ?? 0),
    seed: seed.toString(),
    name: card.name || identity.name,
    lore: card.lore || identity.lore,
    imageUrl,
  };
}

export function useMyCards() {
  const { address } = useAccount();
  const { deployment } = useHouse();
  const enabled = Boolean(address && isDeployed(deployment));
  const query = useReadContract({
    address: deployment.cards,
    abi: abis.cards as Abi,
    functionName: "myCards",
    account: address,
    query: { enabled, refetchInterval: 4000 },
  });
  const cards = useMemo(() => {
    const data = query.data as any;
    if (!data) return [] as DisplayCard[];
    const ids: bigint[] = data.ids ?? data[0] ?? [];
    const rows: any[] = data.cards_ ?? data.cards ?? data[1] ?? [];
    return ids.map((id, index) => toDisplay(id, rows[index]));
  }, [query.data]);
  return { cards, refetch: query.refetch, loading: enabled && query.isLoading };
}
