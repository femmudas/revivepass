"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Copy, ExternalLink, Loader2, LogOut, Menu, Wallet, X } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Tab = "home" | "create" | "claim" | "dashboard" | "checklist";

type MigrationResponse = {
  migration: { name: string; slug: string; description: string; symbol: string };
  claimed: number;
  remaining: number;
};

type StatsResponse = {
  total: number;
  claimed: number;
  remaining: number;
  claimHistory: { date: string; value: number }[];
};

type EligibilityResponse = {
  eligible: boolean;
  alreadyClaimed?: boolean;
  already_claimed?: boolean;
  existingClaim: { txSignature: string; mintAddress: string; explorer: string } | null;
};

const tabs: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "create", label: "Create" },
  { id: "claim", label: "Claim" },
  { id: "dashboard", label: "Dashboard" },
  { id: "checklist", label: "Checklist" },
];

const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const uid = () => Math.random().toString(36).slice(2, 8);
const shortAddress = (value: string) => `${value.slice(0, 3)}...${value.slice(-3)}`;

function WalletControl() {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const wallet = publicKey?.toBase58() ?? "";
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  if (!connected) {
    return (
      <Button
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="min-w-[148px] gap-2"
      >
        {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        {connecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="outline" onClick={() => setOpen((v) => !v)} className="gap-2 border-neon/70 bg-card">
        <Wallet className="h-4 w-4 text-neon" />
        <span>{shortAddress(wallet)}</span>
        <ChevronDown className="h-4 w-4 text-muted" />
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-card">
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-neon/10"
            onClick={async () => {
              await navigator.clipboard.writeText(wallet);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? <Check className="h-4 w-4 text-neon" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy address"}
          </button>
          <a
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-neon/10"
            href={`https://explorer.solana.com/address/${wallet}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            View on Explorer
          </a>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-neon/10"
            onClick={async () => {
              await disconnect();
              setOpen(false);
            }}
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export default function RevivePassPortal() {
  const { publicKey, signMessage } = useWallet();
  const wallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const [tab, setTab] = useState<Tab>("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [slug, setSlug] = useState("community-revival-demo");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    originChain: "ethereum",
    nftName: "Revival Pass",
    nftSymbol: "REVIVE",
    nftDescription: "Claim your Revival Pass to join the Solana community.",
  });
  const [created, setCreated] = useState<{ slug: string; title: string; symbol: string } | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadInserted, setUploadInserted] = useState<number | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [eligibilityState, setEligibilityState] = useState<
    "idle" | "checking" | "eligible" | "ineligible" | "already" | "minting" | "done"
  >("idle");
  const [claimResult, setClaimResult] = useState<{ tx: string; mint: string; explorer: string } | null>(null);

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboard, setDashboard] = useState<{
    title: string;
    symbol: string;
    total: number;
    claimed: number;
    remaining: number;
    history: { date: string; count: number }[];
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("page");
    const s = params.get("slug");
    if (p === "home" || p === "create" || p === "claim" || p === "dashboard" || p === "checklist") setTab(p);
    if (s) setSlug(s);
    void ensureDemoSlug(s ?? undefined);
  }, []);

  const ensureDemoSlug = async (preferred?: string) => {
    const candidates = [preferred, "community-revival-demo"].filter(Boolean) as string[];
    for (const candidate of candidates) {
      try {
        await apiRequest<MigrationResponse>(`/migrations/${candidate}`);
        setSlug(candidate);
        if (candidate === "community-revival-demo") {
          setNotice(`Demo slug ready: ${candidate}`);
        }
        return;
      } catch {
        // try next candidate
      }
    }

    try {
      const createdDemo = await apiRequest<{ migration: MigrationResponse["migration"] }>("/migrations", {
        method: "POST",
        body: {
          name: "Community Revival Demo",
          slug: "community-revival-demo",
          description: "Demo migration for testing RevivePass claim and dashboard flow.",
          symbol: "REVIVE",
        },
      });
      setSlug(createdDemo.migration.slug);
      setNotice(`Demo slug created: ${createdDemo.migration.slug}`);
    } catch {
      setNotice("Create a migration to start your claim and dashboard flow.");
    }
  };

  const openTab = (next: Tab) => {
    setTab(next);
    setMobileOpen(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const checkSlug = async () => {
    if (!slug.trim()) {
      setError("Enter a migration slug first.");
      return;
    }
    setError("");
    try {
      await apiRequest<MigrationResponse>(`/migrations/${slug.trim()}`);
      openTab("claim");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createMigration = async () => {
    if (!form.title.trim()) {
      setError("Migration title is required.");
      return;
    }
    const description = form.description.trim() || form.nftDescription.trim();
    if (description.length < 10) {
      setError("Description must be at least 10 characters.");
      return;
    }
    if (form.nftSymbol.trim().length < 2) {
      setError("Symbol must be at least 2 characters.");
      return;
    }
    setError("");
    setCreateLoading(true);
    try {
      const res = await apiRequest<{ migration: MigrationResponse["migration"] }>("/migrations", {
        method: "POST",
        body: {
          name: form.title.trim(),
          slug: `${slugify(form.title) || "community-revival"}-${uid()}`,
          description,
          symbol: form.nftSymbol.trim().toUpperCase().slice(0, 10),
        },
      });
      setCreated({
        slug: res.migration.slug,
        title: res.migration.name,
        symbol: res.migration.symbol,
      });
      setSlug(res.migration.slug);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreateLoading(false);
    }
  };

  const uploadSnapshot = async () => {
    if (!created || !csvFile) return;
    setError("");
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", csvFile);
      const res = await apiRequest<{ inserted: number }>(`/migrations/${created.slug}/snapshot`, {
        method: "POST",
        formData: fd,
      });
      setUploadInserted(res.inserted ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadLoading(false);
    }
  };

  const checkEligibility = async () => {
    if (!slug) {
      setError("Set a migration slug before eligibility check.");
      return;
    }
    if (!wallet) {
      setError("Connect your wallet first.");
      return;
    }
    setEligibilityState("checking");
    setError("");
    try {
      const res = await apiRequest<EligibilityResponse>(`/migrations/${slug}/eligibility?wallet=${wallet}`);
      const already = Boolean(res.alreadyClaimed || res.already_claimed);
      if (already && res.existingClaim) {
        setClaimResult({
          tx: res.existingClaim.txSignature,
          mint: res.existingClaim.mintAddress,
          explorer: res.existingClaim.explorer,
        });
        setEligibilityState("already");
      } else if (res.eligible) {
        setEligibilityState("eligible");
      } else {
        setEligibilityState("ineligible");
      }
    } catch (e) {
      setError((e as Error).message);
      setEligibilityState("idle");
    }
  };

  const claim = async () => {
    if (!slug || !wallet || !signMessage) {
      setError("Slug, wallet connection, and message signing are required.");
      return;
    }
    setEligibilityState("minting");
    setError("");
    try {
      const nonce = await apiRequest<{ nonce: string; message: string }>("/auth/nonce", {
        method: "POST",
        body: { wallet },
      });
      const signature = await signMessage(new TextEncoder().encode(nonce.message));
      const signature58 = bs58.encode(signature);
      const res = await apiRequest<{ txSignature: string; mintAddress: string; explorer: string }>(
        `/migrations/${slug}/claim`,
        {
          method: "POST",
          body: { wallet, nonce: nonce.nonce, signature: signature58 },
        }
      );
      setClaimResult({ tx: res.txSignature, mint: res.mintAddress, explorer: res.explorer });
      setEligibilityState("done");
    } catch (e) {
      setError((e as Error).message);
      setEligibilityState("eligible");
    }
  };

  const loadDashboard = async () => {
    if (!slug.trim()) {
      setError("Enter a migration slug to load dashboard.");
      return;
    }
    setDashboardLoading(true);
    setError("");
    try {
      const [m, s] = await Promise.all([
        apiRequest<MigrationResponse>(`/migrations/${slug.trim()}`),
        apiRequest<StatsResponse>(`/migrations/${slug.trim()}/stats`),
      ]);
      setDashboard({
        title: m.migration.name,
        symbol: m.migration.symbol,
        total: s.total,
        claimed: s.claimed,
        remaining: s.remaining,
        history: s.claimHistory.map((h) => ({ date: h.date, count: h.value })),
      });
    } catch (e) {
      setError((e as Error).message);
      setDashboard(null);
    } finally {
      setDashboardLoading(false);
    }
  };

  const canClaim = eligibilityState === "eligible" && Boolean(wallet) && Boolean(signMessage);

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-3 z-40 mb-6">
        <div className="rounded-2xl border border-border bg-navbar/95 px-4 py-3 backdrop-blur md:px-5">
          <div className="flex items-center justify-between gap-3">
            <button className="text-2xl font-bold tracking-tight text-neon" onClick={() => openTab("home")}>
              RevivePass
            </button>

            <nav className="hidden items-center gap-2 md:flex">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openTab(item.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    tab === item.id
                      ? "border-neon bg-neon/15 text-neon"
                      : "border-border text-muted hover:border-neon/60 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Badge className="hidden md:inline-flex">Solana Devnet</Badge>
              <WalletControl />
              <button
                className="rounded-lg border border-border p-2 text-muted md:hidden"
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {mobileOpen && (
            <div className="mt-3 space-y-2 border-t border-border pt-3 md:hidden">
              <Badge>Solana Devnet</Badge>
              <div className="grid grid-cols-2 gap-2">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openTab(item.id)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      tab === item.id
                        ? "border-neon bg-neon/15 text-neon"
                        : "border-border text-muted hover:border-neon/60"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}
        {notice && (
          <div className="rounded-xl border border-border bg-neon/10 px-4 py-3 text-sm text-muted">{notice}</div>
        )}
      </div>

      <main className="mt-4 space-y-6">
        {tab === "home" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
            <Card className="overflow-hidden p-8 md:p-12">
              <div className="mx-auto max-w-4xl text-center">
                <Badge>Migration-ready</Badge>
                <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-7xl">
                  Revive Your Community on Solana
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
                  Snapshot-based NFT claim portal with real-time migration tracking.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button size="lg" onClick={() => openTab("create")}>
                    Create Migration
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => openTab("checklist")}>
                    Migration Guide
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="space-y-3 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Already have a slug?</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="font-mono"
                  placeholder="community-revival-abc123"
                />
                <Button onClick={checkSlug} className="sm:w-24">
                  Go
                </Button>
              </div>
              <div>
                <Button
                  variant="ghost"
                  size="default"
                  className="text-xs"
                  onClick={() => {
                    setSlug("community-revival-demo");
                    setNotice("Demo slug selected: community-revival-demo");
                  }}
                >
                  Use Demo Slug
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {tab === "create" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mx-auto max-w-3xl space-y-4">
            <Card className="space-y-4 p-6">
              <h2 className="text-3xl font-bold tracking-tight">Create Migration</h2>
              <Input
                placeholder="Migration title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-neon focus:ring-2 focus:ring-focus"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-neon focus:ring-2 focus:ring-focus"
                  value={form.originChain}
                  onChange={(e) => setForm({ ...form, originChain: e.target.value })}
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="polygon">Polygon</option>
                  <option value="arbitrum">Arbitrum</option>
                </select>
                <Input
                  placeholder="Symbol"
                  value={form.nftSymbol}
                  onChange={(e) => setForm({ ...form, nftSymbol: e.target.value.toUpperCase() })}
                />
              </div>
              <Button className="w-full" disabled={createLoading} onClick={createMigration}>
                {createLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  "Create Migration"
                )}
              </Button>
            </Card>

            {created && (
              <Card className="space-y-3 p-6">
                <p className="text-sm text-muted">
                  Created slug: <span className="font-mono text-neon">{created.slug}</span>
                </p>
                <div className="rounded-xl border border-border bg-background p-3">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-neon file:px-4 file:py-2 file:text-sm file:font-semibold file:text-background hover:file:bg-neonHover"
                  />
                  {csvFile && (
                    <p className="mt-2 text-xs text-muted">
                      Selected: {csvFile.name} ({Math.ceil(csvFile.size / 1024)} KB)
                    </p>
                  )}
                </div>
                <Button className="w-full" disabled={!csvFile || uploadLoading} onClick={uploadSnapshot}>
                  {uploadLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    "Upload Snapshot"
                  )}
                </Button>
                {typeof uploadInserted === "number" && (
                  <div className="rounded-xl border border-border bg-neon/10 px-3 py-2 text-sm text-muted">
                    Inserted: {uploadInserted}
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted">Claim Link</p>
                  <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-neon">
                    {`${typeof window !== "undefined" ? window.location.origin : ""}/claim/${created.slug}`}
                  </div>
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {tab === "claim" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mx-auto max-w-2xl">
            <Card className="space-y-4 p-6">
              <h2 className="text-3xl font-bold tracking-tight">Claim Revival Pass</h2>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="font-mono"
                placeholder="Migration slug"
              />
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
                {wallet || "Connect wallet first"}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={checkEligibility}
                disabled={!slug || !wallet || eligibilityState === "checking"}
              >
                {eligibilityState === "checking" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...
                  </>
                ) : (
                  "Check Eligibility"
                )}
              </Button>

              {eligibilityState === "checking" && (
                <div className="space-y-2">
                  <div className="h-3 animate-pulse rounded bg-neon/15" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-neon/10" />
                </div>
              )}

              {eligibilityState === "ineligible" && (
                <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                  This wallet is not in the snapshot.
                </div>
              )}
              {eligibilityState === "already" && (
                <div className="rounded-xl border border-border bg-neon/10 px-3 py-2 text-sm text-muted">
                  Already claimed.
                </div>
              )}

              <Button className="w-full" onClick={claim} disabled={!canClaim}>
                {eligibilityState === "minting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Minting...
                  </>
                ) : (
                  "Claim Revival Pass"
                )}
              </Button>

              {claimResult && (
                <div className="space-y-2 rounded-xl border border-border bg-background p-3 text-sm">
                  <p className="text-muted">
                    Mint: <span className="font-mono text-foreground">{claimResult.mint}</span>
                  </p>
                  <p className="text-muted">
                    Tx: <span className="font-mono text-foreground">{claimResult.tx.slice(0, 48)}...</span>
                  </p>
                  <a
                    className="inline-flex items-center gap-2 text-neon underline"
                    href={claimResult.explorer}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Explorer <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {tab === "dashboard" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
            <Card className="space-y-3 p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="max-w-md font-mono"
                  placeholder="Migration slug"
                />
                <Button onClick={loadDashboard} disabled={dashboardLoading} className="sm:w-28">
                  {dashboardLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                    </>
                  ) : (
                    "Load"
                  )}
                </Button>
              </div>
            </Card>

            {dashboardLoading && (
              <div className="grid gap-3 md:grid-cols-3">
                {[1, 2, 3].map((n) => (
                  <Card key={n} className="h-28 animate-pulse bg-card/70" />
                ))}
              </div>
            )}

            {!dashboardLoading && dashboard && (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <Card>
                    <p className="text-xs uppercase tracking-widest text-muted">Total</p>
                    <p className="mt-2 text-4xl font-bold">{dashboard.total}</p>
                  </Card>
                  <Card>
                    <p className="text-xs uppercase tracking-widest text-muted">Claimed</p>
                    <p className="mt-2 text-4xl font-bold text-neon">{dashboard.claimed}</p>
                  </Card>
                  <Card>
                    <p className="text-xs uppercase tracking-widest text-muted">Remaining</p>
                    <p className="mt-2 text-4xl font-bold">{dashboard.remaining}</p>
                  </Card>
                </div>

                <Card className="h-80 p-5">
                  <h3 className="text-lg font-semibold">Claim History</h3>
                  <div className="mt-4 h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboard.history}>
                        <defs>
                          <linearGradient id="claimGradientPortal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00FF88" stopOpacity={0.55} />
                            <stop offset="95%" stopColor="#00FF88" stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,136,0.25)" />
                        <XAxis dataKey="date" stroke="#9FD9C0" />
                        <YAxis stroke="#9FD9C0" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid rgba(0,255,136,0.25)",
                            backgroundColor: "#0B0F14",
                            color: "#E6FFF4",
                          }}
                        />
                        <Area type="monotone" dataKey="count" stroke="#00FF88" fill="url(#claimGradientPortal)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </>
            )}
          </motion.div>
        )}

        {tab === "checklist" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mx-auto max-w-3xl">
            <Card className="space-y-4 p-6">
              <h2 className="text-3xl font-bold tracking-tight">Migration Checklist</h2>
              <p className="text-muted">
                Step-by-step guide to migrate your community to Solana with RevivePass.
              </p>
              <ul className="space-y-3 text-sm text-foreground">
                <li className="rounded-xl border border-border bg-background px-4 py-3">
                  1. Export holders from origin chain and prepare CSV snapshot.
                </li>
                <li className="rounded-xl border border-border bg-background px-4 py-3">
                  2. Collect Solana wallet addresses from eligible users.
                </li>
                <li className="rounded-xl border border-border bg-background px-4 py-3">
                  3. Create migration and upload snapshot in RevivePass.
                </li>
                <li className="rounded-xl border border-border bg-background px-4 py-3">
                  4. Share claim link and monitor conversion on dashboard.
                </li>
              </ul>
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
}
