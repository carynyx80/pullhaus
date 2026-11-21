"use client";

import { toast } from "sonner";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { isDeployed, useHouse } from "./house";

export function explain(error: unknown) {
  if (error instanceof BaseError) {
    const revert = error.walk((item) => item instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) return revert.data?.errorName || revert.shortMessage;
    return error.shortMessage;
  }
  return error instanceof Error ? error.message : "The transaction did not land.";
}

export function useSend() {
  const { writeContractAsync } = useWriteContract();
  const { deployment } = useHouse();
  const target = isDeployed(deployment) ? deployment.chainId : undefined;
  const client = usePublicClient({ chainId: target });
  const { chainId: current } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  return async (label: string, params: Parameters<typeof writeContractAsync>[0]) => {
    const id = toast.loading(label);
    try {
      if (target && current !== target) await switchChainAsync({ chainId: target });
      const hash = await writeContractAsync((target ? { ...params, chainId: target } : params) as typeof params);
      if (client) await client.waitForTransactionReceipt({ hash });
      toast.success("Confirmed", { id });
      return hash;
    } catch (error) {
      toast.error(explain(error), { id });
      throw error;
    }
  };
}
