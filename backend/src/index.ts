import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { cardIdentity, resolveBattle, scaledStat, sealedSvg, type Fighter } from "@pullhaus/shared";
import Fastify from "fastify";
import { z } from "zod";
import { narrateBattle } from "./ai.js";
import { issueNonce, readAddress, signToken, verifySiwe } from "./auth.js";
import { publicClient } from "./chain.js";
import { config, loadDeployment } from "./config.js";
import { prisma } from "./db.js";
import { hub } from "./hub.js";
import { startIndexer } from "./indexer.js";
import { startJobs } from "./jobs.js";
import { startKeeper } from "./keeper.js";
import { mediaPath } from "./media.js";

const deployment = loadDeployment();
const app = Fastify({ logger: true });

await app.register(cors, { origin: config.webOrigin, credentials: true });
await app.register(websocket);

app.addHook("onRequest", async (req, reply) => {
  if (!config.countryBlock || req.url.startsWith("/health")) return;
  const country = String(req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || "").toUpperCase();
  if (country && config.blockedCountries.includes(country)) {
    return reply.code(451).send({ error: "Pullhaus is not offered in your country." });
  }
});

function auth(req: { headers: { authorization?: string } }): string | null {
  return readAddress(req.headers.authorization);
}

function present(card: {
  tokenId: string;
  owner: string;
  burned: boolean;
  revealed: boolean;
  rarity: number | null;
  level: number;
  element: number | null;
  atk: number | null;
  def: number | null;
  spd: number | null;
  ability: number | null;
  setId: number | null;
  seed: string | null;
  name: string | null;
  lore: string | null;
  imageUrl: string | null;
}, full: boolean) {
  if (!full && !card.revealed) {
    return { tokenId: card.tokenId, owner: card.owner, burned: card.burned, revealed: false, name: "Sealed card", imageUrl: null };
  }
  const level = card.level || 1;
  return {
    ...card,
    seed: full || card.revealed ? card.seed : null,
    atk: card.atk == null ? null : scaledStat(card.atk, level),
    def: card.def == null ? null : scaledStat(card.def, level),
    spd: card.spd == null ? null : scaledStat(card.spd, level),
    baseAtk: card.atk,
    baseDef: card.def,
    baseSpd: card.spd,
  };
}

app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  const block = deployment.pull === "0x0000000000000000000000000000000000000000" ? 0n : await publicClient(deployment).getBlockNumber();
  return { ok: true, chainId: deployment.chainId, block: block.toString() };
});

app.get("/config", async () => ({
  ...deployment,
  publicUrl: config.publicUrl,
  wsUrl: config.publicUrl.replace(/^http/, "ws") + "/ws",
}));

app.get("/auth/nonce", async () => ({ nonce: await issueNonce() }));

app.post("/auth/verify", async (req, reply) => {
  const body = z.object({ message: z.string(), signature: z.string() }).parse(req.body);
  const host = new URL(config.webOrigin).hostname;
  try {
    const address = await verifySiwe(body.message, body.signature, host);
    return { token: signToken(address), address };
  } catch (error) {
    return reply.code(401).send({ error: error instanceof Error ? error.message : "Sign-in failed" });
  }
});

app.get("/inventory", async (req, reply) => {
  const address = auth(req);
  if (!address) return reply.code(401).send({ error: "Sign in with your wallet to open the private atelier." });
  const cards = await prisma.cardRecord.findMany({ where: { owner: address, burned: false }, orderBy: { tokenId: "asc" } });
  return { cards: cards.map((card) => present(card, true)) };
});

app.get("/cards/:id", async (req) => {
  const { id } = req.params as { id: string };
  const card = await prisma.cardRecord.findUnique({ where: { tokenId: id } });
  if (!card) return { card: null };
  return { card: present(card, false) };
});

app.get("/cards/:id/private", async (req, reply) => {
  const address = auth(req);
  if (!address) return reply.code(401).send({ error: "Sign in required" });
  const { id } = req.params as { id: string };
  const card = await prisma.cardRecord.findUnique({ where: { tokenId: id } });
  if (!card || card.owner !== address) return reply.code(404).send({ error: "Not in your atelier" });
  return { card: present(card, true) };
});

app.get("/market", async () => {
  const listings = await prisma.listingRecord.findMany({ where: { active: true }, orderBy: { tokenId: "asc" } });
  const cards = await prisma.cardRecord.findMany({ where: { tokenId: { in: listings.map((l) => l.tokenId) } } });
  const byId = new Map(cards.map((c) => [c.tokenId, c]));
  return { listings: listings.map((listing) => ({ ...listing, card: byId.get(listing.tokenId) ? present(byId.get(listing.tokenId)!, false) : null })) };
});

app.get("/leaderboard", async (req) => {
  const season = Number((req.query as { season?: string }).season || 0);
  const chosen = season || (await prisma.seasonScore.aggregate({ _max: { season: true } }))._max.season || 1;
  const rows = await prisma.$queryRaw<{ address: string; points: string; season: number }[]>`
    SELECT address, points, season FROM "SeasonScore" WHERE season = ${chosen} ORDER BY points::numeric DESC LIMIT 50
  `;
  const stats = await prisma.walletStat.findMany({ where: { address: { in: rows.map((r) => r.address) } } });
  const tiers = new Map(stats.map((s) => [s.address, s.tier]));
  return { season: chosen, rows: rows.map((row, index) => ({ rank: index + 1, ...row, tier: tiers.get(row.address) ?? 0 })) };
});

app.get("/epochs", async () => ({ epochs: await prisma.epochRecord.findMany({ orderBy: { id: "desc" }, take: 12 }) }));

app.post("/battles", async (req, reply) => {
  const body = z.object({ attackerId: z.string(), defenderId: z.string() }).parse(req.body);
  const address = auth(req);
  const [a, b] = await Promise.all([
    prisma.cardRecord.findUnique({ where: { tokenId: body.attackerId } }),
    prisma.cardRecord.findUnique({ where: { tokenId: body.defenderId } }),
  ]);
  if (!a || !b || a.burned || b.burned) return reply.code(404).send({ error: "Both cards need to exist." });
  const canSee = (card: typeof a) => card.revealed || card.owner === address;
  if (!canSee(a) || !canSee(b)) return reply.code(403).send({ error: "A sealed card can only be battled by its owner." });
  const toFighter = (card: typeof a): Fighter => {
    const identity = cardIdentity(BigInt(card.seed || "0"), card.rarity ?? 0, card.element ?? 0, card.ability ?? 0);
    return {
      id: card.tokenId,
      name: card.name || identity.name,
      atk: card.atk ?? 0,
      def: card.def ?? 0,
      spd: card.spd ?? 0,
      element: card.element ?? 0,
      ability: card.ability ?? 0,
      level: card.level,
      seed: BigInt(card.seed || "0"),
    };
  };
  const result = resolveBattle(toFighter(a), toFighter(b));
  const facts = result.rounds.map((round) => `${round.name}: ${round.line}`).join("\n");
  const narration = (await narrateBattle(facts)) || result.narration;
  const saved = await prisma.battleRecord.create({
    data: {
      attackerId: a.tokenId,
      defenderId: b.tokenId,
      winnerId: result.winnerId,
      scoreA: result.scoreA,
      scoreB: result.scoreB,
      rounds: result.rounds,
      narration,
    },
  });
  return { battle: saved, result: { ...result, narration } };
});

app.get("/metadata/sealed/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  reply.type("application/json");
  return {
    name: `Sealed Pullhaus #${id}`,
    description: "This pull is still sealed. Attributes stay with the owner until the card is revealed.",
    image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sealedSvg(id))}`,
  };
});

app.get("/metadata/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const card = await prisma.cardRecord.findUnique({ where: { tokenId: id } });
  reply.type("application/json");
  if (!card?.revealed) {
    return {
      name: `Sealed Pullhaus #${id}`,
      description: "This pull is still sealed.",
      image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sealedSvg(id))}`,
    };
  }
  return {
    name: card.name,
    description: card.lore,
    image: card.imageUrl,
    attributes: [
      { trait_type: "Rarity", value: card.rarity },
      { trait_type: "Element", value: card.element },
      { trait_type: "ATK", value: card.atk },
      { trait_type: "DEF", value: card.def },
      { trait_type: "SPD", value: card.spd },
      { trait_type: "Level", value: card.level },
    ],
  };
});

app.get("/media/*", async (req, reply) => {
  const key = (req.params as { "*": string })["*"];
  const file = mediaPath(key);
  if (!existsSync(file)) return reply.code(404).send({ error: "Missing media" });
  const ext = path.extname(file);
  reply.type(ext === ".png" ? "image/png" : ext === ".svg" ? "image/svg+xml" : "application/octet-stream");
  return reply.send(createReadStream(file));
});

app.get("/ws", { websocket: true }, (socket) => {
  hub.add(socket);
  socket.on("close", () => hub.remove(socket));
});

app.setErrorHandler((error, _req, reply) => {
  const message = error instanceof Error ? error.message : "Request failed";
  reply.code(400).send({ error: message });
});

startJobs(deployment);
startIndexer(deployment);
startKeeper(deployment);

await app.listen({ port: config.port, host: config.host });
