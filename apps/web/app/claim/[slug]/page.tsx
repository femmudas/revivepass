"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useReward } from "@/hooks/use-reward";
import { socialApi } from "@/lib/social";
import { RewardBanner } from "@/components/reward-banner";

type Eligibility = {
  eligible: boolean;
  amount: number;
  evmAddress: string | null;
  alreadyClaimed: boolean;
  already_claimed?: boolean;
  existingClaim: {
    txSignature: string;
    mintAddress: string;
    explorer: string;
  } | null;
};

type MetadataResponse = {
  metadataUri: string;
  name: string;
  symbol: string;
  description: string;
  image: string | null;
};

export default function ClaimPage() {
  const { slug } = useParams<{ slug: string }>();
  const { publicKey, signMessage } = useWallet();
  const { awarding, awardMigrationReward } = useReward();

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [status, setStatus] = useState<string>("Connect your wallet to begin.");
  const [loading, setLoading] = useState(false);
  const [explorer, setExplorer] = useState<string | null>(null);
  const [rewardStatus, setRewardStatus] = useState("");
  const [metadataPreview, setMetadataPreview] = useState<MetadataResponse | null>(null);

  const wallet = useMemo(() => publicKey?.toBase58(), [publicKey]);
  const alreadyClaimed = Boolean(eligibility?.alreadyClaimed || eligibility?.already_claimed);
  const canClaim = Boolean(wallet && eligibility?.eligible && !alreadyClaimed && !loading && !awarding);

  useEffect(() => {
    if (!wallet) {
      setEligibility(null);
      setStatus("Connect your wallet to begin.");
      return;
    }

    setLoading(true);
    apiRequest<Eligibility>(`/migrations/${slug}/eligibility?wallet=${wallet}`)
      .then((data) => {
        setEligibility(data);
        const claimedFlag = Boolean(data.alreadyClaimed || data.already_claimed);
        if (!data.eligible) {
          setStatus("This wallet is not in the snapshot.");
        } else if (claimedFlag && data.existingClaim) {
          setStatus("Already claimed.");
          setExplorer(data.existingClaim.explorer);
        } else {
          setStatus("Eligible. Sign and mint your Revival Pass.");
        }
      })
      .catch((e) => setStatus((e as Error).message))
      .finally(() => setLoading(false));
  }, [wallet, slug]);

  useEffect(() => {
    apiRequest<MetadataResponse>(`/migrations/${slug}/metadata`)
      .then(setMetadataPreview)
      .catch(() => setMetadataPreview(null));
  }, [slug]);

  const claim = async () => {
    if (!wallet || !signMessage) {
      setStatus("Wallet does not support message signing.");
      return;
    }

    setLoading(true);
    setExplorer(null);

    try {
      const nonceRes = await apiRequest<{ nonce: string; message: string }>("/auth/nonce", {
        method: "POST",
        body: { wallet },
      });

      const signature = await signMessage(new TextEncoder().encode(nonceRes.message));
      const signature58 = bs58.encode(signature);

      await apiRequest("/auth/verify", {
        method: "POST",
        body: { wallet, nonce: nonceRes.nonce, signature: signature58 },
      });

      const claimRes = await apiRequest<{
        idempotent: boolean;
        txSignature: string;
        mintAddress: string;
        explorer: string;
      }>(`/migrations/${slug}/claim`, {
        method: "POST",
        body: { wallet, nonce: nonceRes.nonce, signature: signature58 },
      });

      setStatus(
        claimRes.idempotent
          ? "Claim already existed; showing previous mint."
          : "Revival Pass minted successfully."
      );
      setExplorer(claimRes.explorer);

      const rewardResult = await awardMigrationReward({
        walletAddress: wallet,
        migrationSlug: slug,
      });

      let socialMessage = "Tapestry post skipped.";
      try {
        const profile = await socialApi.createOrGetProfile(wallet);
        await socialApi.postMigration(profile.profile.id, slug);
        socialMessage = "Tapestry announcement posted.";
      } catch (socialError) {
        socialMessage = `Tapestry post failed: ${(socialError as Error).message}`;
      }

      setRewardStatus(`${rewardResult.message} ${socialMessage}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-2xl gap-5 py-6">
      <Card className="space-y-3">
        <Badge>Claim Portal</Badge>
        <CardTitle>Migration: {slug}</CardTitle>
        <CardDescription>Connect your wallet and claim your Revival Pass NFT.</CardDescription>
        <WalletMultiButton className="!bg-accent !text-background" />
        {metadataPreview && (
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs uppercase tracking-wider text-muted">NFT Metadata (IPFS)</p>
            <p className="mt-1 text-sm text-foreground">{metadataPreview.name}</p>
            {metadataPreview.image && (
              <img
                src={metadataPreview.image}
                alt={metadataPreview.name}
                className="mt-3 h-40 w-full rounded-lg border border-border object-cover"
              />
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>Eligibility</CardTitle>
        {loading && <CardDescription>Checking eligibility and claim state...</CardDescription>}
        {!loading && eligibility && (
          <div className="space-y-2 text-sm text-foreground/80">
            <p>Eligible: {eligibility.eligible ? "Yes" : "No"}</p>
            <p>Snapshot amount: {eligibility.amount}</p>
            <p>EVM address: {eligibility.evmAddress ?? "-"}</p>
          </div>
        )}
        <Button
          onClick={claim}
          disabled={!canClaim}
          className="w-full"
        >
          {loading ? "Processing..." : alreadyClaimed ? "Already Claimed" : "Claim Revival Pass"}
        </Button>
        <p className="text-sm text-foreground/75">{status}</p>
        {rewardStatus && <RewardBanner description={rewardStatus} tone="success" />}
        {explorer && (
          <a href={explorer} target="_blank" rel="noreferrer" className="text-sm text-accent underline">
            View transaction on Solana Explorer
          </a>
        )}
      </Card>
    </div>
  );
}
