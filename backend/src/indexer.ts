import { decodeEventLog, type Abi, type Address, type Log } from "viem";
import type { Deployment } from "@pullhaus/shared";
import { abi, publicClient, readGameCard } from "./chain.js";
import { prisma } from "./db.js";
import { enqueueCard } from "./jobs.js";
import { hub } from "./hub.js";
import { cardIdentity } from "@pullhaus/shared";

const zero = "0x0000000000000000000000000000000000000000";

function idOf(value: bigint | number | string): string {
  return value.toString();
}

async function upsertCardShell(tokenId: string, owner?: string) {
  await prisma.cardRecord.upsert({
    where: { tokenId },
    create: { tokenId, owner: owner?.toLowerCase() ?? zero },
    update: owner ? { owner: owner.toLowerCase() } : {},
  });
}

async function hydrate(deployment: Deployment, tokenId: string) {
  const card = await readGameCard(deployment, BigInt(tokenId));
  const identity = cardIdentity(card.seed, card.rarity, card.element, card.ability);
  await prisma.cardRecord.update({
    where: { tokenId },
    data: {
      rarity: card.rarity,
      level: card.level,
      element: card.element,
      atk: card.atk,
      def: card.def,
      spd: card.spd,
      ability: card.ability,
      setId: card.setId,
      seed: card.seed.toString(),
      revealed: card.revealed,
      name: identity.name,
      lore: identity.lore,
    },
  });
  await enqueueCard(tokenId);
}

export function startIndexer(deployment: Deployment) {
  const client = publicClient(deployment);
  const addresses = [deployment.cards, deployment.packs, deployment.rewards, deployment.marketplace].map(
    (a) => a.toLowerCase(),
  );
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const cursor = await prisma.cursor.upsert({ where: { id: 1 }, create: { id: 1, block: deployment.blockNumber }, update: {} });
      const latest = Number(await client.getBlockNumber());
      let from = cursor.block;
      while (from <= latest) {
        const to = Math.min(latest, from + 900);
        const logs = await client.getLogs({
          fromBlock: BigInt(from),
          toBlock: BigInt(to),
          address: addresses as Address[],
        });
        for (const log of logs) await applyLog(deployment, log);
        from = to + 1;
        await prisma.cursor.update({ where: { id: 1 }, data: { block: from } });
      }
    } catch (error) {
      console.warn("indexer", error);
    } finally {
      running = false;
    }
  };
  void tick();
  setInterval(() => void tick(), 2000);
}

async function applyLog(deployment: Deployment, log: Log) {
  const lid = `${log.transactionHash}:${log.logIndex}`;
  if (await prisma.processedLog.findUnique({ where: { id: lid } })) return;
  const address = log.address.toLowerCase();
  const table: { address: string; abi: Abi }[] = [
    { address: deployment.cards.toLowerCase(), abi: abi.cards },
    { address: deployment.packs.toLowerCase(), abi: abi.packs },
    { address: deployment.rewards.toLowerCase(), abi: abi.rewards },
    { address: deployment.marketplace.toLowerCase(), abi: abi.market },
  ];
  const match = table.find((row) => row.address === address);
  if (!match) return;
  let decoded: { eventName: string; args: any };
  try {
    decoded = decodeEventLog({ abi: match.abi, data: log.data, topics: log.topics }) as any;
  } catch {
    return;
  }
  const args = decoded.args ?? {};
  try {
  if (decoded.eventName === "Transfer") {
    const tokenId = idOf(args.tokenId);
    const to = String(args.to).toLowerCase();
    const from = String(args.from).toLowerCase();
    if (to === zero) {
      await prisma.cardRecord.updateMany({ where: { tokenId }, data: { burned: true, owner: zero } });
    } else {
      await upsertCardShell(tokenId, to);
      if (from === zero) await hydrate(deployment, tokenId);
    }
  } else
  if (decoded.eventName === "CardMinted") {
    await upsertCardShell(idOf(args.tokenId), String(args.to));
    await prisma.cardRecord.update({ where: { tokenId: idOf(args.tokenId) }, data: { commitment: String(args.commitment) } });
  } else
  if (decoded.eventName === "CardRevealed") {
    const tokenId = idOf(args.tokenId);
    await prisma.cardRecord.update({
      where: { tokenId },
      data: {
        revealed: true,
        rarity: Number(args.rarity),
        element: Number(args.element),
        level: Number(args.level),
        atk: Number(args.atk),
        def: Number(args.def),
        spd: Number(args.spd),
        ability: Number(args.ability),
        setId: Number(args.setId),
        seed: idOf(args.seed),
      },
    });
    hub.publish("card.revealed", { tokenId });
  } else
  if (decoded.eventName === "CardLeveled") {
    await prisma.cardRecord.update({ where: { tokenId: idOf(args.tokenId) }, data: { level: Number(args.level) } });
  } else
  if (decoded.eventName === "PackFulfilled") {
    hub.publish("pack.fulfilled", { requestId: idOf(args.requestId), user: String(args.user), tokenIds: (args.tokenIds as bigint[]).map(idOf) });
  } else
  if (decoded.eventName === "BurnAccrued") {
    const address = String(args.user).toLowerCase();
    const lifetime = idOf(args.lifetimePoints);
    const season = Number(args.season);
    await prisma.walletStat.upsert({
      where: { address },
      create: { address, lifetimePoints: lifetime },
      update: { lifetimePoints: lifetime },
    });
    const current = await prisma.seasonScore.findUnique({ where: { season_address: { season, address } } });
    const prev = BigInt(current?.points ?? "0");
    const next = (prev + BigInt(args.points)).toString();
    await prisma.seasonScore.upsert({
      where: { season_address: { season, address } },
      create: { season, address, points: idOf(args.points) },
      update: { points: next },
    });
    const tier = await publicClient(deployment).readContract({
      address: deployment.rewards,
      abi: abi.rewards,
      functionName: "tierOf",
      args: [address as Address],
    });
    await prisma.walletStat.update({ where: { address }, data: { tier: Number(tier) } });
  } else
  if (decoded.eventName === "Listed") {
    await prisma.listingRecord.upsert({
      where: { tokenId: idOf(args.tokenId) },
      create: { tokenId: idOf(args.tokenId), seller: String(args.seller).toLowerCase(), price: idOf(args.price), active: true },
      update: { seller: String(args.seller).toLowerCase(), price: idOf(args.price), active: true },
    });
  } else
  if (decoded.eventName === "Cancelled" || decoded.eventName === "Sold") {
    await prisma.listingRecord.updateMany({ where: { tokenId: idOf(args.tokenId) }, data: { active: false } });
  } else
  if (decoded.eventName === "EpochStarted") {
    await prisma.epochRecord.upsert({
      where: { id: Number(args.epochId) },
      create: { id: Number(args.epochId), start: Number(args.start), end: Number(args.end), pool: idOf(args.pool) },
      update: { start: Number(args.start), end: Number(args.end), pool: idOf(args.pool), finalized: false },
    });
  } else
  if (decoded.eventName === "EpochFinalized") {
    await prisma.epochRecord.update({
      where: { id: Number(args.epochId) },
      data: { finalized: true, pool: idOf(args.pool), totalPoints: idOf(args.totalPoints) },
    });
  }
  if (decoded.eventName === "PoolFunded" && Number(args.epochId) > 0) {
    const row = await prisma.epochRecord.findUnique({ where: { id: Number(args.epochId) } });
    if (row) {
      await prisma.epochRecord.update({
        where: { id: row.id },
        data: { pool: (BigInt(row.pool) + BigInt(args.amount)).toString() },
      });
    }
  }
  } finally {
    await prisma.processedLog.create({ data: { id: lid } }).catch(() => undefined);
  }
}
