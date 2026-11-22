import { isDeployed, type Deployment } from "@pullhaus/shared";
import { DEFAULT_LAUNCHPAD_URL } from "./launchpad";
import { readConfiguredAddress, readConfiguredUrl, type PayId } from "./pancake";

export type TradeHints = {
  pullToken: `0x${string}` | null;
  launchpadUrl: string;
};

export type SwapMode =
  | {
      mode: "swap";
      pullToken: `0x${string}`;
      launchpadUrl: string;
      configError: string | null;
    }
  | {
      mode: "faucet";
      pullToken: null;
      launchpadUrl: string;
      configError: string | null;
      chainId: number;
    }
  | {
      mode: "soon";
      pullToken: null;
      launchpadUrl: string;
      configError: string | null;
    };

const FAUCET_CHAINS = new Set([97, 31337, 5611]);

export function tradeHintsFromConfig(body: unknown): TradeHints {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const pull = typeof record.pullTrade === "string" ? readConfiguredAddress(record.pullTrade).address : null;
  const launch = typeof record.launchpadUrl === "string" ? readConfiguredUrl(record.launchpadUrl, "") : { url: "", error: "skip" };
  const launchpadUrl = launch.error ? "" : launch.url.replace(/\/$/, "");
  return { pullToken: pull, launchpadUrl };
}

export function resolveSwapMode(deployment: Deployment, hints: TradeHints): SwapMode {
  const envPull = readConfiguredAddress(process.env.NEXT_PUBLIC_PULL_TOKEN_ADDRESS);
  const envUrl = readConfiguredUrl(process.env.NEXT_PUBLIC_LAUNCHPAD_URL, "");
  const launchpadUrl = (envUrl.error ? "" : envUrl.url || hints.launchpadUrl || DEFAULT_LAUNCHPAD_URL).replace(/\/$/, "");
  const configError = [envPull.error, envUrl.error].filter(Boolean).join(" ") || null;
  const fromGame = deployment.chainId === 56 && !deployment.mockToken && isDeployed(deployment) ? deployment.pull : null;
  const pullToken = envPull.address ?? hints.pullToken ?? fromGame;
  if (pullToken) return { mode: "swap", pullToken, launchpadUrl, configError };
  if (!envPull.error && deployment.mockToken && isDeployed(deployment) && FAUCET_CHAINS.has(deployment.chainId)) {
    return { mode: "faucet", pullToken: null, launchpadUrl, configError, chainId: deployment.chainId };
  }
  return { mode: "soon", pullToken: null, launchpadUrl, configError };
}

export function networkLabel(chainId: number) {
  if (chainId === 97) return "BNB Smart Chain testnet";
  if (chainId === 31337) return "the local Anvil chain";
  if (chainId === 5611) return "opBNB testnet";
  if (chainId === 56) return "BNB Smart Chain";
  return `chain ${chainId}`;
}

export function inputCurrency(id: PayId, address: `0x${string}` | null): `0x${string}` | "BNB" {
  return id === "bnb" || !address ? "BNB" : address;
}
