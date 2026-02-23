"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Wallet, Upload, LayoutDashboard } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const cards = [
  {
    title: "Upload Snapshot",
    description: "Create migration campaigns and upload CSV eligibility snapshots.",
    icon: Upload,
    href: "/upload",
  },
  {
    title: "Claim Revival Pass",
    description: "Connect wallet, verify eligibility, and mint your migration NFT.",
    icon: Wallet,
    href: "/claim",
  },
  {
    title: "Track Migration",
    description: "Monitor holders, claims, and campaign progress in real time.",
    icon: LayoutDashboard,
    href: "/dashboard/community-revival",
  },
];

export default function LandingPage() {
  return (
    <div className="space-y-8 py-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="space-y-4"
      >
        <Badge>Migration-ready</Badge>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          Move communities from legacy chains to Solana with onchain proof of entry.
        </h1>
        <p className="max-w-2xl text-base text-foreground/75">
          RevivePass turns a snapshot CSV into verified wallet eligibility, minted Revival Pass NFTs,
          and a migration dashboard your community can trust.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link href="/upload">Create Migration</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/claim">Open Claim Portal</Link>
          </Button>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx, duration: 0.35 }}
          >
            <Card className="space-y-3">
              <card.icon className="h-5 w-5 text-neon" />
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
              <Link className="inline-flex items-center gap-2 text-sm text-accent" href={card.href}>
                Continue <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
