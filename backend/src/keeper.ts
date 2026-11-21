import type { Deployment } from "@pullhaus/shared";
import { config, keeperAllowed } from "./config.js";
import { abi, keeperClient, publicClient } from "./chain.js";

export function startKeeper(deployment: Deployment) {
  if (!deployment.mockVrf || !keeperAllowed(deployment.chainId, config.keeperKey)) {
    console.log("keeper idle");
    return;
  }
  const wallet = keeperClient(deployment, config.keeperKey);
  const reader = publicClient(deployment);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const count = Number(
        await reader.readContract({
          address: deployment.vrfCoordinator,
          abi: abi.vrf,
          functionName: "pendingCount",
        }),
      );
      const ids: bigint[] = [];
      for (let i = 0; i < count; i++) {
        ids.push(
          (await reader.readContract({
            address: deployment.vrfCoordinator,
            abi: abi.vrf,
            functionName: "pendingAt",
            args: [BigInt(i)],
          })) as bigint,
        );
      }
      for (const id of ids) {
        await wallet.writeContract({
          address: deployment.vrfCoordinator,
          abi: abi.vrf,
          functionName: "fulfillDeterministic",
          args: [id],
        });
      }
    } catch (error) {
      console.warn("keeper", error);
    } finally {
      running = false;
    }
  };
  setInterval(() => void tick(), 2000);
}
