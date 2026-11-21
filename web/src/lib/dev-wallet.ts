import { createWalletClient, hexToString, http, isHex, numberToHex, type Address, type Chain } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { createConnector } from "wagmi";
import { anvil } from "./chains";

function hexKey(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  return value as `0x${string}`;
}

/** Local Anvil connectors. Keys come from NEXT_PUBLIC_ANVIL_* which only local dev sets. */
export function localDevConnectors() {
  if (process.env.NEXT_PUBLIC_DEV_WALLET !== "true") return [];
  const patron = hexKey(process.env.NEXT_PUBLIC_ANVIL_PATRON_KEY);
  const guest = hexKey(process.env.NEXT_PUBLIC_ANVIL_GUEST_KEY);
  return [
    patron ? devWallet({ id: "anvil-patron", name: "Anvil patron", key: patron }) : null,
    guest ? devWallet({ id: "anvil-guest", name: "Anvil guest", key: guest }) : null,
  ].filter((item) => item !== null);
}

function providerFor(account: PrivateKeyAccount, getChain: () => Chain) {
  return {
    on() {},
    removeListener() {},
    async request({ method, params }: { method: string; params?: unknown[] }) {
      const chain = getChain();
      const rpc = chain.rpcUrls.default.http[0];
      const wallet = createWalletClient({ account, chain, transport: http(rpc) });
      const args = params ?? [];
      if (method === "eth_chainId") return numberToHex(chain.id);
      if (method === "eth_accounts" || method === "eth_requestAccounts") return [account.address];
      if (method === "personal_sign") {
        const raw = String(args[0] ?? "");
        const message = isHex(raw) ? hexToString(raw) : raw;
        return account.signMessage({ message });
      }
      if (method === "eth_signTypedData_v4") {
        const parsed = typeof args[1] === "string" ? JSON.parse(args[1]) : (args[1] as Record<string, unknown>);
        const { EIP712Domain, ...types } = (parsed.types ?? {}) as Record<string, unknown>;
        void EIP712Domain;
        return account.signTypedData({
          domain: parsed.domain,
          types,
          primaryType: parsed.primaryType,
          message: parsed.message,
        });
      }
      if (method === "eth_sendTransaction") {
        const tx = (args[0] ?? {}) as { to?: Address; data?: `0x${string}`; value?: string; gas?: string };
        return wallet.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
          chain,
        });
      }
      if (method === "wallet_switchEthereumChain") return null;
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: args }),
      });
      const json = (await response.json()) as { result?: unknown; error?: { message?: string } };
      if (json.error) throw new Error(json.error.message || "RPC error");
      return json.result;
    },
  };
}

export function devWallet(opts: { id: string; name: string; key: `0x${string}` }) {
  const account = privateKeyToAccount(opts.key);
  let connected = false;
  return createConnector((config) => ({
    id: opts.id,
    name: opts.name,
    type: opts.id,
    async setup() {},
    async connect() {
      connected = true;
      return { accounts: [account.address] as readonly `0x${string}`[], chainId: anvil.id };
    },
    async disconnect() {
      connected = false;
    },
    async getAccounts() {
      return connected ? [account.address] : [];
    },
    async getChainId() {
      return anvil.id;
    },
    async isAuthorized() {
      return connected;
    },
    async switchChain({ chainId }: { chainId: number }) {
      const chain = config.chains.find((item) => item.id === chainId);
      if (!chain) throw new Error("Unsupported chain");
      return chain;
    },
    async getProvider() {
      const current = (config as { state?: { chainId?: number } }).state?.chainId;
      return providerFor(account, () => config.chains.find((item) => item.id === current) ?? anvil);
    },
    onAccountsChanged() {},
    onChainChanged() {},
    async onDisconnect() {
      connected = false;
    },
  }) as never);
}
