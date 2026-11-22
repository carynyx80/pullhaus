import Image from "next/image";
import { cn } from "@/lib/utils";

export function Mark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full object-cover shadow-[0_0_28px_rgba(255,122,69,0.35)]", className)}
    />
  );
}
