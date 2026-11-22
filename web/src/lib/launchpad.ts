import type { Address } from "viem";

/** Flap token pages live at https://flap.sh/bnb/<address> (docs.flap.sh). */
export const DEFAULT_LAUNCHPAD_URL = "https://flap.sh";

export type FlapPoolKind = "v2-tax" | "infinity" | "unknown";

export function isFlapHost(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "flap.sh" || host.endsWith(".flap.sh");
  } catch {
    return false;
  }
}

/** Tax tokens end in 7777 and migrate to PancakeSwap V2. Non-tax tokens end in 8888 and migrate to Infinity CL. */
export function flapPoolKind(address: string): FlapPoolKind {
  const lower = address.toLowerCase();
  if (lower.endsWith("7777")) return "v2-tax";
  if (lower.endsWith("8888")) return "infinity";
  return "unknown";
}

/**
 * Token buy link. A Flap site-root config becomes /bnb/<address>.
 * A URL that already contains the address, or any other path, is used as configured.
 */
export function flapTokenPage(launchpadUrl: string, token?: Address | string | null): string {
  const base = (launchpadUrl || DEFAULT_LAUNCHPAD_URL).replace(/\/$/, "");
  if (!token) return base;
  try {
    const url = new URL(base);
    if (url.pathname.toLowerCase().includes(token.toLowerCase())) return url.toString().replace(/\/$/, "");
    const path = url.pathname.replace(/\/$/, "");
    if (isFlapHost(base) && path === "") {
      url.pathname = `/bnb/${token}`;
      return url.toString().replace(/\/$/, "");
    }
    return base;
  } catch {
    return base;
  }
}

export function launchpadCta(url: string, withToken: boolean) {
  if (!isFlapHost(url)) return withToken ? "Buy on the launchpad" : "Open the launch page";
  return withToken ? "Buy on Flap.sh" : "Visit Flap.sh";
}

export function poolStatusCopy(kind: FlapPoolKind, state: "liquid" | "closed" | "unread") {
  if (state === "unread") {
    return "BNB Smart Chain did not answer the V2 pair check. The in-app swap stays closed until reserves can be read. Buy on Flap, or open PancakeSwap.";
  }
  if (state === "liquid") {
    if (kind === "infinity") {
      return "A PancakeSwap V2 pair has liquidity, so this desk will route the swap. The address ends in 8888, the Flap suffix for a non-tax token, which usually migrates to Infinity instead.";
    }
    return "A PancakeSwap V2 pair has liquidity on both sides, so this swap uses the V2 router.";
  }
  if (kind === "v2-tax") {
    return "This address ends in 7777, the Flap suffix for a tax token. It migrates to a PancakeSwap V2 pool after 80% of supply is sold. No V2 pair with liquidity was found, so buying stays on Flap's bonding curve.";
  }
  if (kind === "infinity") {
    return "This address ends in 8888, the Flap suffix for a non-tax token. Those migrate to a PancakeSwap Infinity CL pool, which this V2 router does not quote. Buy on Flap, or open PancakeSwap.";
  }
  return "No PancakeSwap V2 pair with liquidity was found. If the token is still on Flap's bonding curve, buys happen there until 80% of supply is sold. If it migrated to PancakeSwap Infinity, use the PancakeSwap link.";
}
