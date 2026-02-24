import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletContextProvider } from "@/components/wallet-provider";
import type { ReactNode } from "react";

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
          <main className="mx-auto w-full max-w-[1240px] px-4 pb-10 pt-6 md:px-8">{children}</main>
        </WalletContextProvider>
      </body>
    </html>
  );
}
