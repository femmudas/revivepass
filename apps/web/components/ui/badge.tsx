import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Badge = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent",
      className
    )}
  >
    {children}
  </span>
);
