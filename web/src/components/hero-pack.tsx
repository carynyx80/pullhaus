"use client";

import { RARITY_COLORS } from "@pullhaus/shared";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CardView } from "@/components/card-view";
import { SPECIMENS } from "@/lib/specimens";

export function HeroPack() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(0);
  const [wide, setWide] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [spot, setSpot] = useState({ x: 50, y: 28 });

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const apply = () => setWide(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  function onMove(event: React.MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    const px = (event.clientX - box.left) / box.width;
    const py = (event.clientY - box.top) / box.height;
    setTilt({ x: (py - 0.5) * -12, y: (px - 0.5) * 16 });
    setSpot({ x: px * 100, y: py * 100 });
  }

  function toggle() {
    setOpen((value) => {
      const next = !value;
      if (next && !reduce) setFlash(Date.now());
      return next;
    });
  }

  const spread = wide ? 132 : 78;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 210, damping: 20 };

  return (
    <div
      ref={stage}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      className="relative mx-auto h-[540px] w-full max-w-[560px] [perspective:1400px] sm:h-[640px]"
    >
      {flash ? (
        <motion.div
          key={flash}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[70] bg-[#fff4ea]"
          initial={{ opacity: 0.82 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      ) : null}
      <div className="absolute inset-0" style={{ transform: reduce ? undefined : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: "preserve-3d" }}>
        {SPECIMENS.map((card, index) => (
          <motion.div
            key={card.tokenId}
            className="absolute left-1/2 top-[18%] w-[9.5rem] -translate-x-1/2 sm:w-44"
            style={{ zIndex: open ? 30 + index : 1, filter: `drop-shadow(0 22px 28px ${RARITY_COLORS[card.rarity]}66)` }}
            animate={{
              x: open ? (index - 1) * spread : 0,
              y: open ? Math.abs(index - 1) * 18 : 36,
              rotate: open ? (index - 1) * 11 : 0,
              opacity: open ? 1 : 0,
              scale: open ? 1 : 0.72,
            }}
            transition={{ ...spring, delay: open && !reduce ? index * 0.05 : 0 }}
          >
            <div className={open ? "" : "pointer-events-none"}>
              <CardView card={card} />
            </div>
          </motion.div>
        ))}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Close the specimen pack" : "Tear open the specimen pack"}
          onClick={toggle}
          className={`absolute left-1/2 top-[46%] aspect-[3/4.15] w-48 -translate-x-1/2 -translate-y-1/2 sm:w-60 ${open ? "z-10" : "z-20"}`}
        >
          <PackHalf spot={spot} open={open} half="top" reduce={Boolean(reduce)} />
          <PackHalf spot={spot} open={open} half="bottom" reduce={Boolean(reduce)} />
        </button>
      </div>
      <p className="absolute inset-x-0 bottom-2 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
        {open ? "Specimens · seed 1 is the published vector" : "Tear the pack"}
      </p>
    </div>
  );
}

function PackHalf({
  spot,
  open,
  half,
  reduce,
}: {
  spot: { x: number; y: number };
  open: boolean;
  half: "top" | "bottom";
  reduce: boolean;
}) {
  const top = half === "top";
  return (
    <motion.div
      aria-hidden
      className={`absolute inset-0 ${top ? "" : "pointer-events-none"}`}
      style={{ clipPath: top ? "inset(0 0 46% 0)" : "inset(54% 0 0 0)" }}
      animate={
        open
          ? top
            ? { y: -36, rotate: -8, x: -6 }
            : { y: 28, rotate: 4, x: 6 }
          : { y: 0, rotate: 0, x: 0 }
      }
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 18 }}
    >
      <div className="pack-face relative aspect-[3/4.15] overflow-hidden rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="pack-crimp absolute inset-x-3 top-3 h-2.5 rounded-sm opacity-80" />
        <div className="pack-crimp absolute inset-x-3 bottom-3 h-2.5 rounded-sm opacity-80" />
        <Image src="/brand/logo.png" alt="" width={320} height={320} className="absolute left-1/2 top-[46%] w-[78%] -translate-x-1/2 -translate-y-1/2" />
        <div
          className="pointer-events-none absolute inset-0 mix-blend-screen"
          style={{
            background: `radial-gradient(circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.72), transparent 36%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.28)_46%,transparent_62%)]" />
        {top ? <div className="absolute inset-x-3 top-[46%] h-2 bg-[repeating-linear-gradient(90deg,#fff_0_6px,transparent_6px_12px)] opacity-80" /> : null}
      </div>
    </motion.div>
  );
}
