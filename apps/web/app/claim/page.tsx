"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default function ClaimEntryPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  const openPortal = () => {
    const normalized = slugify(slug);
    if (!normalized) return;
    router.push(`/claim/${normalized}`);
  };

  return (
    <div className="mx-auto max-w-xl py-8">
      <Card className="space-y-3">
        <CardTitle>Open Claim Portal</CardTitle>
        <CardDescription>Enter your migration slug to continue.</CardDescription>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. community-revival"
        />
        <Button onClick={openPortal} disabled={!slug.trim()}>
          Continue
        </Button>
      </Card>
    </div>
  );
}
