import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletContextProvider } from "@/components/wallet-provider";
import Link from "next/link";
import type { ReactNode } from "react";
import { MainNav } from "@/components/main-nav";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: "RevivePass",
  description: "Snapshot-driven Solana migration pass portal"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} antialiased`}>
        <WalletContextProvider>
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
            <Link href="/" className="text-lg font-bold tracking-wide text-neon">
              RevivePass
            </Link>
            <MainNav />
          </header>
          <main className="mx-auto w-full max-w-6xl px-6 pb-10">{children}</main>
        </WalletContextProvider>
      </body>
    </html>
  );
}
