"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Lenis from "lenis";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";
import { defaultChain } from "@/lib/chains";
import { HouseProvider } from "@/lib/house";
import { wagmiConfig } from "@/lib/wagmi";
import { AgeGate } from "./age-gate";
import { Shell } from "./shell";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    let frame = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#e6b17a", accentColorForeground: "#24170f", borderRadius: "large" })} initialChain={defaultChain}>
          <HouseProvider>
            <AgeGate />
            <Shell>{children}</Shell>
            <Toaster theme="dark" />
          </HouseProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
