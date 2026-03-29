"use client";

import {
  assetStatusLabel,
  getUserTokens,
  type UserTokenBalance,
} from "@rwa/lib/client";
import { formatSolanaError } from "@rwa/lib/errors";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAnchorWallet } from "../../hooks/useAnchorWallet";

export default function InvestmentsPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [rows, setRows] = useState<UserTokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey || !anchorWallet) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getUserTokens(connection, publicKey);
      setRows(list);
    } catch (e) {
      setError(formatSolanaError(e));
    } finally {
      setLoading(false);
    }
  }, [anchorWallet, connection, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!connected) {
    return (
      <div>
        <h1>My investments</h1>
        <p className="muted">Connect Phantom to see SPL positions in RWA projects.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>My investments</h1>
      <p className="muted">
        Holdings where your wallet has SPL from our program’s mints (derived via
        Asset PDA).
      </p>
      <p className="muted" style={{ wordBreak: "break-all" }}>
        Wallet: {publicKey.toBase58()}
      </p>

      <button type="button" onClick={() => void refresh()} disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" aria-hidden />
            Loading…
          </>
        ) : (
          "Refresh"
        )}
      </button>

      {error ? <div className="banner banner-err">{error}</div> : null}

      {rows.length === 0 && !loading ? (
        <div className="banner banner-pending" style={{ marginTop: "1rem" }}>
          No RWA tokens yet.{" "}
          <Link href="/marketplace">Browse the marketplace</Link>.
        </div>
      ) : null}

      {rows.map((t) => (
        <div key={t.mint.toBase58()} className="card" style={{ marginTop: "1rem" }}>
          <h2 style={{ margin: "0 0 0.35rem" }}>{t.projectName}</h2>
          <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
            {t.description}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            <strong>Status:</strong> {assetStatusLabel(t.status)}
            <br />
            <strong>Your balance:</strong> {t.uiAmount} (raw {t.rawAmount})
            <br />
            <strong>Decimals:</strong> {t.decimals}
            <br />
            <strong>Available for sale (treasury, raw):</strong>{" "}
            {t.availableRaw.toString()}
            <br />
            <strong>Total supply (raw):</strong> {t.totalSupply.toString()}
            <br />
            <strong>Price / smallest unit:</strong>{" "}
            {(Number(t.pricePerTokenLamports.toString()) / LAMPORTS_PER_SOL).toFixed(
              9
            )}{" "}
            SOL
            <br />
            <strong>Mint:</strong> {t.mint.toBase58()}
            <br />
            <strong>Verification:</strong>{" "}
            {t.metadataUri ? (
              <a href={t.metadataUri} target="_blank" rel="noreferrer">
                Open disclosure JSON
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
