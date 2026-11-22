# Deploy Pullhaus

Vercel serves the site. Railway serves the API. Both build from this repository. Contract addresses are set on Railway after you deploy the Foundry script. No secret belongs in git. `.env`, `.env.local`, and `.env.*.local` are gitignored. `web/.env.example` is the only web env file that is tracked, and the Anvil keys in it are Foundry's published defaults for local play.

## Vercel

Project settings:

- Root Directory: `web`
- Framework: Next.js (also set in `web/vercel.json`)
- Include source files outside the Root Directory in the Build Step: on. The install command leaves `web/` and runs `pnpm install` from the repository root so the workspace and `packages/shared` are visible.
- Node.js 22

`web/vercel.json` sets the commands Vercel runs with its working directory in `web/`:

- Install: `cd .. && corepack enable && corepack prepare pnpm@10.33.4 --activate && pnpm install --frozen-lockfile`
- Build: `cd .. && pnpm --filter @pullhaus/shared build && pnpm --filter @pullhaus/web build`

The shared package compiles to `dist/` during that build. Next reads those files. Do not set the production site to use the Anvil dev wallet.

### Vercel environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Required | Public Railway origin, no trailing slash. Example: `https://pullhaus-api.up.railway.app` |
| `NEXT_PUBLIC_CHAIN_ID` | Optional | Chain wallets are pointed at. Default: BSC testnet `97` in production, Anvil in dev. Set `56` for mainnet. |
| `NEXT_PUBLIC_PULL_TOKEN_ADDRESS` | Optional | Mainnet `$PULL` bought on the swap page (BNB Smart Chain, chain 56). Leave unset until the token launches. Do not use a placeholder. When unset, the page stays on “Launching soon” unless `/config` returns `pullTrade`, or the game deployment itself is chain 56 with a real token. |
| `NEXT_PUBLIC_FOUR_MEME_URL` | Optional | https link for the four.meme launch. Default `https://four.meme`. The site env wins over the API when it is set. |
| `COUNTRY_BLOCK_ENABLED` | Optional | `true` turns on the country block. Default off. Read by Next middleware. Not exposed to the browser. |
| `BLOCKED_COUNTRIES` | Optional | Comma-separated ISO codes, used only when the toggle is `true`. Example: `US,GB`. Matched against `x-vercel-ip-country`. |
| `NEXT_PUBLIC_DEV_WALLET` | Leave unset | Local only. `true` shows the Anvil patron and guest buttons. Do not set this on Vercel. |
| `NEXT_PUBLIC_ANVIL_RPC` | Leave unset | Local only. Defaults to `http://127.0.0.1:8545` in dev. |
| `NEXT_PUBLIC_ANVIL_PATRON_KEY` | Leave unset | Local only. Foundry's published Anvil account 0. `scripts/dev.sh` writes it into gitignored `web/.env.local`. |
| `NEXT_PUBLIC_ANVIL_GUEST_KEY` | Leave unset | Local only. Foundry's published Anvil account 2. Same local file. |

## Railway

Service settings:

- Root directory: repository root, not `backend`. The Docker build context has to see `package.json`, `pnpm-lock.yaml`, `packages/shared`, and `backend`.
- Config file: `railway.toml` at the repository root.
- Builder: Dockerfile. `railway.toml` sets `dockerfilePath = "backend/Dockerfile"`.
- Healthcheck path: `/health` (also set in `railway.toml`, timeout 120 seconds). The process listens on `0.0.0.0` and Railway's `PORT`.
- Add a Postgres plugin and a Redis plugin, and attach their URLs to this service.

The image installs with pnpm 10.33.4, builds `@pullhaus/shared` and the API, generates the Prisma client, and on boot runs `prisma migrate deploy` then `node dist/index.js`.

Contract addresses come from environment variables. That overrides `DEPLOYMENT_PATH`. Use the addresses printed by `forge script`.

### Railway environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Required | Railway Postgres connection string. |
| `REDIS_URL` | Required | Railway Redis connection string. BullMQ and the card-generation queue use it. |
| `RPC_URL` | Required | BNB Chain RPC. BSC `https://bsc-dataseed.binance.org`, testnet `https://data-seed-prebsc-1-s1.binance.org:8545`. |
| `CHAIN_ID` | Required | `56` BSC, `97` BSC testnet, `5611` opBNB testnet. |
| `WEB_ORIGIN` | Required | Vercel origin, no path. CORS and SIWE domain checks use it. Example: `https://pullhaus.vercel.app` |
| `PUBLIC_URL` | Required | This API's public origin. Media URLs and the websocket URL are built from it. |
| `JWT_SECRET` | Required | Long random string. The process refuses to boot in production when it is missing, `replace-me`, or the local dev placeholder. |
| `PULL_ADDRESS` | Required | Deployed `$PULL` or MockPULL. |
| `CARDS_ADDRESS` | Required | `PullhausCards` |
| `REWARDS_ADDRESS` | Required | `PullhausRewards` |
| `PACKS_ADDRESS` | Required | `PullhausPacks` |
| `MARKET_ADDRESS` | Required | `PullhausMarketplace` |
| `FORGE_ADDRESS` | Required | `PullhausForge` |
| `VRF_COORDINATOR` | Required | Chainlink coordinator, or the mock on opBNB testnet. |
| `INDEXER_ADDRESS` | Required | Address granted `INDEXER_ROLE` at deploy. The indexer reads sealed cards with `eth_call` from this address. |
| `PORT` | Optional | Railway sets this. Default in the image is `8080`. |
| `HOST` | Optional | Default `0.0.0.0`. |
| `ADMIN_ADDRESS` | Optional | Informational. Admin transactions are sent by that wallet from the web app, not by the API. |
| `TREASURY_ADDRESS` | Optional | Informational for the API config payload. |
| `KEEPER_ADDRESS` | Optional | Address allowed to call the mock coordinator. Not a private key. |
| `KEEPER_PRIVATE_KEY` | Optional | Only if this service should submit mock-VRF fulfillments. Refused when it is a Foundry Anvil default and the chain is not 31337 or 5611. Leave unset on BSC. |
| `MOCK_VRF` | Optional | `true` on opBNB testnet if you deployed the mock coordinator. `false` or unset on BSC. |
| `MOCK_TOKEN` | Optional | `true` only when the pull token is MockPULL. |
| `LOCAL_TOOLS` | Optional | Leave unset. `true` exposes the Anvil-only epoch shortcut. The contracts themselves enable that only on chain id 31337. |
| `INDEX_FROM_BLOCK` | Optional | First block to scan. Use the deploy block. Default `0`. |
| `DEPLOYMENT_PATH` | Optional | JSON file instead of the address variables. Railway should use the address variables. Local dev points this at `contracts/deployments/local.json`. |
| `OPENAI_API_KEY` | Optional | Richer lore, images, and battle narration. Without it the API uses procedural SVG and the template narrator. |
| `OPENAI_TEXT_MODEL` | Optional | Default `gpt-4o-mini`. |
| `OPENAI_IMAGE_MODEL` | Optional | Default `dall-e-3`. |
| `MEDIA_DRIVER` | Optional | `local` (default), `s3`, or `greenfield`. |
| `STORAGE_DIR` | Optional | Disk path for `local` media. Default `storage` under the API working directory. |
| `S3_ENDPOINT` | Optional | Required only when `MEDIA_DRIVER=s3`. |
| `S3_REGION` | Optional | Required only when `MEDIA_DRIVER=s3`. Default `us-east-1`. |
| `S3_BUCKET` | Optional | Required only when `MEDIA_DRIVER=s3`. |
| `S3_ACCESS_KEY_ID` | Optional | Required only when `MEDIA_DRIVER=s3`. |
| `S3_SECRET_ACCESS_KEY` | Optional | Required only when `MEDIA_DRIVER=s3`. |
| `S3_PUBLIC_URL` | Optional | Public base URL for objects. Required only when `MEDIA_DRIVER=s3` if the endpoint URL is not the public URL. |
| `GREENFIELD_RPC_URL` | Optional | Required only when `MEDIA_DRIVER=greenfield`. |
| `GREENFIELD_CHAIN_ID` | Optional | Required only when `MEDIA_DRIVER=greenfield`. Testnet is `5600`. |
| `GREENFIELD_BUCKET` | Optional | Required only when `MEDIA_DRIVER=greenfield`. |
| `GREENFIELD_PRIVATE_KEY` | Optional | Required only when `MEDIA_DRIVER=greenfield`. A failed upload is stored locally. |
| `GREENFIELD_PUBLIC_URL` | Optional | Public object base. Falls back to the RPC URL. |
| `COUNTRY_BLOCK_ENABLED` | Optional | `true` makes the API return 451 for blocked countries. |
| `BLOCKED_COUNTRIES` | Optional | Comma-separated ISO codes. Matched against `x-vercel-ip-country` or `cf-ipcountry`. |
| `PULL_TRADE_ADDRESS` | Optional | Mainnet `$PULL` returned as `pullTrade` on `GET /config`. Leave unset until launch. The web env `NEXT_PUBLIC_PULL_TOKEN_ADDRESS` wins when both are set. On chain 56, a non-mock `PULL_ADDRESS` is used when neither trade address is set. |
| `FOUR_MEME_URL` | Optional | https link returned as `fourMemeUrl` on `GET /config`. Default `https://four.meme`. |

Set the same `COUNTRY_BLOCK_ENABLED` and `BLOCKED_COUNTRIES` on Vercel and Railway if you want both the page and the API to block.

## Order

1. Deploy contracts with your own key. Do not use the Anvil key.
2. Create the Railway service, set the required variables, and confirm `GET /health` returns `{"ok":true}`.
3. Create the Vercel project with root `web`, set `NEXT_PUBLIC_API_URL`, and deploy.
4. Set Railway `WEB_ORIGIN` to the Vercel URL and redeploy the API so SIWE and CORS match that host.

## BSC testnet deployment (chain 97)

Live testnet addresses. The same values are in `contracts/deployments/bsc-testnet.json`. This deployment uses MockPULL (anyone can call its faucet) and the mock VRF coordinator, so pack randomness is not secure. Do not reuse it for mainnet. Mainnet keeps the Chainlink VRF v2.5 path in `script/Deploy.s.sol`.

| Contract | Address |
| --- | --- |
| MockPULL | [`0x9E88f787e10f98BBeb2496f0C790Db14A7C1AE0d`](https://testnet.bscscan.com/address/0x9E88f787e10f98BBeb2496f0C790Db14A7C1AE0d) |
| MockVRFCoordinator | [`0xAEfB5fC32EFdF7B4dA8844E07CFBE4b3c1C89Ade`](https://testnet.bscscan.com/address/0xAEfB5fC32EFdF7B4dA8844E07CFBE4b3c1C89Ade) |
| PullhausCards | [`0xACcF82717A04461cf15c9390F668443442473C9d`](https://testnet.bscscan.com/address/0xACcF82717A04461cf15c9390F668443442473C9d) |
| PullhausRewards | [`0xFaBE07794B241e181F84311Db3FAEb374439Bb89`](https://testnet.bscscan.com/address/0xFaBE07794B241e181F84311Db3FAEb374439Bb89) |
| PullhausPacks | [`0x43f3dB6DbB788e10Bf9Fe15DD22FABF854f7773b`](https://testnet.bscscan.com/address/0x43f3dB6DbB788e10Bf9Fe15DD22FABF854f7773b) |
| PullhausMarketplace | [`0xA2cBb0212e60135B7441E138FB7204B921C8B83c`](https://testnet.bscscan.com/address/0xA2cBb0212e60135B7441E138FB7204B921C8B83c) |
| PullhausForge | [`0xe8cAa7960Da8F20dBB3c4cf91e3123a9A6819911`](https://testnet.bscscan.com/address/0xe8cAa7960Da8F20dBB3c4cf91e3123a9A6819911) |

- First deploy block: `144105973` (Railway `INDEX_FROM_BLOCK`).
- Admin (`DEFAULT_ADMIN_ROLE` on every game contract) and treasury: company wallet `0x32CeB2b3564437038b031d1F1EE16e6AcD3aDFD4`.
- Keeper and indexer: `0xae1529CC620d1Ada515d4365d17705db7Cf045fa`, a testnet-only hot wallet. It owns the mock coordinator, holds `INDEXER_ROLE` on PullhausCards, and holds no admin role. Its key lives only in Railway `KEEPER_PRIVATE_KEY`.
- Testnet tiers: 100 / 300 / 800 / 2,000 PULL. The Mythic forge burn is 500 PULL. Reward epochs last 1 day. When an epoch ends, anyone can call `finalizeEpoch`, and the admin wallet starts the next one from the admin page (`startEpoch`).
- Railway uses `RPC_URL=https://bsc-testnet-rpc.publicnode.com`, `CHAIN_ID=97`, `MOCK_VRF=true`, and `MOCK_TOKEN=true`.
- On Vercel, the site defaults wallets to BSC testnet in production. Set `NEXT_PUBLIC_CHAIN_ID` to override that, for example `56` at mainnet launch.

Redeploy command (secrets come from your shell, never from git):

```bash
cd contracts
ADMIN_ADDRESS=0x32Ce... TREASURY_ADDRESS=0x32Ce... KEEPER_ADDRESS=<keeper> INDEXER_ADDRESS=<keeper> \
ALLOW_MOCK_VRF=true BASE_URI=https://pullhaus-api-production.up.railway.app/metadata/ \
TIER1=100000000000000000000 TIER2=300000000000000000000 TIER3=800000000000000000000 TIER4=2000000000000000000000 \
MYTHIC_BURN=500000000000000000000 EPOCH_DURATION=86400 DEPLOYER_PRIVATE_KEY=<from your secret store> \
forge script script/Deploy.s.sol:Deploy --rpc-url https://bsc-testnet-rpc.publicnode.com --broadcast --legacy --with-gas-price 1000000000 --slow
```

The script writes `deployments/local.json`. Copy the result to `deployments/bsc-testnet.json`, set `blockNumber` to the first receipt block, and restore `local.json`.
