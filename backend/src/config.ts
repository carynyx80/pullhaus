import "dotenv/config";
import { readFileSync } from "node:fs";
import { getAddress, type Address } from "viem";
import { emptyDeployment, ZERO, type Deployment } from "@pullhaus/shared";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const production = process.env.NODE_ENV === "production";

function setting(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (production) throw new Error(`${name} is required in production`);
  return fallback;
}

const jwtSecret = process.env.JWT_SECRET || (production ? "" : "pullhaus-local-dev-secret");
if (production && (!jwtSecret || jwtSecret === "replace-me" || jwtSecret === "pullhaus-local-dev-secret")) {
  throw new Error("JWT_SECRET must be a unique value in production");
}

export const config = {
  port: num(process.env.PORT, 4181),
  host: process.env.HOST || "0.0.0.0",
  databaseUrl: setting("DATABASE_URL", "postgresql://pullhaus:pullhaus@127.0.0.1:5432/pullhaus"),
  redisUrl: setting("REDIS_URL", "redis://127.0.0.1:6379"),
  rpcUrl: setting("RPC_URL", "http://127.0.0.1:8545"),
  deploymentPath: process.env.DEPLOYMENT_PATH || "",
  keeperKey: (process.env.KEEPER_PRIVATE_KEY || "") as `0x${string}`,
  webOrigin: setting("WEB_ORIGIN", "http://127.0.0.1:4180"),
  publicUrl: setting("PUBLIC_URL", "http://127.0.0.1:4181"),
  jwtSecret,
  storageDir: process.env.STORAGE_DIR || "storage",
  openaiKey: process.env.OPENAI_API_KEY || "",
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
  mediaDriver: (process.env.MEDIA_DRIVER || "local") as "local" | "s3" | "greenfield",
  countryBlock: process.env.COUNTRY_BLOCK_ENABLED === "true",
  blockedCountries: (process.env.BLOCKED_COUNTRIES || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
};

// Foundry's published Anvil defaults. Compared so a copied local key is refused off Anvil and opBNB testnet.
const ANVIL_KEYS = new Set([
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
]);

function addr(name: string, optional = false): Address {
  const value = process.env[name];
  if (!value) {
    if (optional) return ZERO;
    throw new Error(`${name} is required when contract addresses are set with environment variables`);
  }
  return getAddress(value);
}

function deploymentFromEnv(): Deployment | null {
  if (!process.env.PULL_ADDRESS && !process.env.PACKS_ADDRESS) return null;
  return {
    chainId: num(process.env.CHAIN_ID, 56),
    pull: addr("PULL_ADDRESS"),
    cards: addr("CARDS_ADDRESS"),
    rewards: addr("REWARDS_ADDRESS"),
    packs: addr("PACKS_ADDRESS"),
    marketplace: addr("MARKET_ADDRESS"),
    forge: addr("FORGE_ADDRESS"),
    vrfCoordinator: addr("VRF_COORDINATOR"),
    admin: addr("ADMIN_ADDRESS", true),
    indexer: addr("INDEXER_ADDRESS"),
    keeper: addr("KEEPER_ADDRESS", true),
    treasury: addr("TREASURY_ADDRESS", true),
    mockVrf: process.env.MOCK_VRF === "true",
    mockToken: process.env.MOCK_TOKEN === "true",
    localTools: process.env.LOCAL_TOOLS === "true",
    blockNumber: num(process.env.INDEX_FROM_BLOCK, 0),
  };
}

export function loadDeployment(): Deployment {
  const fromEnv = deploymentFromEnv();
  if (fromEnv) return fromEnv;
  if (!config.deploymentPath) return emptyDeployment();
  const raw = JSON.parse(readFileSync(config.deploymentPath, "utf8")) as Deployment;
  return raw;
}

export function keeperAllowed(chainId: number, key: string): boolean {
  if (!key) return false;
  const local = chainId === 31337 || chainId === 5611;
  if (ANVIL_KEYS.has(key.toLowerCase()) && !local) return false;
  return true;
}
