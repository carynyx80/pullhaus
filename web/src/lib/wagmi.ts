import { createConfig, http, injected } from "wagmi";
import { anvil, bsc, bscTestnet, opBNB, opBNBTestnet } from "./chains";
import { localDevConnectors } from "./dev-wallet";

export const wagmiConfig = createConfig({
  chains: [anvil, bsc, bscTestnet, opBNB, opBNBTestnet],
  connectors: [injected(), ...localDevConnectors()],
  transports: {
    [anvil.id]: http(anvil.rpcUrls.default.http[0]),
    [bsc.id]: http("https://bsc-dataseed.binance.org"),
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
    [opBNB.id]: http(opBNB.rpcUrls.default.http[0]),
    [opBNBTestnet.id]: http(opBNBTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});
