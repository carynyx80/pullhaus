"use client";

import { abis, isDeployed } from "@pullhaus/shared";
import type { Abi } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { useHouse } from "./house";

/** Figures written in the Solidity sources. Live reads replace these when the deployment answers. */
export const CONTRACT_DEFAULTS = {
  burnBps: 5_000,
  rewardBps: 3_000,
  treasuryBps: 2_000,
  marketFeeBps: 500,
  odds: [6200, 2600, 1000, 200, 0],
  tierBoostBps: [0, 150, 300, 500, 800],
  /** PullhausRewards constructor, before the deploy script overwrites them. */
  constructorTiersPull: [100, 300, 800, 2_000],
  /** Deploy.s.sol on every chain other than Anvil, unless TIER1–TIER4 are set. */
  publicTiersPull: [1_000, 10_000, 50_000, 200_000],
  upgradeBasePull: 50,
  fuseBasePull: 75,
  /** Forge constructor and the deploy-script default off Anvil. Anvil uses 500 unless MYTHIC_BURN is set. */
  publicMythicPull: 25_000,
  anvilMythicPull: 500,
  anvilEpochSeconds: 60 * 60,
  publicEpochSeconds: 7 * 24 * 60 * 60,
} as const;

export type Share = { burnBps: number; rewardBps: number; treasuryBps: number; live: boolean };

export type EconomicsView = {
  pack: Share;
  forge: Share;
  market: Share & { feeBps: number };
  odds: { values: number[]; live: boolean };
  boosts: { values: number[]; live: boolean };
  tiers: { wei: bigint[]; live: boolean };
  costs: { upgrade: bigint; fuse: bigint; mythic: bigint; live: boolean } | null;
  epochSeconds: number | null;
};

function asBig(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  return null;
}

function asNum(value: unknown): number | null {
  const big = asBig(value);
  if (big === null) return null;
  const num = Number(big);
  return Number.isFinite(num) ? num : null;
}

function asNums(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const nums = value.map(asNum);
    return nums.every((item) => item !== null) ? (nums as number[]) : null;
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if ("common" in row) return asNums([row.common, row.rare, row.epic, row.legendary, row.mythic]);
  }
  return null;
}

type CallResult = { status: string; result?: unknown };

function okNum(call: CallResult | undefined) {
  if (!call || call.status !== "success") return null;
  return asNum(call.result);
}

function okBig(call: CallResult | undefined) {
  if (!call || call.status !== "success") return null;
  return asBig(call.result);
}

const fallbackShare = { burnBps: CONTRACT_DEFAULTS.burnBps, rewardBps: CONTRACT_DEFAULTS.rewardBps, treasuryBps: CONTRACT_DEFAULTS.treasuryBps, live: false };

export function useEconomics(): EconomicsView {
  const { deployment } = useHouse();
  const ready = isDeployed(deployment);
  const chainId = deployment.chainId;
  const calls = useReadContracts({
    contracts: ready
      ? [
          call(deployment.packs, abis.packs, "burnBps", chainId),
          call(deployment.packs, abis.packs, "rewardBps", chainId),
          call(deployment.packs, abis.packs, "treasuryBps", chainId),
          call(deployment.marketplace, abis.marketplace, "feeBps", chainId),
          call(deployment.marketplace, abis.marketplace, "burnBps", chainId),
          call(deployment.marketplace, abis.marketplace, "rewardBps", chainId),
          call(deployment.marketplace, abis.marketplace, "treasuryBps", chainId),
          call(deployment.forge, abis.forge, "burnBps", chainId),
          call(deployment.forge, abis.forge, "rewardBps", chainId),
          call(deployment.forge, abis.forge, "treasuryBps", chainId),
          call(deployment.packs, abis.packs, "tierBoostsView", chainId),
          call(deployment.packs, abis.packs, "baseOdds", chainId),
          call(deployment.rewards, abis.rewards, "tierThresholds", chainId, [1n]),
          call(deployment.rewards, abis.rewards, "tierThresholds", chainId, [2n]),
          call(deployment.rewards, abis.rewards, "tierThresholds", chainId, [3n]),
          call(deployment.rewards, abis.rewards, "tierThresholds", chainId, [4n]),
          call(deployment.forge, abis.forge, "upgradeBase", chainId),
          call(deployment.forge, abis.forge, "fuseBase", chainId),
          call(deployment.forge, abis.forge, "mythicBurnPrice", chainId),
          call(deployment.rewards, abis.rewards, "currentEpoch", chainId),
        ]
      : [],
    query: { enabled: ready },
  });
  const rows = (calls.data ?? []) as CallResult[];
  const pack = shareAt(rows, 0);
  const fee = okNum(rows[3]);
  const marketShare = shareAt(rows, 4);
  const forge = shareAt(rows, 7);
  const market: EconomicsView["market"] =
    marketShare.live && fee !== null ? { ...marketShare, feeBps: fee } : { ...fallbackShare, feeBps: CONTRACT_DEFAULTS.marketFeeBps };
  const boosts = asNums(rows[10]?.status === "success" ? rows[10].result : null);
  const odds = asNums(rows[11]?.status === "success" ? rows[11].result : null);
  const tierWei = [12, 13, 14, 15].map((index) => okBig(rows[index]));
  const tiersLive = tierWei.every((item) => item !== null);
  const upgrade = okBig(rows[16]);
  const fuse = okBig(rows[17]);
  const mythic = okBig(rows[18]);
  const epochId = okBig(rows[19]);
  const epoch = useReadContract({
    address: deployment.rewards,
    abi: abis.rewards as Abi,
    chainId,
    functionName: "epochs",
    args: [epochId ?? 0n],
    query: { enabled: ready && epochId !== null && epochId > 0n },
  });
  const bounds = epochBounds(epoch.data);
  const epochSeconds = bounds.start !== null && bounds.end !== null && bounds.end > bounds.start ? Number(bounds.end - bounds.start) : null;

  return {
    pack,
    forge,
    market,
    odds: { values: odds ?? [...CONTRACT_DEFAULTS.odds], live: odds !== null },
    boosts: { values: boosts ?? [...CONTRACT_DEFAULTS.tierBoostBps], live: boosts !== null },
    tiers: { wei: tiersLive ? (tierWei as bigint[]) : [], live: tiersLive },
    costs: upgrade !== null && fuse !== null && mythic !== null ? { upgrade, fuse, mythic, live: true } : null,
    epochSeconds,
  };
}

function call(address: `0x${string}`, abi: unknown, functionName: string, chainId: number, args?: readonly unknown[]) {
  const base = { address, abi: abi as Abi, functionName, chainId };
  return args ? { ...base, args } : base;
}

function epochBounds(value: unknown) {
  if (Array.isArray(value)) return { start: asBig(value[0]), end: asBig(value[1]) };
  if (value && typeof value === "object") {
    const row = value as { start?: unknown; end?: unknown };
    return { start: asBig(row.start), end: asBig(row.end) };
  }
  return { start: null, end: null };
}

function shareAt(rows: CallResult[], index: number): Share {
  const burnBps = okNum(rows[index]);
  const rewardBps = okNum(rows[index + 1]);
  const treasuryBps = okNum(rows[index + 2]);
  if (burnBps === null || rewardBps === null || treasuryBps === null) return fallbackShare;
  return { burnBps, rewardBps, treasuryBps, live: true };
}

/** Integer split matching PullSettle.amounts, on a whole-token example. */
export function splitAmount(amount: number, burnBps: number, rewardBps: number) {
  const burn = Math.floor((amount * burnBps) / 10_000);
  const reward = Math.floor((amount * rewardBps) / 10_000);
  const treasury = amount - burn - reward;
  return { burn, reward, treasury };
}

export function formatDuration(seconds: number) {
  if (seconds % (24 * 60 * 60) === 0) {
    const days = seconds / (24 * 60 * 60);
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (seconds % (60 * 60) === 0) {
    const hours = seconds / (60 * 60);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (seconds % 60 === 0) return `${seconds / 60} minutes`;
  return `${seconds.toLocaleString()} seconds`;
}

export function formatPullNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function bpsLabel(bps: number) {
  return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
