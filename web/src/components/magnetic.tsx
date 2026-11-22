"use client";

import { useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

export function Magnetic({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  function onMove(event: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const x = event.clientX - (box.left + box.width / 2);
    const y = event.clientY - (box.top + box.height / 2);
    ref.current.style.transform = `translate(${x * 0.22}px, ${y * 0.32}px)`;
  }

  function onLeave() {
    if (ref.current) ref.current.style.transform = "translate(0px, 0px)";
  }

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={cn("inline-flex transition-transform duration-200 motion-reduce:transition-none", className)}>
      {children}
    </div>
  );
}
