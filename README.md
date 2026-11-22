# Pullhaus

A sealed-card atelier on BNB Chain. You burn `$PULL` to open a pack. The card stays shut until you reveal it. Burn points are perks: odds shifts, an exclusive set, earlier drops, and a pro-rata claim on the epoch pool that pack sales and marketplace fees actually funded.

This is entertainment for adults. The odds page is public before any token is spent. Points are not wages and not a promise of profit.

## Local play

Requirements: Node 22, pnpm, Foundry, Postgres 16, Redis. Docker Compose is included if you would rather not install Postgres and Redis yourself (`docker compose up -d` brings up Postgres, Redis, and Anvil).

```bash
pnpm install
pnpm dev
```

- App: http://127.0.0.1:4180
- API: http://127.0.0.1:4181

Open **Connect** and choose **Anvil patron**. That account is the admin on the local chain. **Anvil guest** is a second wallet so you can buy from the patron. Both keys are Foundry's public defaults and only exist when `NEXT_PUBLIC_DEV_WALLET=true`.

Then: faucet MockPULL, open a pack, break the seal, reveal, upgrade or fuse, list and buy, battle, and claim an epoch from the burn desk. On Anvil the burn desk has **End epoch**, which only the admin can call, so you do not have to wait out the hour.

`pnpm dev` deploys only when the saved pack address has no code. `FORCE_DEPLOY=1 pnpm dev` deploys again.

## Tests

```bash
cd contracts && forge test --no-dynamic-test-linking
pnpm --filter @pullhaus/shared test
pnpm typecheck
pnpm lint
pnpm build
```

Foundry covers burn math, the VRF mock, commit-reveal, pro-rata claims, fusion, the marketplace fee split, access control, and reentrancy. The shared package locks the card-stat vector against the Solidity library.

## Configure

| Package | File |
| --- | --- |
| contracts | `contracts/.env.example` |
| backend | `backend/.env.example` |
| web | `web/.env.example` |

Leave `PULL_TOKEN` empty locally and the deploy script creates MockPULL. Point it at the real BEP-20 when you have one. The mainnet token launches on [Flap.sh](https://flap.sh). `LAUNCHPAD_URL` and `NEXT_PUBLIC_LAUNCHPAD_URL` default to `https://flap.sh`. `PULL_BURN_TO_DEAD=true` sends the burn leg to `0x000…dEaD` for tokens that have no `burn(uint256)`.

`OPENAI_API_KEY` is optional. Without it, cards use procedural SVG and template lore, and battles use the fallback narrator. `MEDIA_DRIVER` is `local`, `s3`, or `greenfield`.

`COUNTRY_BLOCK_ENABLED=true` and `BLOCKED_COUNTRIES=US,GB` (example) block those country codes from the `x-vercel-ip-country` or `cf-ipcountry` header. The age gate is always on until the browser stores a confirmation.

## Deploy

Vercel root is `web`. Railway builds `backend/Dockerfile` from `railway.toml` and checks `GET /health`. Every variable, and whether it is required, is in [DEPLOY.md](DEPLOY.md).

## Deploy details

### Contracts

Install libraries once if `contracts/lib` is missing:

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.2.0 --no-commit
forge install foundry-rs/forge-std --no-commit
```

Chainlink VRF v2.5 (subscription method, native BNB payment):

| Network | Chain id | Coordinator | Key hash |
| --- | --- | --- | --- |
| BSC | 56 | `0xd691f04bc0C9a24Edb78af9E005Cf85768F694C9` | 200 gwei `0x130dba50ad435d4ecc214aad0d5820474137bd68e7e77724144f27c3c377d3d4` |
| BSC testnet | 97 | `0xDA3b641D438362C440Ac5458c57e00a712b66700` | 50 gwei `0x8596b430971ac45bdf6088665b9ad8e8630c9d5049ab54b14dff711bee7c0e26` |
| opBNB testnet | 5611 | none published | mock coordinator |
| Anvil | 31337 | mock | mock |

opBNB mainnet (204) is the same: no published VRF v2.5 coordinator. Do not silently deploy the mock there. The script refuses a mock on chain ids other than 31337 and 5611 unless `ALLOW_MOCK_VRF=true`.

BSC testnet LINK, if you fund with LINK instead of BNB: `0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06`. The faucet is https://faucets.chain.link/bnb-chain-testnet. Mainnet LINK is `0x404460C6A5EdE2D891e8297795264fDe62ADBB75`. Bridged LINK on BSC is not ERC-677; convert it with PegSwap before funding a LINK subscription. Native BNB payment (`VRF_NATIVE_PAYMENT=true`) avoids that.

Subscription steps:

1. Create a subscription at https://vrf.chain.link and fund it (BNB for native payment, or LINK).
2. Deploy with `VRF_COORDINATOR`, `VRF_KEY_HASH`, and `VRF_SUB_ID` set. Minimum confirmations on BSC are 3. Callback gas default is 2,000,000, under the coordinator max of 2,500,000.
3. Add the pack contract as a consumer:

```bash
PACKS_ADDRESS=0x... VRF_COORDINATOR=0x... VRF_SUB_ID=123 \
  forge script script/Deploy.s.sol:AddConsumer --rpc-url bsc_testnet --broadcast
```

Example:

```bash
source .env
forge script script/Deploy.s.sol:Deploy --rpc-url bsc_testnet --broadcast
```

The script writes `contracts/deployments/local.json`. Point the backend `DEPLOYMENT_PATH` at that file and set `BASE_URI` to the public API origin plus `/metadata/`.

### API on Railway

`railway.toml` builds `backend/Dockerfile` from the repo root. Set the root directory to the repository root. Give it `DATABASE_URL`, `REDIS_URL`, `RPC_URL`, `DEPLOYMENT_PATH` (or bake the json into the image), `JWT_SECRET`, `WEB_ORIGIN`, `PUBLIC_URL`, and a keeper key only if you are running the mock coordinator. Run `prisma migrate deploy` on boot; the Dockerfile does. Health check is `GET /health`.

### Web on Vercel

Set the project root to `web`. Framework is Next.js. Set `NEXT_PUBLIC_API_URL` to the Railway origin. Leave `NEXT_PUBLIC_DEV_WALLET` unset on a public deployment. `COUNTRY_BLOCK_ENABLED` and `BLOCKED_COUNTRIES` are server variables for the middleware.

## Privacy

Sealed cards are hidden from public getters, public events, and the public API. The owner can read them, and a SIWE session can fetch private art. The seed is still in contract storage, and VRF calldata is public. That is documented honestly in `docs/zk-phase2.md`, which is the plan for proving a rarity without revealing the card. v1 does not implement that proof.

## Odds

Default pack table, in basis points: Common 6200, Rare 2600, Epic 1000, Legendary 200, Mythic 0. Tier boosts move weight off common (150 / 300 / 500 / 800 bps at tiers 1–4) into rare, epic, and legendary. The live numbers are whatever the admin has set; the odds page reads the contract.
