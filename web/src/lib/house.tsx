"use client";

import { emptyDeployment, isDeployed, type Deployment } from "@pullhaus/shared";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { API_URL } from "./utils";

type HouseState = {
  deployment: Deployment;
  ready: boolean;
  error: string | null;
  refresh: () => void;
};

const HouseContext = createContext<HouseState>({
  deployment: emptyDeployment(),
  ready: false,
  error: null,
  refresh: () => {},
});

export function HouseProvider({ children }: { children: ReactNode }) {
  const [deployment, setDeployment] = useState<Deployment>(emptyDeployment());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    fetch(`${API_URL}/config`)
      .then(async (response) => {
        if (!response.ok) throw new Error("config");
        setDeployment(await response.json());
        setError(null);
      })
      .catch(() => setError("The atelier API is not running yet."))
      .finally(() => setReady(true));
  };
  useEffect(() => {
    refresh();
  }, []);
  return <HouseContext.Provider value={{ deployment, ready, error, refresh }}>{children}</HouseContext.Provider>;
}

export function useHouse() {
  return useContext(HouseContext);
}

export { isDeployed };
