import { defineChain } from "viem";
import { bsc, bscTestnet } from "wagmi/chains";

export const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ANVIL_RPC || "http://127.0.0.1:8545"] } },
});

export const opBNB = defineChain({
  id: 204,
  name: "opBNB",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: { default: { http: ["https://opbnb-mainnet-rpc.bnbchain.org"] } },
  blockExplorers: { default: { name: "opBNBScan", url: "https://opbnbscan.com" } },
});

export const opBNBTestnet = defineChain({
  id: 5611,
  name: "opBNB Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: { default: { http: ["https://opbnb-testnet-rpc.bnbchain.org"] } },
  blockExplorers: { default: { name: "opBNBScan", url: "https://opbnb-testnet.bscscan.com" } },
});

export const chains = [anvil, bsc, bscTestnet, opBNB, opBNBTestnet] as const;

export { bsc, bscTestnet };
