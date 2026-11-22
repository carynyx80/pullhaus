"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useConnect } from "wagmi";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";

export default function ConnectPage() {
  const { connect, connectors, status } = useConnect();
  const dev = process.env.NEXT_PUBLIC_DEV_WALLET === "true";
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <Mark size={72} />
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.32em] text-gold">Wallets</p>
      <h1 className="mt-3 font-display text-5xl sm:text-6xl">Come in with a key.</h1>
      <p className="mt-4 max-w-xl text-muted">
        Pullhaus speaks BNB Chain, BNB testnet, opBNB, and a local Anvil chain. A wallet signature later opens your private inventory. It does not spend tokens by itself.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ConnectButton />
        {dev &&
          connectors
            .filter((connector) => connector.id.startsWith("anvil"))
            .map((connector) => (
              <Button key={connector.id} variant="outline" disabled={status === "pending"} onClick={() => connect({ connector })}>
                Enter as {connector.name}
              </Button>
            ))}
      </div>
      {dev && (
        <p className="mt-6 text-sm text-muted">
          Local Anvil accounts are public test keys. The patron is the admin. The guest is there so you can buy a card from someone else. Do not import these keys on a public network.
        </p>
      )}
    </section>
  );
}
