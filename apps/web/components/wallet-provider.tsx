"use client";

import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { TorqueProvider } from "@torque-labs/react";

type WalletContextProviderProps = {
  children: ReactNode;
  torqueConfig?: {
    apiUrl: string;
    rpcUrl: string;
    authDomain: string;
  };
};

const TorqueBoundary = ({
  children,
  apiUrl,
  rpcUrl,
  authDomain,
}: {
  children: ReactNode;
  apiUrl: string;
  rpcUrl: string;
  authDomain: string;
}) => {
  const { wallet } = useWallet();

  return (
    <TorqueProvider
      wallet={wallet?.adapter ?? null}
      options={{
        apiUrl,
        rpcUrl,
        authDomain,
      }}
    >
      {children}
    </TorqueProvider>
  );
};

export const WalletContextProvider = ({ children, torqueConfig }: WalletContextProviderProps) => {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const runtimeTorqueConfig = torqueConfig ?? {
    apiUrl: process.env.NEXT_PUBLIC_TORQUE_API_URL ?? "https://api.torque.so",
    rpcUrl: process.env.NEXT_PUBLIC_TORQUE_RPC_URL ?? endpoint,
    authDomain: process.env.NEXT_PUBLIC_TORQUE_AUTH_DOMAIN ?? "revivepass.local",
  };
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <TorqueBoundary
            apiUrl={runtimeTorqueConfig.apiUrl}
            rpcUrl={runtimeTorqueConfig.rpcUrl}
            authDomain={runtimeTorqueConfig.authDomain}
          >
            {children}
          </TorqueBoundary>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
