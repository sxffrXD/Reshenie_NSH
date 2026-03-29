"use client";

import { fetchAllAssets, getUserTokens } from "../../lib/client";
import { formatSolanaError } from "../../lib/errors";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAnchorWallet } from "../../hooks/useAnchorWallet";

export default function DashboardPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [listed, setListed] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey || !anchorWallet) {
      setListed(null);
      setHoldings(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [assets, tokens] = await Promise.all([
        fetchAllAssets(connection),
        getUserTokens(connection, publicKey),
      ]);
      setListed(assets.length);
      setHoldings(tokens.length);
    } catch (e) {
      setError(formatSolanaError(e));
    } finally {
      setLoading(false);
    }
  }, [anchorWallet, connection, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!connected || !publicKey) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p className="muted">Connect Phantom for overview stats.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="muted" style={{ wordBreak: "break-all" }}>
        {publicKey.toBase58()}
      </p>

      <button type="button" onClick={() => void refresh()} disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" aria-hidden />
            Refreshing...
          </>
        ) : (
          "Refresh overview"
        )}
      </button>

      {error ? <div className="banner banner-err">{error}</div> : null}

      <div className="card" style={{ marginTop: "1rem" }}>
        <p>
          <strong>Projects on-chain:</strong>{" "}
          {listed ?? (loading ? "..." : "—")}
        </p>
        <p>
          <strong>Your RWA holdings:</strong>{" "}
          {holdings ?? (loading ? "..." : "—")}
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/investments">Open My investments →</Link>
          {" · "}
          <Link href="/marketplace">Marketplace →</Link>
        </p>
      </div>
    </div>
  );
}