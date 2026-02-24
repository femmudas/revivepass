import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Badge = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-border bg-neon/10 px-3 py-1 text-xs font-semibold text-neon",
      className
    )}
  >
    {children}
  </span>
);
