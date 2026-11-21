import { ABILITIES, ELEMENT_BEATS, ELEMENTS } from "./constants.js";
import { mix, scaledStat } from "./derive.js";

export type Fighter = {
  id: string;
  name: string;
  atk: number;
  def: number;
  spd: number;
  element: number;
  ability: number;
  level: number;
  seed: bigint;
};

export type RoundResult = {
  name: string;
  attackerWins: boolean;
  rollA: number;
  rollB: number;
  line: string;
};

export type BattleResult = {
  winnerId: string;
  loserId: string;
  rounds: RoundResult[];
  scoreA: number;
  scoreB: number;
  narration: string;
};

const ROUNDS: { name: string; stat: "atk" | "def" | "spd"; salt: number }[] = [
  { name: "approach", stat: "spd", salt: 11 },
  { name: "clash", stat: "atk", salt: 23 },
  { name: "guard", stat: "def", salt: 37 },
  { name: "tempo", stat: "spd", salt: 41 },
  { name: "finish", stat: "atk", salt: 53 },
];

function jitter(seed: bigint, salt: number): number {
  return Number(mix(seed, BigInt(salt)) % 17n);
}

function line(round: string, winner: string, loser: string, element: string, ability: string): string {
  const table: Record<string, string> = {
    approach: `${winner} is already in the lane. ${loser} arrives a breath late.`,
    clash: `${element} answers for ${winner}. ${loser} takes the brighter hit.`,
    guard: `${loser} sets a guard. ${winner} walks through it as if the wax were warm.`,
    tempo: `${ability} turns the tempo. ${winner} spends it. ${loser} spends the pause.`,
    finish: `${winner} closes the card. ${loser} is still looking for the last line.`,
  };
  return table[round] ?? `${winner} takes the exchange.`;
}

export function resolveBattle(a: Fighter, b: Fighter): BattleResult {
  const rounds: RoundResult[] = ROUNDS.map((round, index) => {
    const advA = ELEMENT_BEATS[a.element] === b.element ? 8 : 0;
    const advB = ELEMENT_BEATS[b.element] === a.element ? 8 : 0;
    const extraA = round.name === "tempo" ? a.ability % 5 : 0;
    const extraB = round.name === "tempo" ? b.ability % 5 : 0;
    const rollA = scaledStat(a[round.stat], a.level) + advA + extraA + jitter(a.seed, round.salt + index);
    const rollB = scaledStat(b[round.stat], b.level) + advB + extraB + jitter(b.seed, round.salt + index + 100);
    const attackerWins = rollA === rollB ? a.id < b.id : rollA > rollB;
    const winner = attackerWins ? a : b;
    const loser = attackerWins ? b : a;
    return {
      name: round.name,
      attackerWins,
      rollA,
      rollB,
      line: line(round.name, winner.name, loser.name, ELEMENTS[winner.element] ?? "Void", ABILITIES[winner.ability] ?? "Quiet Crown"),
    };
  });
  const scoreA = rounds.filter((r) => r.attackerWins).length;
  const scoreB = rounds.length - scoreA;
  let winner = a;
  let loser = b;
  if (scoreB > scoreA) {
    winner = b;
    loser = a;
  } else if (scoreA === scoreB) {
    const totalA = rounds.reduce((s, r) => s + r.rollA, 0);
    const totalB = rounds.reduce((s, r) => s + r.rollB, 0);
    if (totalB > totalA || (totalB === totalA && b.id < a.id)) {
      winner = b;
      loser = a;
    }
  }
  const narration = rounds.map((r) => r.line).join(" ");
  return { winnerId: winner.id, loserId: loser.id, rounds, scoreA, scoreB, narration };
}
