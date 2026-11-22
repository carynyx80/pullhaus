import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display text-[0.95rem] font-semibold uppercase tracking-[0.14em] transition duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  {
    variants: {
      variant: {
        default: "bg-[linear-gradient(180deg,#ffc4a4,#ff7a45)] text-[#2a100b] shadow-[0_12px_40px_rgba(255,122,69,0.28)] hover:brightness-110",
        gold: "bg-gold text-[#24170f] shadow-[0_12px_40px_rgba(240,199,164,0.2)] hover:brightness-105",
        outline: "border border-line bg-white/5 text-ink hover:bg-white/10",
        ghost: "text-ink hover:bg-white/8",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3 text-[0.72rem] tracking-[0.12em]",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
