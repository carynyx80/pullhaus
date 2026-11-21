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

Set the same `COUNTRY_BLOCK_ENABLED` and `BLOCKED_COUNTRIES` on Vercel and Railway if you want both the page and the API to block.

## Order

1. Deploy contracts with your own key. Do not use the Anvil key.
2. Create the Railway service, set the required variables, and confirm `GET /health` returns `{"ok":true}`.
3. Create the Vercel project with root `web`, set `NEXT_PUBLIC_API_URL`, and deploy.
4. Set Railway `WEB_ORIGIN` to the Vercel URL and redeploy the API so SIWE and CORS match that host.
