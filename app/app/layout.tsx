import type { Metadata } from "next";
import { Nav } from "../components/Nav";
import { WalletContextProvider } from "../components/WalletContextProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "RWA Agri — Solana",
  description: "Fractional agricultural assets on Solana devnet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>
          <Nav />
          <div className="main">{children}</div>
        </WalletContextProvider>
      </body>
    </html>
  );
}
