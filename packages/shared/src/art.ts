import { ELEMENT_COLORS, RARITIES, RARITY_COLORS } from "./constants.js";
import { mix } from "./derive.js";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
}

function unit(seed: bigint, salt: bigint): number {
  return Number(mix(seed, salt) % 1000n) / 1000;
}

export function sealedSvg(tokenId = "0"): string {
  const n = Number(BigInt(tokenId || "0") % 7n);
  const shift = 12 + n * 6;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640" width="400" height="640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1612"/>
      <stop offset="1" stop-color="#0c0b09"/>
    </linearGradient>
    <radialGradient id="wax" cx="50%" cy="46%" r="28%">
      <stop offset="0" stop-color="#ff8a5b"/>
      <stop offset="55%" stop-color="#c2412d"/>
      <stop offset="100%" stop-color="#6e2418"/>
    </radialGradient>
  </defs>
  <rect width="400" height="640" rx="28" fill="url(#bg)"/>
  <rect x="16" y="16" width="368" height="608" rx="22" fill="none" stroke="#e6b17a" stroke-opacity="0.45"/>
  <g stroke="#e6b17a" stroke-opacity="0.18" fill="none">
    ${Array.from({ length: 8 }, (_, i) => `<path d="M40 ${80 + i * 58 + shift} H360" />`).join("")}
  </g>
  <circle cx="200" cy="300" r="78" fill="url(#wax)"/>
  <circle cx="200" cy="300" r="78" fill="none" stroke="#f6efe4" stroke-opacity="0.35"/>
  <path d="M168 300c10-28 54-28 64 0-10 18-54 18-64 0z" fill="#f6efe4" fill-opacity="0.85"/>
  <text x="200" y="470" text-anchor="middle" fill="#f6efe4" font-family="Georgia, serif" font-size="28" letter-spacing="6">SEALED</text>
  <text x="200" y="502" text-anchor="middle" fill="#b5a89a" font-family="Outfit, sans-serif" font-size="13" letter-spacing="3">PULLHAUS</text>
</svg>`;
}

export function cardFaceSvg(input: {
  seed: bigint;
  rarity: number;
  element: number;
  name: string;
  atk: number;
  def: number;
  spd: number;
}): string {
  const palette = ELEMENT_COLORS[input.element] ?? ELEMENT_COLORS[4];
  const frame = RARITY_COLORS[input.rarity] ?? RARITY_COLORS[0];
  const rarity = RARITIES[input.rarity] ?? "Common";
  const a = unit(input.seed, 5n);
  const b = unit(input.seed, 9n);
  const c = unit(input.seed, 13n);
  const dots = Array.from({ length: 14 }, (_, i) => {
    const x = 48 + unit(input.seed, BigInt(20 + i)) * 304;
    const y = 70 + unit(input.seed, BigInt(40 + i)) * 280;
    const r = 1.2 + unit(input.seed, BigInt(60 + i)) * 2.4;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${palette.ink}" fill-opacity="0.75"/>`;
  }).join("");
  const name = esc(input.name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640" width="400" height="640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.wash}"/>
      <stop offset="1" stop-color="#0c0b09"/>
    </linearGradient>
    <radialGradient id="glow" cx="${(30 + a * 40).toFixed(0)}%" cy="${(20 + b * 30).toFixed(0)}%" r="55%">
      <stop offset="0" stop-color="${palette.glow}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="640" rx="28" fill="url(#bg)"/>
  <rect width="400" height="640" rx="28" fill="url(#glow)"/>
  <rect x="14" y="14" width="372" height="612" rx="22" fill="none" stroke="${frame}" stroke-width="2"/>
  <circle cx="${(80 + a * 240).toFixed(1)}" cy="${(120 + b * 180).toFixed(1)}" r="${(70 + c * 60).toFixed(1)}" fill="none" stroke="${palette.ink}" stroke-opacity="0.45" stroke-width="1.5"/>
  <path d="M40 360 C ${80 + a * 80} ${240 + b * 40}, ${220 + c * 80} ${180 + a * 30}, 360 300" fill="none" stroke="${frame}" stroke-width="3" stroke-linecap="round"/>
  ${dots}
  <text x="32" y="54" fill="${frame}" font-family="Outfit, sans-serif" font-size="12" letter-spacing="3">${rarity.toUpperCase()}</text>
  <text x="32" y="430" fill="#f6efe4" font-family="Georgia, serif" font-size="28">${name}</text>
  <g font-family="Outfit, sans-serif" fill="#f6efe4">
    <text x="32" y="560" font-size="13" fill="#b5a89a">ATK</text>
    <text x="32" y="586" font-size="22">${input.atk}</text>
    <text x="150" y="560" font-size="13" fill="#b5a89a">DEF</text>
    <text x="150" y="586" font-size="22">${input.def}</text>
    <text x="268" y="560" font-size="13" fill="#b5a89a">SPD</text>
    <text x="268" y="586" font-size="22">${input.spd}</text>
  </g>
</svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
