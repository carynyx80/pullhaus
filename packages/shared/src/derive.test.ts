import assert from "node:assert/strict";
import test from "node:test";
import { applyTier, deriveStats, rollRarity, scaledStat } from "./derive.js";

test("derive matches the Solidity golden vector", () => {
  const stats = deriveStats(1n, 2);
  assert.deepEqual(stats, { element: 1, ability: 3, atk: 78, def: 94, spd: 97 });
  assert.equal(scaledStat(100, 1), 100);
  assert.equal(scaledStat(100, 2), 108);
});

test("mythic odds of zero are unreachable and a full mythic table rolls mythic", () => {
  const odds = { common: 6200, rare: 2600, epic: 1000, legendary: 200, mythic: 0 };
  for (let i = 1; i <= 40; i++) assert.ok(rollRarity(BigInt(i), odds) < 4);
  assert.equal(rollRarity(123n, { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 10000 }), 4);
});

test("tier boost preserves 10000", () => {
  const next = applyTier({ common: 6200, rare: 2600, epic: 1000, legendary: 200, mythic: 0 }, [0, 150, 301, 0, 0], 2);
  const sum = next.common + next.rare + next.epic + next.legendary + next.mythic;
  assert.equal(sum, 10000);
  assert.equal(next.common, 5899);
});
