"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, LogOut, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { clearAdminToken, getAdminHeaders, verifyAdminSession } from "@/lib/admin-auth";

type MigrationRecord = {
  id?: number;
  name: string;
  slug: string;
  description: string;
  symbol: string;
  status: "draft" | "open" | "closed";
  total_snapshot_count?: number;
};

type SnapshotUploadResponse = {
  inserted: number;
  csvProvided?: number;
  csvAProvided?: number;
  csvBProvided?: number;
  matched?: number;
  unmatchedA?: number;
  unmatchedB?: number;
  manualProvided?: number;
  manualInserted?: number;
  duplicatesIgnored?: number;
  invalid?: number;
  invalidEntries?: string[];
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const uid = () => Math.random().toString(36).slice(2, 8);

export default function AdminPage() {
  const router = useRouter();
  const csvAInputRef = useRef<HTMLInputElement | null>(null);
  const csvBInputRef = useRef<HTMLInputElement | null>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [adminWallet, setAdminWallet] = useState("");
  const [statusText, setStatusText] = useState("");

  const [form, setForm] = useState({
    name: "Community Revival",
    description: "Revive legacy-chain communities with a verified Solana access pass.",
    symbol: "REVIVE",
  });

  const [migration, setMigration] = useState<MigrationRecord | null>(null);
  const [csvAFile, setCsvAFile] = useState<File | null>(null);
  const [csvBFile, setCsvBFile] = useState<File | null>(null);
  const [manualAddresses, setManualAddresses] = useState("");
  const [uploadSummary, setUploadSummary] = useState<SnapshotUploadResponse | null>(null);

  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const manualCount = useMemo(
    () =>
      manualAddresses
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean).length,
    [manualAddresses]
  );

  useEffect(() => {
    let active = true;
    verifyAdminSession()
      .then((res) => {
        if (!active) return;
        setAdminWallet(res.wallet);
        setStatusText("Admin session verified.");
      })
      .catch(() => {
        clearAdminToken();
        if (active) router.replace("/admin/login");
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const logout = async () => {
    try {
      await apiRequest("/admin/auth/logout", {
        method: "POST",
        headers: getAdminHeaders(),
      });
    } catch {
      // no-op
    }
    clearAdminToken();
    router.replace("/admin/login");
  };

  const createMigration = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.symbol.trim()) {
      setStatusText("Name, description and symbol are required.");
      return;
    }

    setCreating(true);
    setStatusText("Creating migration...");
    try {
      const slug = `${slugify(form.name) || "community-revival"}-${uid()}`;
      const response = await apiRequest<{ migration: MigrationRecord }>("/migrations", {
        method: "POST",
        adminAuth: true,
        body: {
          name: form.name.trim(),
          slug,
          description: form.description.trim(),
          symbol: form.symbol.trim().toUpperCase().slice(0, 10),
        },
      });
      setMigration(response.migration);
      setUploadSummary(null);
      setCsvAFile(null);
      setCsvBFile(null);
      setManualAddresses("");
      setStatusText(`Migration created: ${response.migration.slug}`);
    } catch (error) {
      setStatusText((error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const uploadSnapshot = async () => {
    if (!migration) {
      setStatusText("Create migration first.");
      return;
    }

    if (!csvAFile && !csvBFile && manualCount === 0) {
      setStatusText("Upload CSV A / CSV B or provide manual wallets.");
      return;
    }

    const formData = new FormData();
    if (csvAFile) formData.append("csvA", csvAFile);
    if (csvBFile) formData.append("csvB", csvBFile);
    if (manualAddresses.trim()) formData.append("manualAddresses", manualAddresses);

    setUploading(true);
    setStatusText("Uploading snapshot...");
    try {
      const response = await apiRequest<SnapshotUploadResponse>(
        `/migrations/${migration.slug}/snapshot`,
        {
          method: "POST",
          adminAuth: true,
          formData,
        }
      );
      setUploadSummary(response);
      setStatusText("Snapshot uploaded successfully.");

      const refreshed = await apiRequest<{ migration: MigrationRecord }>(`/migrations/${migration.slug}`);
      setMigration(refreshed.migration);
    } catch (error) {
      setStatusText((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const updateStatus = async (status: "open" | "closed") => {
    if (!migration) return;
    setStatusUpdating(true);
    setStatusText(`Updating status to ${status}...`);
    try {
      const response = await apiRequest<{ migration: MigrationRecord }>(
        `/migrations/${migration.slug}/status`,
        {
          method: "POST",
          adminAuth: true,
          body: { status },
        }
      );
      setMigration(response.migration);
      setStatusText(`Migration status updated: ${response.migration.status}`);
    } catch (error) {
      setStatusText((error as Error).message);
    } finally {
      setStatusUpdating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-neon" />
          <p className="text-sm text-muted">Checking admin session...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5 py-8">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-neon">
            <LockKeyhole className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em]">Admin Panel</span>
          </div>
          <CardTitle>RevivePass Migration Management</CardTitle>
          <CardDescription>Connected admin wallet: {adminWallet}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/">Back to Portal</Link>
          </Button>
          <Button variant="outline" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </Card>

      <div className="rounded-xl border border-border bg-neon/10 px-4 py-3 text-sm text-muted">{statusText}</div>

      <Card className="space-y-4">
        <CardTitle>Create Migration</CardTitle>
        <div className="grid gap-2">
          <Input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Migration name"
          />
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-neon focus:ring-2 focus:ring-focus"
            placeholder="Migration description"
          />
          <Input
            value={form.symbol}
            onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
            placeholder="Symbol"
          />
        </div>
        <Button onClick={createMigration} disabled={creating}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {creating ? "Creating..." : "Create Migration"}
        </Button>
      </Card>

      {migration && (
        <Card className="space-y-4">
          <CardTitle>Whitelist Import</CardTitle>
          <CardDescription>
            Migration: <span className="font-mono text-neon">{migration.slug}</span> · Status:{" "}
            <span className="font-semibold uppercase">{migration.status}</span>
          </CardDescription>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">CSV A (evm_address,amount)</p>
              <input
                ref={csvAInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(event) => setCsvAFile(event.target.files?.[0] ?? null)}
              />
              <Button variant="outline" onClick={() => csvAInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Choose CSV A
              </Button>
              <p className="text-xs text-muted">{csvAFile ? csvAFile.name : "No file chosen"}</p>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">
                CSV B (evm_address,solana_wallet)
              </p>
              <input
                ref={csvBInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(event) => setCsvBFile(event.target.files?.[0] ?? null)}
              />
              <Button variant="outline" onClick={() => csvBInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Choose CSV B
              </Button>
              <p className="text-xs text-muted">{csvBFile ? csvBFile.name : "No file chosen"}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-background p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Manual Solana Wallets (optional)</p>
            <textarea
              value={manualAddresses}
              onChange={(event) => setManualAddresses(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-neon focus:ring-2 focus:ring-focus"
              placeholder="One wallet per line"
            />
            <p className="text-xs text-muted">{manualCount} manual wallet(s)</p>
          </div>

          <Button onClick={uploadSnapshot} disabled={uploading || migration.status !== "draft"}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {uploading ? "Uploading..." : "Import Whitelist"}
          </Button>

          {uploadSummary && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                Inserted: {uploadSummary.inserted}
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                Matched (A+B): {uploadSummary.matched ?? "-"}
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                CSV A rows: {uploadSummary.csvAProvided ?? "-"}
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                CSV B rows: {uploadSummary.csvBProvided ?? "-"}
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                Unmatched A: {uploadSummary.unmatchedA ?? 0}
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                Unmatched B: {uploadSummary.unmatchedB ?? 0}
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                Duplicates ignored: {uploadSummary.duplicatesIgnored ?? 0}
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                Invalid entries: {uploadSummary.invalid ?? 0}
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => updateStatus("open")}
              disabled={statusUpdating || migration.status !== "draft"}
            >
              {statusUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Open Claims
            </Button>
            <Button
              variant="outline"
              onClick={() => updateStatus("closed")}
              disabled={statusUpdating || migration.status !== "open"}
            >
              {statusUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Close Claims
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted">
            Claim link: {typeof window !== "undefined" ? window.location.origin : ""}/claim/{migration.slug}
          </div>
        </Card>
      )}
    </div>
  );
}

