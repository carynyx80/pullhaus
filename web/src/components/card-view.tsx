"use client";

import { cardFaceSvg, sealedSvg, RARITIES, RARITY_COLORS } from "@pullhaus/shared";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { DisplayCard } from "@/lib/cards";

export function CardView({
  card,
  face = false,
  className = "",
}: {
  card: DisplayCard;
  face?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useRef(false);
  const reduce = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [spot, setSpot] = useState({ x: 50, y: 30 });
  const showFace = face || card.revealed;
  const glow = showFace ? RARITY_COLORS[card.rarity] || RARITY_COLORS[0] : "#ffb089";
  const svg = showFace
    ? cardFaceSvg({
        seed: BigInt(card.seed || "0"),
        rarity: card.rarity,
        element: card.element,
        name: card.name,
        atk: card.atk,
        def: card.def,
        spd: card.spd,
      })
    : sealedSvg(card.tokenId);

  useEffect(() => {
    fine.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  return (
    <motion.div
      ref={ref}
      onMouseMove={(event) => {
        if (reduce || !fine.current) return;
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        const px = (event.clientX - box.left) / box.width;
        const py = (event.clientY - box.top) / box.height;
        const nextSpot = { x: Math.round(px * 100), y: Math.round(py * 100) };
        setSpot((current) => (current.x === nextSpot.x && current.y === nextSpot.y ? current : nextSpot));
        setTilt({ x: (py - 0.5) * -10, y: (px - 0.5) * 12 });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      animate={{ rotateX: reduce ? 0 : tilt.x, rotateY: reduce ? 0 : tilt.y }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 18 }}
      style={{
        transformStyle: "preserve-3d",
        boxShadow: `0 18px 40px ${glow}44, inset 0 0 0 1px ${glow}88`,
      }}
      className={`relative aspect-[5/8] overflow-hidden rounded-[28px] ${className}`}
    >
      {card.imageUrl && showFace ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imageUrl} alt={card.name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          background: `radial-gradient(circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.55), transparent 42%), linear-gradient(115deg, transparent 20%, rgba(255,210,180,0.35) 42%, rgba(140,210,255,0.28) 54%, rgba(255,120,180,0.28) 66%, transparent 80%)`,
        }}
      />
      {showFace && (
        <span
          className="absolute left-3 top-3 rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ color: "#1a120c", background: glow }}
        >
          {RARITIES[card.rarity]}
        </span>
      )}
    </motion.div>
  );
}
