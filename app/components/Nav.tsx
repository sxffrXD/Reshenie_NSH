"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export function Nav() {
  return (
    <header className="nav">
      <strong>RWA Agri (Solana devnet)</strong>
      <Link href="/">Home</Link>
      <Link href="/marketplace">Marketplace</Link>
      <Link href="/investments">My investments</Link>
      <Link href="/create">Create project</Link>
      <Link href="/dashboard">Dashboard</Link>
      <span style={{ marginLeft: "auto" }}>
        <WalletMultiButtonDynamic />
      </span>
    </header>
  );
}
