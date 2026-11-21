import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-line bg-black/30 px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-gold",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1 block text-xs uppercase tracking-[0.16em] text-muted", className)} {...props} />;
}
