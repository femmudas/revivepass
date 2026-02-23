"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiBaseUrl, apiRequest } from "@/lib/api";

type MigrationResponse = {
  migration: {
    slug: string;
    name: string;
  };
};

type SnapshotUploadResponse = {
  inserted?: number;
  invalid?: number;
  uniqueWallets?: number;
  unique_wallets?: number;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function UploadPage() {
  const [name, setName] = useState("Community Revival");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState(
    "Revive legacy-chain communities with a verified Solana access pass."
  );
  const [symbol, setSymbol] = useState("REVIVE");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<SnapshotUploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedSlug = useMemo(() => {
    const manual = slugify(slug);
    if (manual) return manual;
    const generated = slugify(name);
    return generated || "migration";
  }, [name, slug]);

  const fullClaimUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/claim/${resolvedSlug}`
      : `/claim/${resolvedSlug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullClaimUrl);
    setCopyNotice("Copied");
    setTimeout(() => setCopyNotice(null), 1500);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setUploadResult(null);

    try {
      if (!file) {
        throw new Error("Select a CSV snapshot file first.");
      }

      const migration = await apiRequest<MigrationResponse>("/migrations", {
        method: "POST",
        body: {
          name: name.trim() || "Community Revival",
          slug: resolvedSlug,
          description: description.trim(),
          symbol: (symbol.trim() || "REVIVE").toUpperCase(),
        },
      }).catch(async (e) => {
        if (e.message.includes("already exists")) {
          return { migration: { slug: resolvedSlug, name } };
        }
        throw e;
      });

      const formData = new FormData();
      formData.append("file", file);

      const snapshotResponse = await apiRequest<SnapshotUploadResponse>(
        `/migrations/${migration.migration.slug}/snapshot`,
        {
          method: "POST",
          formData,
        }
      );

      setUploadResult(snapshotResponse);
      setSuccess("Snapshot uploaded successfully.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 py-6 md:grid-cols-2">
      <Card className="space-y-3">
        <CardTitle>Create Migration</CardTitle>
        <CardDescription>Create a campaign and attach your snapshot CSV.</CardDescription>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Migration name" />
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Slug (optional, auto-generated if empty)"
          />
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="Symbol" />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <div className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </Button>
              <p className="text-sm text-foreground/80">
                {file ? `${file.name} (${formatFileSize(file.size)})` : "No file chosen"}
              </p>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Uploading..." : "Create Migration + Upload Snapshot"}
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-neon">{success}</p>}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-3">
          <CardTitle>Generated Claim Link</CardTitle>
          <CardDescription>Share this URL with your eligible community wallets.</CardDescription>
          <div className="break-all rounded-md border border-border bg-background p-3 text-sm">
            {fullClaimUrl}
          </div>
          <Button variant="outline" onClick={handleCopy} className="w-full">
            Copy Claim Link
          </Button>
          {copyNotice && <p className="text-sm text-neon">{copyNotice}</p>}
          {process.env.NODE_ENV === "development" && (
            <CardDescription className="text-xs text-foreground/55">
              API endpoint: {apiBaseUrl}
            </CardDescription>
          )}
        </Card>

        {uploadResult && (
          <Card className="space-y-2">
            <CardTitle>Upload Result</CardTitle>
            {typeof uploadResult.inserted === "number" && <p className="text-sm">Inserted: {uploadResult.inserted}</p>}
            {typeof uploadResult.invalid === "number" && <p className="text-sm">Invalid: {uploadResult.invalid}</p>}
            {typeof (uploadResult.uniqueWallets ?? uploadResult.unique_wallets) === "number" && (
              <p className="text-sm">
                Unique wallets: {uploadResult.uniqueWallets ?? uploadResult.unique_wallets}
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
