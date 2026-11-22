"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function CursorGlow() {
  const reduce = useReducedMotion();
  const ring = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine || !ring.current) return;
    const el = ring.current;
    let x = -100;
    let y = -100;
    let cx = -100;
    let cy = -100;
    let frame = 0;
    const move = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      document.documentElement.classList.add("has-cursor");
      setOn(true);
    };
    const down = () => el.classList.add("scale-75");
    const up = () => el.classList.remove("scale-75");
    const loop = () => {
      cx += (x - cx) * 0.35;
      cy += (y - cy) * 0.35;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      frame = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.documentElement.classList.remove("has-cursor");
    };
  }, [reduce]);

  return (
    <div
      ref={ring}
      aria-hidden
      className={`pointer-events-none fixed left-0 top-0 z-[120] size-8 rounded-full border border-[#ffb089] mix-blend-difference transition-transform duration-150 ${on ? "opacity-100" : "opacity-0"}`}
    />
  );
}
