export const RARITIES = ["Common", "Rare", "Epic", "Legendary", "Mythic"] as const;
export const ELEMENTS = ["Flame", "Tide", "Gale", "Stone", "Void"] as const;
export const ABILITIES = [
  "Ember Kiss",
  "Glass Tide",
  "Shearwind",
  "Bulwark",
  "Null Hour",
  "Gilded Fang",
  "Moth Lantern",
  "Salt Choir",
  "Vein of Night",
  "Paper Sun",
  "Cinder Pact",
  "Quiet Crown",
] as const;

export const TIERS = [
  { id: 0, name: "Ash", perk: "Published odds. The door is open." },
  { id: 1, name: "Ember", perk: "A small shift of odds toward rarer cards." },
  { id: 2, name: "Kindling", perk: "A stronger odds shift. The table starts to lean." },
  { id: 3, name: "Hearth", perk: "Odds shift, plus the Gilded Hour set." },
  { id: 4, name: "Atelier", perk: "The widest odds shift, and early access to new drops." },
] as const;

export const ELEMENT_COLORS = [
  { wash: "#2a120c", glow: "#e36a3a", ink: "#ffd7c2" },
  { wash: "#0c1c24", glow: "#3aa0b8", ink: "#d5f4ff" },
  { wash: "#101c16", glow: "#7dcea0", ink: "#e7fff2" },
  { wash: "#1c1814", glow: "#c4b39a", ink: "#f6efe4" },
  { wash: "#160c18", glow: "#c084fc", ink: "#f6e9ff" },
] as const;

export const RARITY_COLORS = ["#c9c1b6", "#7eb6d6", "#c4b5fd", "#e6b17a", "#ff5d8f"] as const;

/** Flame beats Gale, Gale beats Stone, Stone beats Tide, Tide beats Flame. Void is neutral. */
export const ELEMENT_BEATS: Record<number, number> = { 0: 2, 2: 3, 3: 1, 1: 0 };

export type Odds = {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
  mythic: number;
};
