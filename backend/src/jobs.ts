import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { cardFaceSvg, cardIdentity, deriveStats, scaledStat } from "@pullhaus/shared";
import { enhanceLore, generateImage } from "./ai.js";
import { config } from "./config.js";
import { readGameCard } from "./chain.js";
import type { Deployment } from "@pullhaus/shared";
import { prisma } from "./db.js";
import { hub } from "./hub.js";
import { putMedia } from "./media.js";

let queue: Queue | null = null;

export function startJobs(deployment: Deployment) {
  const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  queue = new Queue("pullhaus", { connection });
  new Worker(
    "pullhaus",
    async (job) => {
      if (job.name === "generate") await generateCard(deployment, String(job.data.tokenId));
    },
    { connection },
  );
}

export async function enqueueCard(tokenId: string) {
  if (!queue) return;
  try {
    await queue.add("generate", { tokenId }, { jobId: `card-${tokenId}`, removeOnComplete: 100 });
  } catch (error) {
    console.warn("enqueue", error);
  }
}

export async function generateCard(deployment: Deployment, tokenId: string) {
  const onchain = await readGameCard(deployment, BigInt(tokenId));
  const seed = onchain.seed;
  const derived = deriveStats(seed, onchain.rarity);
  const identity = cardIdentity(seed, onchain.rarity, onchain.element, onchain.ability);
  const atk = scaledStat(derived.atk, onchain.level);
  const def = scaledStat(derived.def, onchain.level);
  const spd = scaledStat(derived.spd, onchain.level);
  const lore =
    (await enhanceLore(
      `${identity.name}, ${identity.rarityName} ${identity.elementName} card. Ability ${identity.abilityName}. Stats ${atk}/${def}/${spd}.`,
    )) || identity.lore;
  const svg = cardFaceSvg({
    seed,
    rarity: onchain.rarity,
    element: onchain.element,
    name: identity.name,
    atk,
    def,
    spd,
  });
  let imageUrl = await putMedia(`cards/${tokenId}.svg`, Buffer.from(svg), "image/svg+xml");
  const png = await generateImage(
    `Square editorial illustration of a collectible card creature named ${identity.name}, ${identity.elementName} element, ${identity.rarityName} rarity, no text, tactile print, warm dark paper, gold foil.`,
  );
  if (png) imageUrl = await putMedia(`cards/${tokenId}.png`, png, "image/png");
  await prisma.cardRecord.update({
    where: { tokenId },
    data: {
      rarity: onchain.rarity,
      level: onchain.level,
      element: onchain.element,
      atk: derived.atk,
      def: derived.def,
      spd: derived.spd,
      ability: onchain.ability,
      setId: onchain.setId,
      seed: seed.toString(),
      revealed: onchain.revealed,
      name: identity.name,
      lore,
      imageUrl,
    },
  });
  hub.publish("card.ready", { tokenId, imageUrl, name: identity.name });
}
