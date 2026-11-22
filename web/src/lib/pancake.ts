import {
  BaseError,
  ContractFunctionRevertedError,
  type Address,
  type PublicClient,
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
} from "viem";

/**
 * Verified against BNB Smart Chain (chain id 56) on 2026-11-21.
 *
 * PancakeSwap V2 router `0x10ED43C718714eb63d5aA57B78B54704E256024E`:
 * `WETH()` returns WBNB `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`,
 * and `factory()` returns the V2 factory `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73`.
 *
 * USDT `0x55d398326f99059fF775485246999027B3197955`: name "Tether USD", symbol USDT, 18 decimals.
 * USDC `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`: name "USD Coin", symbol USDC, 18 decimals.
 * The nearby address ending in `970B32Cd580` has no contract code, so it is not used.
 *
 * Flap.sh (docs.flap.sh): a token trades on the Portal bonding curve until 80% of
 * supply is sold, then migrates. Tax tokens (address ends in 7777) migrate to a
 * PancakeSwap V2 pool. Non-tax tokens (address ends in 8888) migrate to a
 * PancakeSwap Infinity CL pool. This desk calls the V2 router only after
 * factory.getPair and pair.getReserves show liquidity on both sides.
 * V2 factory `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73`.
 */
export const PANCAKE_V2_ROUTER = getAddress("0x10ED43C718714eb63d5aA57B78B54704E256024E");
export const PANCAKE_V2_FACTORY = getAddress("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73");
export const BSC_USDT = getAddress("0x55d398326f99059fF775485246999027B3197955");
export const BSC_USDC = getAddress("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d");

export const BSC_CHAIN_ID = 56;
export const DEFAULT_SLIPPAGE_BPS = 50;
export const MAX_SLIPPAGE_BPS = 5_000;
export const SLIPPAGE_PRESETS = [10, 50, 100] as const;
export const SWAP_DEADLINE_SECONDS = 20 * 60;
/** Left untouched when a user taps Max, so the transaction still has gas. */
export const BNB_GAS_RESERVE = parseUnits("0.003", 18);

export const routerAbi = [
  {
    type: "function",
    name: "WETH",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactETHForTokensSupportingFeeOnTransferTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const factoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;

export const pairAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
] as const;

export const payTokens = [
  { id: "bnb", symbol: "BNB", address: null, blurb: "Native coin" },
  { id: "usdt", symbol: "USDT", address: BSC_USDT, blurb: "Binance-Peg Tether" },
  { id: "usdc", symbol: "USDC", address: BSC_USDC, blurb: "Binance-Peg USD Coin" },
] as const;

export type PayId = (typeof payTokens)[number]["id"];

export function payToken(id: PayId) {
  return payTokens.find((token) => token.id === id) ?? payTokens[0];
}

export function normalizeAddress(value: string | null | undefined): Address | null {
  const raw = value?.trim() ?? "";
  if (!raw || !isAddress(raw)) return null;
  const address = getAddress(raw);
  if (address === zeroAddress) return null;
  return address;
}

export function readConfiguredAddress(raw: string | undefined): { address: Address | null; error: string | null } {
  const value = raw?.trim() ?? "";
  if (!value) return { address: null, error: null };
  const address = normalizeAddress(value);
  if (!address) return { address: null, error: "The configured $PULL address is not a valid token address." };
  return { address, error: null };
}

export function readConfiguredUrl(raw: string | undefined, fallback: string): { url: string; error: string | null } {
  const value = raw?.trim() ?? "";
  if (!value) return { url: fallback, error: null };
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return { url: fallback, error: "The launchpad link must start with https." };
    return { url: url.toString(), error: null };
  } catch {
    return { url: fallback, error: "The launchpad link is not a valid URL." };
  }
}

export function pancakeSwapUrl(output: Address, input: Address | "BNB" = "BNB") {
  const params = new URLSearchParams({
    chain: "bsc",
    outputCurrency: output,
    inputCurrency: input,
  });
  return `https://pancakeswap.finance/swap?${params.toString()}`;
}

/** Percent text ("0.5") to basis points (50). Two decimal places max. 50% is the ceiling. */
export function percentToBps(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 2) return null;
  const bps = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_SLIPPAGE_BPS) return null;
  return bps;
}

export function bpsToPercentLabel(bps: number) {
  const pct = bps / 100;
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

export function minReceived(quoted: bigint, slippageBps: number) {
  const bps = Math.round(slippageBps);
  if (bps < 0 || bps > MAX_SLIPPAGE_BPS) throw new Error("Slippage is out of range.");
  return (quoted * BigInt(10_000 - bps)) / 10_000n;
}

export function plainAmount(value: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toString();
  const digits = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${digits}`;
}

export function amountProblem(text: string, decimals: number) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return "Use a plain number.";
  if ((trimmed.split(".")[1]?.length ?? 0) > decimals) return `Use at most ${decimals} decimal places.`;
  if (parseAmount(trimmed, decimals) === 0n) return "Enter an amount greater than zero.";
  return null;
}

export function parseAmount(text: string, decimals: number): bigint | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const fraction = trimmed.split(".")[1] ?? "";
  if (fraction.length > decimals) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

export function formatAmount(value: bigint, decimals: number, maxFraction = 6) {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (fraction === 0n || maxFraction <= 0) return `${negative ? "-" : ""}${wholeText}`;
  const digits = fraction.toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  if (!digits) {
    const tiny = fraction > 0n;
    return tiny ? `<0.${"0".repeat(Math.max(0, maxFraction - 1))}1` : wholeText;
  }
  return `${negative ? "-" : ""}${wholeText}.${digits}`;
}

export type Quote =
  | { ok: true; amountOut: bigint; path: Address[]; impactBps: number | null }
  | { ok: false; reason: "no-route" | "rpc" };

type Reader = Pick<PublicClient, "readContract">;

function errorBlob(error: unknown) {
  if (!error || typeof error !== "object") return String(error ?? "");
  const record = error as { name?: unknown; message?: unknown; shortMessage?: unknown };
  return `${String(record.name ?? "")} ${String(record.shortMessage ?? "")} ${String(record.message ?? "")}`;
}

function failureKind(error: unknown): "revert" | "rpc" {
  if (error instanceof BaseError) {
    const revert = error.walk((item) => item instanceof ContractFunctionRevertedError);
    if (revert) return "revert";
  }
  return /reverted|insufficient_output|excessive_input/i.test(errorBlob(error)) ? "revert" : "rpc";
}

async function readOut(client: Reader, amountIn: bigint, path: Address[]): Promise<{ out: bigint } | { kind: "revert" | "rpc" }> {
  try {
    const amounts = (await client.readContract({
      address: PANCAKE_V2_ROUTER,
      abi: routerAbi,
      functionName: "getAmountsOut",
      args: [amountIn, path],
    })) as readonly bigint[];
    const out = amounts[amounts.length - 1] ?? 0n;
    if (out <= 0n) return { kind: "revert" };
    return { out };
  } catch (error) {
    return { kind: failureKind(error) };
  }
}

export async function quoteBest(client: Reader, amountIn: bigint, tokenIn: Address | null, pull: Address): Promise<Quote> {
  if (amountIn <= 0n) return { ok: false, reason: "no-route" };
  let wbnb: Address;
  try {
    wbnb = (await client.readContract({
      address: PANCAKE_V2_ROUTER,
      abi: routerAbi,
      functionName: "WETH",
    })) as Address;
  } catch {
    return { ok: false, reason: "rpc" };
  }
  const start = tokenIn ?? wbnb;
  const paths: Address[][] = [[start, pull]];
  if (start.toLowerCase() !== wbnb.toLowerCase() && pull.toLowerCase() !== wbnb.toLowerCase()) {
    paths.push([start, wbnb, pull]);
  }
  const results = await Promise.all(paths.map(async (path) => ({ path, result: await readOut(client, amountIn, path) })));
  const ranked = results
    .flatMap((item) => ("out" in item.result ? [{ path: item.path, out: item.result.out }] : []))
    .sort((a, b) => (a.out > b.out ? -1 : a.out < b.out ? 1 : 0));
  const best = ranked[0];
  if (!best) {
    return { ok: false, reason: results.some((item) => "kind" in item.result && item.result.kind === "rpc") ? "rpc" : "no-route" };
  }
  let impactBps: number | null = null;
  const probe = amountIn / 100n;
  if (probe > 0n) {
    const probed = await readOut(client, probe, best.path);
    if ("out" in probed && probed.out > 0n) {
      const ideal = (probed.out * amountIn) / probe;
      if (ideal > 0n && ideal >= best.out) {
        const bps = Number(((ideal - best.out) * 10_000n) / ideal);
        impactBps = Number.isFinite(bps) ? bps : null;
      }
    }
  }
  return { ok: true, amountOut: best.out, path: best.path, impactBps };
}

export async function pairHasLiquidity(
  client: Reader,
  tokenA: Address,
  tokenB: Address,
): Promise<{ ok: true; liquid: boolean } | { ok: false; reason: "rpc" }> {
  if (tokenA.toLowerCase() === tokenB.toLowerCase()) return { ok: true, liquid: false };
  try {
    const pair = (await client.readContract({
      address: PANCAKE_V2_FACTORY,
      abi: factoryAbi,
      functionName: "getPair",
      args: [tokenA, tokenB],
    })) as Address;
    if (!pair || pair.toLowerCase() === zeroAddress.toLowerCase()) return { ok: true, liquid: false };
    const reserves = (await client.readContract({
      address: pair,
      abi: pairAbi,
      functionName: "getReserves",
    })) as readonly [bigint, bigint, number];
    return { ok: true, liquid: reserves[0] > 0n && reserves[1] > 0n };
  } catch {
    return { ok: false, reason: "rpc" };
  }
}

/** True only when the direct pair, or the two-hop route through WBNB, holds reserves on both sides. */
export async function v2RouteReady(
  client: Reader,
  tokenIn: Address | null,
  pull: Address,
): Promise<{ ok: true; liquid: boolean } | { ok: false; reason: "rpc" }> {
  let wbnb: Address;
  try {
    wbnb = (await client.readContract({
      address: PANCAKE_V2_ROUTER,
      abi: routerAbi,
      functionName: "WETH",
    })) as Address;
  } catch {
    return { ok: false, reason: "rpc" };
  }
  const start = tokenIn ?? wbnb;
  const direct = await pairHasLiquidity(client, start, pull);
  if (!direct.ok) return direct;
  if (direct.liquid) return direct;
  if (start.toLowerCase() === wbnb.toLowerCase()) return { ok: true, liquid: false };
  const toWbnb = await pairHasLiquidity(client, start, wbnb);
  if (!toWbnb.ok) return toWbnb;
  if (!toWbnb.liquid) return { ok: true, liquid: false };
  return pairHasLiquidity(client, wbnb, pull);
}

export function swapError(error: unknown) {
  const record = error && typeof error === "object" ? (error as { shortMessage?: unknown; message?: unknown }) : {};
  const text =
    typeof record.shortMessage === "string"
      ? record.shortMessage
      : error instanceof Error
        ? error.message
        : "The transaction did not land.";
  const lower = text.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
    return "The wallet declined the request.";
  }
  if (lower.includes("insufficient funds")) return "Not enough BNB to cover this swap and the network fee.";
  if (lower.includes("insufficient_output") || lower.includes("excessive_input") || lower.includes("too little received")) {
    return "The price moved past your slippage. Refresh the quote, or raise slippage.";
  }
  if (lower.includes("transfer_from_failed") || lower.includes("insufficient allowance")) {
    return "The token approval did not cover this amount.";
  }
  if (lower.includes("expired") || lower.includes("deadline")) return "That quote expired. Request a fresh one.";
  return text;
}
