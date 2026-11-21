import { createConfig, http, injected } from "wagmi";
import { anvil, bsc, bscTestnet, opBNB, opBNBTestnet } from "./chains";
import { ANVIL_GUEST, ANVIL_PATRON, devWallet } from "./dev-wallet";

const dev = process.env.NEXT_PUBLIC_DEV_WALLET === "true";

export const wagmiConfig = createConfig({
  chains: [anvil, bsc, bscTestnet, opBNB, opBNBTestnet],
  connectors: [
    injected(),
    ...(dev ? [devWallet(ANVIL_PATRON), devWallet(ANVIL_GUEST)] : []),
  ],
  transports: {
    [anvil.id]: http(anvil.rpcUrls.default.http[0]),
    [bsc.id]: http("https://bsc-dataseed.binance.org"),
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
    [opBNB.id]: http(opBNB.rpcUrls.default.http[0]),
    [opBNBTestnet.id]: http(opBNBTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});
