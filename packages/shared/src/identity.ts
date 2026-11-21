import { ABILITIES, ELEMENTS, RARITIES } from "./constants.js";

const FIRST = [
  "Auri", "Ves", "Kael", "Noor", "Sable", "Iri", "Quill", "Bram",
  "Lune", "Orr", "Nim", "Sol", "Pell", "Wren", "Tamsin", "Ivo",
];
const SECOND = [
  "shade", "mint", "vale", "wick", "thorn", "glass", "mire", "holt",
  "pyre", "dusk", "reed", "cinder", "marrow", "silk", "bloom", "keel",
];
const TITLE = [
  "of the Last Heat",
  "Who Keeps the Ember",
  "Beneath the Wax",
  "of Quiet Glass",
  "the Unopened",
  "After the Ash",
  "of the Second Flame",
  "Who Counts the Seals",
];

function pick<T>(list: readonly T[], n: bigint): T {
  const i = Number(n % BigInt(list.length));
  return list[i < 0 ? 0 : i];
}

export function cardIdentity(seed: bigint, rarity: number, element: number, ability: number) {
  const name = `${pick(FIRST, seed)} ${pick(SECOND, seed / 7n)} ${pick(TITLE, seed / 13n)}`;
  const elementName = ELEMENTS[element] ?? "Void";
  const abilityName = ABILITIES[ability] ?? "Quiet Crown";
  const rarityName = RARITIES[rarity] ?? "Common";
  const beats = [
    `${name} was pulled from a sealed pack and kept its ${elementName.toLowerCase()} shut until the wax gave.`,
    `Collectors call this a ${rarityName.toLowerCase()}. The atelier calls it a ${abilityName} waiting for a reason.`,
    `${name} carries ${elementName.toLowerCase()} the way a sleeve carries heat: quietly, then all at once.`,
    `The lore on the back was blank. ${abilityName} is what showed up when the card decided to speak.`,
  ];
  const lore = beats[Number((seed / 17n) % BigInt(beats.length))];
  return { name, lore, elementName, abilityName, rarityName };
}
