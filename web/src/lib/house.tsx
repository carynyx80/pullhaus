"use client";

import { emptyDeployment, isDeployed, type Deployment } from "@pullhaus/shared";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { tradeHintsFromConfig, type TradeHints } from "./trade";
import { API_URL } from "./utils";

type HouseState = {
  deployment: Deployment;
  trade: TradeHints;
  ready: boolean;
  error: string | null;
  refresh: () => void;
};

const emptyTrade: TradeHints = { pullToken: null, fourMemeUrl: "" };

const HouseContext = createContext<HouseState>({
  deployment: emptyDeployment(),
  trade: emptyTrade,
  ready: false,
  error: null,
  refresh: () => {},
});

export function HouseProvider({ children }: { children: ReactNode }) {
  const [deployment, setDeployment] = useState<Deployment>(emptyDeployment());
  const [trade, setTrade] = useState<TradeHints>(emptyTrade);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    fetch(`${API_URL}/config`)
      .then(async (response) => {
        if (!response.ok) throw new Error("config");
        const body: unknown = await response.json();
        setDeployment(body as Deployment);
        setTrade(tradeHintsFromConfig(body));
        setError(null);
      })
      .catch(() => setError("The atelier API is not running yet."))
      .finally(() => setReady(true));
  };
  useEffect(() => {
    refresh();
  }, []);
  return (
    <HouseContext.Provider value={{ deployment, trade, ready, error, refresh }}>
      <ChainGuard chainId={isDeployed(deployment) ? deployment.chainId : 0} />
      {children}
    </HouseContext.Provider>
  );
}

export function useHouse() {
  return useContext(HouseContext);
}

export { isDeployed };

/// Asks a connected wallet to move to the chain the API is deployed on, once per connection.
function ChainGuard({ chainId }: { chainId: number }) {
  const { isConnected, chainId: current } = useAccount();
  const { switchChain } = useSwitchChain();
  const asked = useRef(false);
  useEffect(() => {
    if (!isConnected) {
      asked.current = false;
      return;
    }
    if (!chainId || current === chainId || asked.current) return;
    asked.current = true;
    switchChain({ chainId });
  }, [isConnected, current, chainId, switchChain]);
  return null;
}
