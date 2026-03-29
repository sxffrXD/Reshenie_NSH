"use client";

import {
  AssetStatus,
  assetStatusLabel,
  attachMetadata,
  availableRawFromAccount,
  buyTokens,
  fetchAllAssets,
  simulateIncomeDistribution,
  updateAssetStatus,
  type AssetRecord,
} from "../../lib/client";
import { formatSolanaError } from "../../lib/errors";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAnchorWallet } from "../../hooks/useAnchorWallet";

function lamportsPerTokenUi(price: BN, decimals: number): string {
  const perOne = Number(price.toString()) / LAMPORTS_PER_SOL;
  const unit = decimals > 0 ? `1e-${decimals} of a token` : "1 raw unit";
  return `~${perOne.toFixed(6)} SOL per ${unit}`;
}

function statusPillClass(status: number): string {
  if (status === AssetStatus.Completed) return "status-pill status-completed";
  if (status === AssetStatus.Funded) return "status-pill status-funded";
  return "status-pill status-active";
}

export default function MarketplacePage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyingKey, setBuyingKey] = useState<string | null>(null);
  const [buyRawAmount, setBuyRawAmount] = useState<Record<string, string>>({});
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [simulateMemo, setSimulateMemo] = useState<Record<string, string>>({});
  const [uriDraft, setUriDraft] = useState<Record<string, string>>({});
  const [pendingOp, setPendingOp] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAllAssets(connection);
      setAssets(list);
    } catch (e) {
      setError(formatSolanaError(e));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () =>
      [...assets].sort((a, b) =>
        a.account.name.localeCompare(b.account.name, undefined, {
          sensitivity: "base",
        })
      ),
    [assets]
  );

  async function onInvest(mint: PublicKey) {
    if (!anchorWallet) return;
    const key = mint.toBase58();
    const raw = buyRawAmount[key]?.trim() || "0";
    setLastSig(null);
    setBuyingKey(key);
    setError(null);
    try {
      const sig = await buyTokens({
        connection,
        wallet: anchorWallet,
        mint,
        amount: new BN(raw),
      });
      setLastSig(sig);
      await load();
    } catch (e) {
      setError(formatSolanaError(e));
    } finally {
      setBuyingKey(null);
    }
  }

  async function onSimulate(mint: PublicKey, farmer: PublicKey, name: string) {
    if (!anchorWallet || !publicKey) return;
    if (!publicKey.equals(farmer)) {
      setError("Only the project farmer can simulate income.");
      return;
    }
    setError(null);
    setPendingOp(`sim-${mint.toBase58()}`);
    try {
      const memo =
        simulateMemo[mint.toBase58()]?.trim() || `Simulated yield — ${name}`;
      await simulateIncomeDistribution({
        connection,
        wallet: anchorWallet,
        mint,
        reportedLamports: new BN(1),
        memo,
      });
      await load();
    } catch (e) {
      setError(formatSolanaError(e));
    } finally {
      setPendingOp(null);
    }
  }

  async function onAttachUri(mint: PublicKey, farmer: PublicKey) {
    if (!anchorWallet || !publicKey?.equals(farmer)) return;
    const uri = uriDraft[mint.toBase58()]?.trim();
    if (!uri) {
      setError("Enter a metadata URI.");
      return;
    }
    setPendingOp(`uri-${mint.toBase58()}`);
    setError(null);
    try {
      await attachMetadata({
        connection,
        wallet: anchorWallet,
        mint,
        metadataUri: uri,
      });
      await load();
    } catch (e) {
      setError(formatSolanaError(e));
    } finally {
      setPendingOp(null);
    }
  }

  async function onStatus(mint: PublicKey, farmer: PublicKey, st: number) {
    if (!anchorWallet || !publicKey?.equals(farmer)) return;
    setPendingOp(`st-${mint.toBase58()}-${st}`);
    setError(null);
    try {
      await updateAssetStatus({
        connection,
        wallet: anchorWallet,
        mint,
        newStatus: st as 0 | 1 | 2,
      });
      await load();
    } catch (e) {
      setError(formatSolanaError(e));
    } finally {
      setPendingOp(null);
    }
  }

  return (
    <div>
      <h1>Marketplace</h1>
      <p className="muted">
        SPL inventory lives in the program treasury. Prices and availability
        are read from the Asset account on-chain. See <code>architecture.md</code> in
        the project root for system design.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden />
              Loading…
            </>
          ) : (
            "Refresh"
          )}
        </button>
        <Link href="/investments">My investments →</Link>
      </div>

      {!connected ? (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Connect Phantom to invest or manage your projects.
        </p>
      ) : null}

      {error ? <div className="banner banner-err">{error}</div> : null}

      {lastSig ? (
        <div className="banner banner-ok">
          Last buy:{" "}
          <a
            href={`https://explorer.solana.com/tx/${lastSig}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            {lastSig.slice(0, 20)}…
          </a>
        </div>
      ) : null}

      {sorted.length === 0 && !loading ? (
        <p className="muted" style={{ marginTop: "1rem" }}>
          No assets yet. <Link href="/create">Create the first project</Link>.
        </p>
      ) : null}

      {sorted.map(({ account: a }) => {
        const mint = a.mint as PublicKey;
        const farmer = a.farmer as PublicKey;
        const key = mint.toBase58();
        const available = availableRawFromAccount(a);
        const isFarmer = connected && publicKey && publicKey.equals(farmer);
        const availStr = available.toString();
        return (
          <div key={key} className="card" style={{ marginTop: "1rem" }}>
            <h2 style={{ margin: "0 0 0.35rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
              {a.name}
              <span className={statusPillClass(a.status)}>
                {assetStatusLabel(a.status)}
              </span>
            </h2>
            <p className="muted" style={{ margin: "0 0 0.5rem" }}>
              {a.description}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              <strong>Price:</strong> {lamportsPerTokenUi(a.pricePerTokenLamports, a.decimals)}
              <br />
              <strong>Total supply (raw):</strong> {a.totalSupply.toString()}
              <br />
              <strong>Sold (raw):</strong> {a.soldAmount.toString()}
              <br />
              <strong>Available (raw):</strong> {availStr}
              <br />
              <strong>Mint:</strong> {mint.toBase58()}
              <br />
              <strong>Farmer:</strong> {farmer.toBase58()}
              <br />
              <strong>Verification URI:</strong>{" "}
              {a.metadataUri ? (
                <a href={a.metadataUri} target="_blank" rel="noreferrer">
                  {a.metadataUri.length > 48
                    ? `${a.metadataUri.slice(0, 48)}…`
                    : a.metadataUri}
                </a>
              ) : (
                <span>— (not attached)</span>
              )}
            </p>

            {connected && a.status !== AssetStatus.Completed ? (
              <div style={{ marginTop: "0.75rem" }}>
                <label htmlFor={`amt-${key}`}>Buy amount (raw units)</label>
                <input
                  id={`amt-${key}`}
                  type="text"
                  inputMode="numeric"
                  placeholder={`max ${availStr}`}
                  value={buyRawAmount[key] ?? ""}
                  onChange={(e) =>
                    setBuyRawAmount((m) => ({ ...m, [key]: e.target.value }))
                  }
                />
                <div style={{ marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    disabled={
                      !anchorWallet || buyingKey === key || available.isZero()
                    }
                    onClick={() => void onInvest(mint)}
                  >
                    {buyingKey === key ? "Submitting…" : "Invest (buy tokens)"}
                  </button>
                  {available.isZero() ? (
                    <span className="muted" style={{ marginLeft: "0.5rem" }}>
                      Sold out
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {connected && a.status === AssetStatus.Completed ? (
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                Offering completed — no further primary sales via this program.
              </p>
            ) : null}

            {isFarmer ? (
              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #30363d",
                }}
              >
                <strong>Farmer tools</strong>
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  Attach IPFS/HTTPS JSON (schema in <code>schemas/</code>). Update
                  lifecycle status for investor trust.
                </p>
                <input
                  type="text"
                  placeholder="metadata_uri (ipfs:// or https://)"
                  value={uriDraft[key] ?? ""}
                  onChange={(e) =>
                    setUriDraft((m) => ({ ...m, [key]: e.target.value }))
                  }
                  style={{ maxWidth: "100%", marginTop: "0.35rem" }}
                />
                <button
                  type="button"
                  style={{ marginTop: "0.35rem", marginRight: "0.5rem" }}
                  disabled={pendingOp === `uri-${key}`}
                  onClick={() => void onAttachUri(mint, farmer)}
                >
                  {pendingOp === `uri-${key}` ? "…" : "Attach URI"}
                </button>

                <div style={{ marginTop: "0.75rem" }}>
                  <span className="muted" style={{ marginRight: "0.5rem" }}>
                    Status:
                  </span>
                  {([AssetStatus.Active, AssetStatus.Funded, AssetStatus.Completed] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      style={{ marginRight: "0.35rem", marginBottom: "0.35rem" }}
                      disabled={
                        pendingOp?.startsWith(`st-${key}`) || a.status === st
                      }
                      onClick={() => void onStatus(mint, farmer, st)}
                    >
                      Set {assetStatusLabel(st)}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="Income event memo"
                    value={simulateMemo[key] ?? ""}
                    onChange={(e) =>
                      setSimulateMemo((m) => ({ ...m, [key]: e.target.value }))
                    }
                    style={{ maxWidth: "100%" }}
                  />
                  <button
                    type="button"
                    style={{ marginTop: "0.35rem" }}
                    disabled={pendingOp === `sim-${key}`}
                    onClick={() => void onSimulate(mint, farmer, a.name)}
                  >
                    {pendingOp === `sim-${key}` ? "…" : "Simulate income event"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
