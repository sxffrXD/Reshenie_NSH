import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <h1>Agricultural RWA tokenization</h1>
      <p className="muted">
        Farmers mint SPL-backed project shares on Solana devnet. Investors buy
        fractions from the on-chain treasury for SOL at a fixed per-unit price.
      </p>
      <ul>
        <li>
          <Link href="/marketplace">Marketplace</Link> — price, supply, availability, status
        </li>
        <li>
          <Link href="/investments">My investments</Link> — SPL positions + disclosure links
        </li>
        <li>
          <Link href="/create">Create project</Link> — farmers deploy a mint + optional verification URI
        </li>
        <li>
          <Link href="/dashboard">Dashboard</Link> — quick counts
        </li>
      </ul>
      <p className="muted">
        Connect Phantom (devnet), fund with a devnet SOL airdrop, deploy the
        Anchor program, then use the UI.
      </p>
    </div>
  );
}
