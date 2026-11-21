import "dotenv/config";
import { readFileSync } from "node:fs";
import { emptyDeployment, type Deployment } from "@pullhaus/shared";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 4181),
  host: process.env.HOST || "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL || "postgresql://pullhaus:pullhaus@127.0.0.1:5432/pullhaus",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  deploymentPath: process.env.DEPLOYMENT_PATH || "",
  keeperKey: (process.env.KEEPER_PRIVATE_KEY || "") as `0x${string}`,
  webOrigin: process.env.WEB_ORIGIN || "http://127.0.0.1:4180",
  publicUrl: process.env.PUBLIC_URL || "http://127.0.0.1:4181",
  jwtSecret: process.env.JWT_SECRET || "pullhaus-local-dev-secret",
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

const ANVIL_KEYS = new Set([
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
]);

export function loadDeployment(): Deployment {
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
