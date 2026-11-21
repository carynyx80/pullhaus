import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
  {
    variants: {
      variant: {
        default: "bg-ember text-[#2a100b] hover:brightness-110",
        gold: "bg-gold text-[#24170f] hover:brightness-105",
        outline: "border border-line bg-white/5 text-ink hover:bg-white/10",
        ghost: "text-ink hover:bg-white/8",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-3 text-xs",
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
