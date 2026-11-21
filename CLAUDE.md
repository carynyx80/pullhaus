# Pullhaus — notes for the next session

Pullhaus is a sealed-card game on **BNB Chain only**. There is no Solana code, and none should be added. Holders burn the external `$PULL` token (or MockPULL locally) to open packs. Cards stay sealed until the owner reveals them. Burning is how points and tiers accrue.

## Layout

- `contracts/` — Solidity 0.8.24, Foundry, OpenZeppelin 5.2. Tests in `contracts/test/Pullhaus.t.sol`.
- `packages/shared/` — the TypeScript twin of `CardMath`, procedural SVG, names, lore, and battle resolution. ABIs live in `src/abi/`. Build emits `dist/` and both apps import that.
- `backend/` — Fastify, Prisma, Postgres, Redis, BullMQ. Indexes logs, generates card media, serves SIWE inventory, battles, and a websocket.
- `web/` — Next.js App Router, Tailwind 4, Framer Motion, Lenis, wagmi, RainbowKit.
- `docs/zk-phase2.md` — why v1 privacy is not zero-knowledge, and the proving plan.

## Contracts

| Contract | Role |
| --- | --- |
| `MockPULL` | Local/testnet BEP-20 with a public faucet. Production sets `PULL_TOKEN` and does not deploy this. |
| `MockVRFCoordinator` | Stand-in for Chainlink VRF v2.5. Insecure. Refused on BSC (56) and BSC testnet (97) unless `ALLOW_MOCK_VRF=true`. |
| `PullhausCards` | ERC-721. Sealed attributes, commitment, `reveal`, owner enumeration. |
| `PullhausPacks` | Payment split, odds, tier boost, VRF request, mint. |
| `PullhausRewards` | Burn points, tiers, seasons, epoch pool, pro-rata `claim`. |
| `PullhausMarketplace` | Escrow listings for revealed cards. 5% fee split. |
| `PullhausForge` | Upgrade (duplicate + tokens) and fusion, including mythic. |

Default pack split is 50% burn / 30% epoch pool / 20% treasury. The treasury leg is the remainder so the three parts sum to the price. Points accrue on the burned amount only. Mythic odds in packs default to 0. Mythic is fused from two legendaries, or one legendary plus `mythicBurnPrice`.

VRF v2.5 request encoding matches Chainlink's `VRFV2PlusClient` (`extraArgs` tag `VRF ExtraArgsV1`, native payment flag). BSC addresses are in `contracts/.env.example` and the README.

`debugEndEpoch` exists only when `localTools` is set, and the deploy script sets that only on chain id 31337.

## Shared math

`packages/shared/src/derive.ts` must stay identical to `contracts/src/libraries/CardMath.sol`. The lock is the golden vector in both test suites: seed `1`, rarity `2` → element 1, ability 3, atk 78, def 94, spd 97. If you change the hash preimage, change both and re-lock the tests.

Names, lore, and SVG are offchain and deterministic from the seed. An OpenAI key may replace lore and the image later. It must not change stats.

## Backend

`GET /config` is how the web app learns addresses. `DEPLOYMENT_PATH` points at `contracts/deployments/local.json`.

The indexer follows `Transfer`, `CardMinted`, `CardRevealed`, `CardLeveled`, `PackFulfilled`, `BurnAccrued`, listings, and epochs. It reads sealed stats with `gameCard` using the indexer address as `eth_call` from. That is not a privacy boundary. See the ZK note.

BullMQ queue `pullhaus` generates media. `MEDIA_DRIVER=local|s3|greenfield`. Greenfield uses `@bnb-chain/greenfield-js-sdk` when that package is installed and the env is set; any failure falls back to local disk under `backend/storage`, served at `/media/*`.

SIWE: `GET /auth/nonce`, `POST /auth/verify`, bearer JWT. Private inventory is `GET /inventory`.

The keeper key fulfills the mock coordinator. The well-known Anvil keys are refused when `chainId` is not 31337 or 5611.

## Web

Routes: `/`, `/connect`, `/packs`, `/inventory`, `/card/[id]`, `/forge`, `/burn`, `/leaderboard`, `/market`, `/battle`, `/odds`, `/admin`, `/unavailable`.

Local play uses two injected dev connectors (Anvil patron = account 0, the admin; Anvil guest = account 2) when `NEXT_PUBLIC_DEV_WALLET=true`. They exist so the app is playable without a browser wallet. Do not enable them against a public RPC.

Age gate is `localStorage` key `pullhaus-age`. Country blocking is `COUNTRY_BLOCK_ENABLED` plus `BLOCKED_COUNTRIES` (comma list), read from `x-vercel-ip-country` or `cf-ipcountry` in Next middleware and on the API.

Copy talks about points and perks. Do not describe the epoch claim as wages, yield, or a promise of profit.

## Conventions

- Solidity custom errors, checks-effects-interactions, `ReentrancyGuard` on money paths, `SafeERC20` for the token.
- No new chain. If a feature needs a contract call, it goes through the existing BNB deployments (Anvil, BSC testnet, opBNB testnet, BSC).
- opBNB has no published Chainlink VRF v2.5 coordinator. The deploy script allows the mock there and on Anvil only.
- Don't commit `.env`. Anvil private keys in the examples are the public Foundry defaults and are labeled as such.
- `packages/shared` imports use `.js` extensions because it compiles to NodeNext.

## What's done

- Pack open, burn split, VRF mock fulfill, sealed views, reveal, upgrade, fusion (including both mythic paths), marketplace fee split, epoch accounting and claims, tier boosts, early access, pause, admin role checks, reentrancy on open, buy, and claim.
- Offline art, names, lore, and battle narration. Optional OpenAI and optional S3/Greenfield.
- One-command local dev: `pnpm dev`.
- Deploy script and `AddConsumer` for a real VRF subscription.

## What's next

- Phase 2 ZK rarity proofs (`docs/zk-phase2.md`). Until then, do not claim the sealed state is cryptographically private.
- A real `$PULL` address from four.meme / PancakeSwap, a funded VRF subscription, and `forge script` against BSC testnet.
- Greenfield needs a live bucket and the JS SDK installed; the adapter is written and falls back locally.
- WalletConnect project id, if the RainbowKit modal should include WalletConnect. Injected wallets already work.
- Multisig admin. The deployer holds `DEFAULT_ADMIN_ROLE`.
- Production tier thresholds. Anvil uses small numbers (100 / 300 / 800 / 2000 ether of burn points) so a session can reach a tier. Other chains default to 1k / 10k / 50k / 200k unless `TIER1`–`TIER4` are set.

## Run and test

```bash
pnpm dev                  # anvil, deploy if needed, postgres, redis, api, web
cd contracts && forge test --no-dynamic-test-linking
pnpm --filter @pullhaus/shared test
pnpm typecheck && pnpm lint && pnpm build
```

Web: http://127.0.0.1:4180 · API: http://127.0.0.1:4181

`FORCE_DEPLOY=1 pnpm dev` redeploys even if the saved pack address still has code.
