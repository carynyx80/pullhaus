"use client";

import { cardFaceSvg, sealedSvg } from "@pullhaus/shared";
import { RARITIES } from "@pullhaus/shared";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import type { DisplayCard } from "@/lib/cards";

const frames = ["#c9c1b6", "#7eb6d6", "#c4b5fd", "#e6b17a", "#ff5d8f"];

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
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const showFace = face || card.revealed;
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
  return (
    <motion.div
      ref={ref}
      onMouseMove={(event) => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        const px = (event.clientX - box.left) / box.width - 0.5;
        const py = (event.clientY - box.top) / box.height - 0.5;
        setTilt({ x: py * -10, y: px * 12 });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      animate={{ rotateX: tilt.x, rotateY: tilt.y }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      style={{ transformStyle: "preserve-3d" }}
      className={`relative aspect-[5/8] overflow-hidden rounded-[28px] ${className}`}
    >
      {card.imageUrl && showFace ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imageUrl} alt={card.name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      <div className="foil pointer-events-none absolute inset-0 opacity-40" />
      {showFace && (
        <span
          className="absolute left-3 top-3 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
          style={{ color: "#1a120c", background: frames[card.rarity] || frames[0] }}
        >
          {RARITIES[card.rarity]}
        </span>
      )}
    </motion.div>
  );
}
