"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { clearAdminToken, setAdminToken, verifyAdminSession } from "@/lib/admin-auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const wallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const [status, setStatus] = useState("Connect your admin wallet to continue.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    verifyAdminSession()
      .then(() => {
        if (active) router.replace("/admin");
      })
      .catch(() => {
        clearAdminToken();
      });
    return () => {
      active = false;
    };
  }, [router]);

  const signIn = async () => {
    if (!wallet || !signMessage) {
      setStatus("Wallet connection and signing support are required.");
      return;
    }

    setLoading(true);
    setStatus("Requesting admin nonce...");
    try {
      const nonce = await apiRequest<{ nonce: string; message: string }>("/admin/auth/nonce", {
        method: "POST",
        body: { wallet },
      });
      setStatus("Signing admin message...");
      const signature = await signMessage(new TextEncoder().encode(nonce.message));
      const signature58 = bs58.encode(signature);

      const result = await apiRequest<{ token: string }>("/admin/auth/verify", {
        method: "POST",
        body: {
          wallet,
          nonce: nonce.nonce,
          signature: signature58,
        },
      });

      setAdminToken(result.token);
      setStatus("Admin login successful. Redirecting...");
      router.replace("/admin");
    } catch (error) {
      setStatus((error as Error).message);
      clearAdminToken();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-xl gap-5 py-10">
      <Card className="space-y-4">
        <div className="inline-flex items-center gap-2 text-neon">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">Admin Access</span>
        </div>
        <CardTitle>RevivePass Admin Login</CardTitle>
        <CardDescription>
          Sign a nonce with your allowlisted Solana wallet to manage migrations and snapshots.
        </CardDescription>
        <WalletMultiButton className="!h-10 !rounded-xl !border !border-border !bg-neon !px-4 !text-sm !font-semibold !text-background" />
        <Button onClick={signIn} disabled={!wallet || loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Signing In..." : "Sign In as Admin"}
        </Button>
        <p className="text-sm text-muted">{status}</p>
      </Card>
    </div>
  );
}

