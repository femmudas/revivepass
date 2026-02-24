"use client";

import { Trophy } from "lucide-react";
import { motion } from "framer-motion";

type RewardBannerProps = {
  title?: string;
  description: string;
  tone?: "info" | "success" | "warning";
};

const toneStyles: Record<NonNullable<RewardBannerProps["tone"]>, string> = {
  info: "border-border bg-neon/10 text-muted",
  success: "border-neon/60 bg-neon/15 text-foreground",
  warning: "border-danger/40 bg-danger/10 text-danger",
};

export const RewardBanner = ({ title = "Torque Rewards", description, tone = "info" }: RewardBannerProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border px-4 py-3 text-sm ${toneStyles[tone]}`}
    >
      <p className="mb-1 inline-flex items-center gap-2 font-semibold">
        <Trophy className="h-4 w-4" />
        {title}
      </p>
      <p>{description}</p>
    </motion.div>
  );
};
