"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({ className, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/60" />
      <DialogPrimitive.Content
        className={cn("fixed inset-y-0 right-0 z-[80] w-[min(88vw,420px)] border-l border-line bg-[#0c0a09] p-6", className)}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
