import type { Address } from "viem";

export type Deployment = {
  chainId: number;
  pull: Address;
  cards: Address;
  rewards: Address;
  packs: Address;
  marketplace: Address;
  forge: Address;
  vrfCoordinator: Address;
  admin: Address;
  indexer: Address;
  keeper: Address;
  treasury: Address;
  mockVrf: boolean;
  mockToken: boolean;
  localTools: boolean;
  blockNumber: number;
};

export const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export function emptyDeployment(chainId = 31337): Deployment {
  return {
    chainId,
    pull: ZERO,
    cards: ZERO,
    rewards: ZERO,
    packs: ZERO,
    marketplace: ZERO,
    forge: ZERO,
    vrfCoordinator: ZERO,
    admin: ZERO,
    indexer: ZERO,
    keeper: ZERO,
    treasury: ZERO,
    mockVrf: true,
    mockToken: true,
    localTools: chainId === 31337,
    blockNumber: 0,
  };
}

export function isDeployed(d: Deployment | null | undefined): d is Deployment {
  return Boolean(d && d.pull !== ZERO && d.packs !== ZERO);
}
