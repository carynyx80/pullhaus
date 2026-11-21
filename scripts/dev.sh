#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.foundry/bin:$PATH"

if command -v pg_isready >/dev/null && ! pg_isready -q; then
  sudo pg_ctlcluster 16 main start || true
fi
if command -v redis-cli >/dev/null && ! redis-cli ping >/dev/null 2>&1; then
  sudo service redis-server start || redis-server --daemonize yes
fi

if ! cast block-number --rpc-url http://127.0.0.1:8545 >/dev/null 2>&1; then
  if command -v tmux >/dev/null; then
    tmux -f /exec-daemon/tmux.portal.conf new-session -d -s pullhaus-anvil -- anvil --host 127.0.0.1 --port 8545 --chain-id 31337 || anvil --host 127.0.0.1 --port 8545 --chain-id 31337 &
  else
    anvil --host 127.0.0.1 --port 8545 --chain-id 31337 >/tmp/pullhaus-anvil.log 2>&1 &
  fi
  sleep 0.4
fi

if [[ ! -d contracts/lib/openzeppelin-contracts ]]; then
  (cd contracts && forge install OpenZeppelin/openzeppelin-contracts@v5.2.0 --no-commit && forge install foundry-rs/forge-std --no-commit)
fi

PACKS="$(node -e "try{console.log(require('./contracts/deployments/local.json').packs)}catch{console.log('')}" 2>/dev/null || true)"
CODE="0x"
if [[ -n "${PACKS}" ]]; then
  CODE="$(cast code "$PACKS" --rpc-url http://127.0.0.1:8545 || echo 0x)"
fi
# LOCAL ANVIL DEV CONFIG ONLY.
# The keys below are Foundry's published Anvil defaults (accounts 0, 1, and 2).
# They are not secrets. Never point this script at BSC, opBNB, or any public RPC.
if [[ "${FORCE_DEPLOY:-}" == "1" || "${CODE}" == "0x" ]]; then
  (
    cd contracts
    DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
    ADMIN_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
    TREASURY_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
    INDEXER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
    KEEPER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
    forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast
  )
fi

if [[ ! -f backend/.env ]]; then
  cat > backend/.env <<'EOF'
DATABASE_URL=postgresql://pullhaus:pullhaus@127.0.0.1:5432/pullhaus
REDIS_URL=redis://127.0.0.1:6379
RPC_URL=http://127.0.0.1:8545
DEPLOYMENT_PATH=../contracts/deployments/local.json
KEEPER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
PORT=4181
WEB_ORIGIN=http://127.0.0.1:4180
PUBLIC_URL=http://127.0.0.1:4181
JWT_SECRET=pullhaus-local-dev-secret
MEDIA_DRIVER=local
COUNTRY_BLOCK_ENABLED=false
BLOCKED_COUNTRIES=
EOF
fi
if [[ ! -f web/.env.local ]]; then
  # LOCAL ANVIL DEV CONFIG ONLY. Foundry's published default keys. This file is gitignored.
  cat > web/.env.local <<'EOF'
NEXT_PUBLIC_API_URL=http://127.0.0.1:4181
NEXT_PUBLIC_DEV_WALLET=true
NEXT_PUBLIC_ANVIL_RPC=http://127.0.0.1:8545
NEXT_PUBLIC_ANVIL_PATRON_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
NEXT_PUBLIC_ANVIL_GUEST_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
EOF
fi

pnpm install
pnpm --filter @pullhaus/shared build
pnpm --filter @pullhaus/backend exec prisma generate
pnpm --filter @pullhaus/backend exec prisma db push
pnpm dev:apps
