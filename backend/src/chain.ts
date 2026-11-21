import { createPublicClient, createWalletClient, defineChain, http, type Abi, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abis, type Deployment } from "@pullhaus/shared";
import { config } from "./config.js";

export const abi = {
  cards: abis.cards as Abi,
  packs: abis.packs as Abi,
  rewards: abis.rewards as Abi,
  market: abis.marketplace as Abi,
  forge: abis.forge as Abi,
  vrf: abis.vrf as Abi,
  pull: abis.pull as Abi,
};

export function chainOf(deployment: Deployment) {
  return defineChain({
    id: deployment.chainId,
    name: `pullhaus-${deployment.chainId}`,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
}

export function publicClient(deployment: Deployment) {
  return createPublicClient({ chain: chainOf(deployment), transport: http(config.rpcUrl) });
}

export function keeperClient(deployment: Deployment, key: `0x${string}`) {
  const account = privateKeyToAccount(key);
  return createWalletClient({ account, chain: chainOf(deployment), transport: http(config.rpcUrl) });
}

export async function readGameCard(deployment: Deployment, tokenId: bigint) {
  const client = publicClient(deployment);
  return client.readContract({
    address: deployment.cards,
    abi: abi.cards,
    functionName: "gameCard",
    args: [tokenId],
    account: deployment.indexer as Address,
  }) as Promise<{
    rarity: number;
    level: number;
    element: number;
    atk: number;
    def: number;
    spd: number;
    ability: number;
    setId: number;
    revealed: boolean;
    seed: bigint;
  }>;
}
