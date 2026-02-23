import * as React from "react";
import { cn } from "@/lib/utils";

export const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn("h-2 w-full overflow-hidden rounded-full bg-foreground/15", className)}>
    <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);