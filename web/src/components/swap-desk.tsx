"use client";

import { abis } from "@pullhaus/shared";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { erc20Abi, type Abi, type Address } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { bsc } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { isDeployed, useHouse } from "@/lib/house";
import {
  amountProblem,
  BNB_GAS_RESERVE,
  bpsToPercentLabel,
  BSC_CHAIN_ID,
  DEFAULT_SLIPPAGE_BPS,
  formatAmount,
  minReceived,
  PANCAKE_V2_ROUTER,
  pancakeSwapUrl,
  parseAmount,
  payToken,
  payTokens,
  percentToBps,
  plainAmount,
  quoteBest,
  routerAbi,
  v2RouteReady,
  SLIPPAGE_PRESETS,
  SWAP_DEADLINE_SECONDS,
  swapError,
  type PayId,
} from "@/lib/pancake";
import { flapPoolKind, flapTokenPage, launchpadCta, poolStatusCopy } from "@/lib/launchpad";
import { inputCurrency, networkLabel, resolveSwapMode } from "@/lib/trade";
import { useSend } from "@/lib/tx";
import { short } from "@/lib/utils";

export function SwapDesk() {
  const { deployment, trade } = useHouse();
  const target = resolveSwapMode(deployment, trade);
  const showFaucet = target.mode === "faucet" || (target.mode === "swap" && deployment.mockToken && isDeployed(deployment));
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-gold">Swap</p>
      <h1 className="mt-3 font-display text-6xl sm:text-8xl">Get $PULL.</h1>
      <p className="mt-4 leading-7 text-muted">
        $PULL launches on Flap.sh. It trades on a bonding curve until 80% of supply is sold, then migrates to PancakeSwap. Tax tokens (address ending in 7777) move to a V2 pool. Non-tax tokens (address ending in 8888) move to an Infinity CL pool. This desk uses the V2 router only when a pair has liquidity.
      </p>
      {target.configError ? (
        <p className="mt-4 rounded-2xl border border-ember/50 bg-ember/10 px-4 py-3 text-sm" role="alert">
          {target.configError}
        </p>
      ) : null}
      <div className="mt-8 max-w-xl">
        {target.mode === "swap" ? (
          <SwapForm pullToken={target.pullToken} launchpadUrl={target.launchpadUrl} />
        ) : target.mode === "faucet" ? (
          <FaucetCard chainId={target.chainId} launchpadUrl={target.launchpadUrl} />
        ) : (
          <SoonCard launchpadUrl={target.launchpadUrl} />
        )}
      </div>
      {target.mode === "swap" && showFaucet ? (
        <div className="mt-4">
          <FaucetCard chainId={deployment.chainId} launchpadUrl={target.launchpadUrl} quiet />
        </div>
      ) : null}
      <MigrationNote href={target.launchpadUrl} />
    </section>
  );
}

function SoonCard({ launchpadUrl }: { launchpadUrl: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="glass relative overflow-hidden rounded-[32px] p-7 sm:p-8">
      <motion.div
        className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-ember/30 blur-3xl"
        animate={reduce ? undefined : { y: [0, 12, 0], opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <p className="text-xs uppercase tracking-[0.18em] text-gold">Mainnet token</p>
      <h2 className="mt-3 font-display text-6xl leading-none">Launching soon on Flap.sh.</h2>
      <p className="mt-4 leading-7 text-muted">
        No mainnet $PULL address is configured, so this desk will not quote a pool or send a swap. When the token is ready, set it in the site config and the swap form takes this place. Nothing here invents an address.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <a href={launchpadUrl} target="_blank" rel="noreferrer">
            {launchpadCta(launchpadUrl, false)}
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link href="/how-it-works">How a burn works</Link>
        </Button>
      </div>
      <p className="mt-5 text-sm text-muted">The PancakeSwap link appears with the token address. Until then there is nothing honest to deep-link.</p>
    </div>
  );
}

function FaucetCard({ chainId, launchpadUrl, quiet = false }: { chainId: number; launchpadUrl: string; quiet?: boolean }) {
  const { deployment } = useHouse();
  const { address } = useAccount();
  const send = useSend();
  const label = networkLabel(chainId);
  return (
    <div className={`rounded-[32px] p-7 sm:p-8 ${quiet ? "border border-line" : "glass"}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-gold">{quiet ? "Also on this network" : "Test token"}</p>
      <h2 className="mt-3 font-display text-4xl leading-tight">{quiet ? "MockPULL is still on the faucet." : "The faucet pours test $PULL."}</h2>
      <p className="mt-4 leading-7 text-muted">
        {label.charAt(0).toUpperCase() + label.slice(1)} uses MockPULL. It is a test token with a public faucet, not the mainnet coin, and it does not trade on PancakeSwap.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          disabled={!address || !isDeployed(deployment)}
          onClick={() => send("Minting test $PULL", { address: deployment.pull, abi: abis.pull as Abi, functionName: "faucet" })}
        >
          {address ? "Mint test $PULL" : "Connect to use the faucet"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/packs">Open a pack</Link>
        </Button>
      </div>
      {quiet ? null : (
        <p className="mt-5 text-sm text-muted">
          Mainnet $PULL is launching on{" "}
          <a className="text-gold hover:text-ink" href={launchpadUrl} target="_blank" rel="noreferrer">
            Flap.sh
          </a>
          . The swap form replaces this card once that address is set.
        </p>
      )}
    </div>
  );
}

function MigrationNote({ href }: { href: string }) {
  return (
    <p className="mt-6 text-sm leading-6 text-muted">
      A token launched on{" "}
      <a className="text-gold hover:text-ink" href={href} target="_blank" rel="noreferrer">
        Flap.sh
      </a>{" "}
      trades on the bonding curve until 80% of supply is sold. Buys before that migration happen on Flap. Tax tokens, addresses ending in 7777, then move to a PancakeSwap V2 pool. Non-tax tokens, addresses ending in 8888, move to a PancakeSwap Infinity CL pool. This desk sends a V2 swap only after getPair shows a pool and getReserves shows liquidity.
    </p>
  );
}

function SwapForm({ pullToken, launchpadUrl }: { pullToken: Address; launchpadUrl: string }) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: bsc.id });
  const [payId, setPayId] = useState<PayId>("bnb");
  const [amount, setAmount] = useState("");
  const [preset, setPreset] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [pending, setPending] = useState<"approve" | "swap" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ hash: `0x${string}`; received: bigint | null } | null>(null);
  const deferred = useDeferredValue(amount);
  const pay = payToken(payId);
  const kind = flapPoolKind(pullToken);
  const tokenPage = flapTokenPage(launchpadUrl, pullToken);
  const pool = useQuery({
    queryKey: ["v2-pool", payId, pullToken],
    enabled: Boolean(client),
    refetchInterval: 20_000,
    queryFn: () => v2RouteReady(client!, pay.address, pullToken),
  });
  const liquid = pool.data?.ok === true && pool.data.liquid;
  const checking = Boolean(client) && pool.isPending;
  const poolUnread = !checking && (pool.data?.ok === false || !client);
  const poolState = poolUnread ? "unread" : liquid ? "liquid" : "closed";
  const slippageBps = useCustom ? percentToBps(custom) : preset;
  const inputDecimalsQuery = useReadContract({
    chainId: bsc.id,
    address: pay.address ?? undefined,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(pay.address) },
  });
  const pullMeta = useReadContract({
    chainId: bsc.id,
    address: pullToken,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const pullSymbol = useReadContract({
    chainId: bsc.id,
    address: pullToken,
    abi: erc20Abi,
    functionName: "symbol",
  });
  const native = useBalance({ address, chainId: bsc.id, query: { enabled: Boolean(address) } });
  const tokenBalance = useReadContract({
    chainId: bsc.id,
    address: pay.address ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && pay.address) },
  });
  const allowance = useReadContract({
    chainId: bsc.id,
    address: pay.address ?? undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && pay.address ? [address, PANCAKE_V2_ROUTER] : undefined,
    query: { enabled: Boolean(address && pay.address) },
  });

  const inputDecimals = pay.address ? inputDecimalsQuery.data : 18;
  const outputDecimals = pullMeta.data;
  const parsed = inputDecimals !== undefined ? parseAmount(deferred, inputDecimals) : null;
  const quote = useQuery({
    queryKey: ["pull-quote", payId, deferred, pullToken, String(inputDecimals)],
    enabled: Boolean(client && liquid && parsed && parsed > 0n && outputDecimals !== undefined),
    refetchInterval: 12_000,
    queryFn: () => quoteBest(client!, parsed!, pay.address, pullToken),
  });

  const balance = pay.address ? (tokenBalance.data ?? null) : (native.data?.value ?? null);
  const typing = amount !== deferred;
  const amountError = inputDecimals !== undefined ? amountProblem(amount, inputDecimals) : null;
  const quoted = quote.data && quote.data.ok ? quote.data : null;
  const needsApprove = Boolean(pay.address && parsed && parsed > 0n && allowance.data !== undefined && allowance.data < parsed);
  const shortBalance = parsed !== null && parsed > 0n && balance !== null && parsed > balance;
  const gasTight = payId === "bnb" && parsed !== null && balance !== null && parsed <= balance && balance - parsed < BNB_GAS_RESERVE;
  const routeError =
    quote.data && !quote.data.ok
      ? quote.data.reason === "no-route"
        ? "The V2 reserves were there, but this amount has no quote. Try again, or buy on Flap."
        : "The BNB Smart Chain node did not answer. Try the quote again."
      : null;
  const tokenUnread = pullMeta.isError ? "BNB Smart Chain could not read this token. Check the configured address." : null;
  const slippageError = useCustom && slippageBps === null ? "Enter a slippage from 0 to 50%, with at most two decimal places." : null;
  const alert = liquid
    ? formError || amountError || tokenUnread || slippageError || (shortBalance ? `Not enough ${pay.symbol}.` : null) || (gasTight ? "Leave a little BNB for the network fee." : null) || routeError
    : formError;

  const minOut = quoted && slippageBps !== null ? minReceived(quoted.amountOut, slippageBps) : null;
  const receiveText =
    outputDecimals !== undefined && quoted ? formatAmount(quoted.amountOut, outputDecimals) : typing || quote.isFetching ? "…" : "—";
  const rawSymbol = typeof pullSymbol.data === "string" && pullSymbol.data ? pullSymbol.data : "PULL";
  const symbol = rawSymbol.toUpperCase() === "PULL" ? "$PULL" : rawSymbol;

  function onMax() {
    if (balance === null || inputDecimals === undefined) return;
    if (payId === "bnb") {
      setAmount(balance > BNB_GAS_RESERVE ? plainAmount(balance - BNB_GAS_RESERVE, inputDecimals) : "");
      return;
    }
    setAmount(plainAmount(balance, inputDecimals));
  }

  async function onSubmit() {
    setFormError(null);
    setDone(null);
    if (!address || !liquid) return;
    let toastId: string | number | null = null;
    try {
      if (chainId !== BSC_CHAIN_ID) {
        await switchChainAsync({ chainId: bsc.id });
        return;
      }
      if (!client || parsed === null || parsed === 0n || !quoted || slippageBps === null || minOut === null) return;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS);
      if (pay.address && (allowance.data ?? 0n) < parsed) {
        setPending("approve");
        toastId = toast.loading(`Approving ${pay.symbol}`);
        await approveToken(pay.address, parsed, allowance.data ?? 0n);
        toast.success("Approved", { id: toastId });
      }
      setPending("swap");
      toastId = toast.loading("Swapping");
      const before = (await client.readContract({
        address: pullToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      const hash = pay.address
        ? await writeContractAsync({
            chainId: bsc.id,
            address: PANCAKE_V2_ROUTER,
            abi: routerAbi,
            functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
            args: [parsed, minOut, quoted.path, address, deadline],
          })
        : await writeContractAsync({
            chainId: bsc.id,
            address: PANCAKE_V2_ROUTER,
            abi: routerAbi,
            functionName: "swapExactETHForTokensSupportingFeeOnTransferTokens",
            args: [minOut, quoted.path, address, deadline],
            value: parsed,
          });
      await client.waitForTransactionReceipt({ hash });
      const after = (await client.readContract({
        address: pullToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      toast.success("Swap confirmed", { id: toastId });
      setDone({ hash, received: after >= before ? after - before : null });
      setAmount("");
      void allowance.refetch();
      void tokenBalance.refetch();
      void native.refetch();
    } catch (error) {
      const message = swapError(error);
      setFormError(message);
      if (toastId !== null) toast.error(message, { id: toastId });
      else toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function approveToken(token: Address, needed: bigint, current: bigint) {
    const sendApprove = async (value: bigint) => {
      const hash = await writeContractAsync({
        chainId: bsc.id,
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [PANCAKE_V2_ROUTER, value],
      });
      if (!client) return;
      await client.waitForTransactionReceipt({ hash });
    };
    try {
      await sendApprove(needed);
    } catch (error) {
      const message = swapError(error).toLowerCase();
      if (current === 0n || message.includes("declined")) throw error;
      await sendApprove(0n);
      await sendApprove(needed);
    }
  }

  const busy = pending !== null;
  const canSubmit = Boolean(liquid && address && parsed && parsed > 0n && quoted && slippageBps !== null && !alert && !busy && !typing && outputDecimals !== undefined);
  const buttonLabel = !address
    ? "Connect a wallet"
    : chainId !== BSC_CHAIN_ID
      ? "Switch to BNB Smart Chain"
      : pending === "approve"
        ? `Approving ${pay.symbol}`
        : pending === "swap"
          ? "Swapping"
          : needsApprove
            ? `Approve and swap`
            : "Swap";

  return (
    <div className="glass rounded-[32px] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Pay with" className="flex flex-wrap gap-2">
          {payTokens.map((token) => {
            const selected = token.id === payId;
            return (
              <button
                key={token.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setPayId(token.id);
                  setFormError(null);
                  setDone(null);
                }}
                className={`rounded-full border px-3 py-1.5 text-sm ${selected ? "border-gold bg-gold text-[#24170f]" : "border-line text-muted hover:text-ink"}`}
              >
                {token.symbol}
              </button>
            );
          })}
        </div>
        {liquid ? (
          <button type="button" className="font-mono text-[11px] text-gold hover:text-ink" onClick={onMax} disabled={balance === null}>
            {balance !== null && inputDecimals !== undefined ? `Balance ${formatAmount(balance, inputDecimals, 4)}` : "Balance —"}
          </button>
        ) : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">{checking ? "Reading PancakeSwap V2 reserves for this pair." : poolStatusCopy(kind, poolState)}</p>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
        <a className="hover:text-ink" href={`https://bscscan.com/token/${pullToken}`} target="_blank" rel="noreferrer">
          {short(pullToken)}
        </a>
        {kind === "v2-tax" ? " · ends 7777 · V2 after migration" : kind === "infinity" ? " · ends 8888 · Infinity after migration" : ""}
      </p>

      {liquid ? (
      <>
      <label className="mt-4 block" htmlFor="swap-amount">
        <span className="text-xs uppercase tracking-[0.16em] text-muted">You pay · {pay.blurb}</span>
        <input
          id="swap-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setFormError(null);
            setDone(null);
          }}
          className="mt-2 w-full bg-transparent font-display text-5xl text-ink outline-none placeholder:text-white/20"
        />
      </label>

      <div className="mt-4 rounded-3xl border border-line bg-black/20 p-4" aria-live="polite">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">You receive · {symbol}</p>
        <p className="mt-1 font-display text-4xl">{receiveText}</p>
        <p className="mt-2 text-xs text-muted">
          <a className="hover:text-ink" href={`https://bscscan.com/token/${pullToken}`} target="_blank" rel="noreferrer">
            {short(pullToken)}
          </a>
          {quoted ? ` · ${routeLabel(quoted.path, pullToken, symbol)}` : ""}
        </p>
        {minOut !== null && outputDecimals !== undefined ? (
          <p className="mt-2 text-sm text-muted">Minimum received {formatAmount(minOut, outputDecimals)} {symbol}</p>
        ) : null}
        {quoted?.impactBps !== null && quoted?.impactBps !== undefined ? (
          <p className={`mt-1 text-sm ${quoted.impactBps > 500 ? "text-ember" : "text-muted"}`}>
            Price impact about {bpsToPercentLabel(quoted.impactBps)}
            {quoted.impactBps > 500 ? ". This quote moves the pool a lot." : ""}
          </p>
        ) : null}
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs uppercase tracking-[0.16em] text-muted">Slippage</legend>
        <div className="mt-2 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Slippage">
          {SLIPPAGE_PRESETS.map((bps) => {
            const selected = !useCustom && preset === bps;
            return (
              <button
                key={bps}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setUseCustom(false);
                  setPreset(bps);
                }}
                className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-gold text-gold" : "border-line text-muted"}`}
              >
                {bpsToPercentLabel(bps)}
              </button>
            );
          })}
          <label className="flex items-center gap-2 text-xs text-muted">
            <span className="sr-only">Custom slippage percent</span>
            <input
              inputMode="decimal"
              value={custom}
              placeholder="Custom %"
              aria-label="Custom slippage percent"
              onFocus={() => setUseCustom(true)}
              onChange={(event) => {
                setCustom(event.target.value);
                setUseCustom(true);
              }}
              className={`h-8 w-24 rounded-full border bg-transparent px-3 outline-none ${useCustom ? "border-gold text-ink" : "border-line"}`}
            />
          </label>
        </div>
        {slippageBps !== null && slippageBps > 500 ? <p className="mt-2 text-xs text-ember">This slippage is high. A bad quote can cost you.</p> : null}
        {slippageBps === 0 ? <p className="mt-2 text-xs text-muted">At 0% the swap reverts if the price moves at all.</p> : null}
      </fieldset>

      {alert ? (
        <p className="mt-4 rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm" role="alert">
          {alert}
        </p>
      ) : null}
      {done ? (
        <p className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          Swap confirmed
          {done.received !== null && outputDecimals !== undefined ? `. Received ${formatAmount(done.received, outputDecimals)} ${symbol}` : ""}.{" "}
          <a className="text-gold hover:text-ink" href={`https://bscscan.com/tx/${done.hash}`} target="_blank" rel="noreferrer">
            View on BscScan
          </a>
        </p>
      ) : null}

      <div className="mt-5 grid gap-2">
        {address ? (
          <Button className="w-full" disabled={Boolean(address && chainId === BSC_CHAIN_ID && !canSubmit)} onClick={() => void onSubmit()}>
            {buttonLabel}
          </Button>
        ) : (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <Button type="button" className="w-full" onClick={() => openConnectModal?.()}>
                Connect a wallet
              </Button>
            )}
          </ConnectButton.Custom>
        )}
        <Button asChild variant="outline" className="w-full">
          <a href={pancakeSwapUrl(pullToken, inputCurrency(payId, pay.address))} target="_blank" rel="noreferrer">
            Open in PancakeSwap
          </a>
        </Button>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">
        Quotes come from the V2 router at {short(PANCAKE_V2_ROUTER)}. The swap uses the fee-on-transfer method, so a token tax can make the received amount smaller than the quote. The quote is valid for {SWAP_DEADLINE_SECONDS / 60} minutes. This runs on BNB Smart Chain (chain {BSC_CHAIN_ID})
        {chainId && chainId !== BSC_CHAIN_ID ? `, and your wallet is on chain ${chainId}` : ""}.
      </p>
      </>
      ) : (
        <div className="mt-5 grid gap-2">
          <Button asChild size="lg" className="w-full">
            <a href={tokenPage} target="_blank" rel="noreferrer">
              {launchpadCta(tokenPage, true)}
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={pancakeSwapUrl(pullToken, inputCurrency(payId, pay.address))} target="_blank" rel="noreferrer">
              Open in PancakeSwap
            </a>
          </Button>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        <a className="text-gold hover:text-ink" href={tokenPage} target="_blank" rel="noreferrer">
          {tokenPage.replace(/^https:\/\//, "")}
        </a>
      </p>
    </div>
  );
}

function routeLabel(path: readonly Address[], pull: Address, symbol: string) {
  return path
    .map((addr) => {
      const lower = addr.toLowerCase();
      if (lower === pull.toLowerCase()) return symbol;
      const known = payTokens.find((token) => token.address?.toLowerCase() === lower);
      return known?.symbol ?? "WBNB";
    })
    .join(" → ");
}
