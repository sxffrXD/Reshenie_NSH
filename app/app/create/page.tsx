"use client";

import { attachMetadata, createAsset } from "../../lib/client";
import { formatSolanaError } from "@rwa/lib/errors";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";
import { useState } from "react";

import { useAnchorWallet } from "../../hooks/useAnchorWallet";

type Phase = "idle" | "pending" | "success" | "error";

export default function CreateProjectPage() {
  const { connection } = useConnection();
  const { connected } = useWallet();
  const anchorWallet = useAnchorWallet();

  const [name, setName] = useState("Demo Olive Grove");
  const [description, setDescription] = useState(
    "Pilot plot in Peloponnese. Disclosure JSON can be pinned to IPFS."
  );
  const [totalSupply, setTotalSupply] = useState("1000000000");
  const [decimals, setDecimals] = useState("6");
  const [solPerFullToken, setSolPerFullToken] = useState("0.01");
  const [verificationUri, setVerificationUri] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{
    signature: string;
    mint: string;
    attachSig?: string;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!anchorWallet) return;
    setPhase("pending");
    setMessage("Confirm in Phantom…");
    setResult(null);
    try {
      const dec = Math.min(9, Math.max(0, parseInt(decimals, 10) || 0));
      const supplyBn = new BN(totalSupply.trim() || "0", 10);
      if (supplyBn.lte(new BN(0))) throw new Error("total_supply must be > 0");

      const sol = parseFloat(solPerFullToken) || 0;
      if (sol <= 0) throw new Error("SOL per full token must be > 0");

      const lamportsPerFull = new BN(Math.round(sol * LAMPORTS_PER_SOL));
      const ten = new BN(10).pow(new BN(dec));
      const pricePerSmallest = lamportsPerFull.div(ten);
      if (pricePerSmallest.lte(new BN(0))) {
        throw new Error(
          "Price per smallest unit rounds to zero; increase SOL price or lower decimals."
        );
      }

      const mintKeypair = Keypair.generate();
      const { signature, mint } = await createAsset(
        {
          connection,
          wallet: anchorWallet,
          name: name.trim(),
          description: description.trim(),
          totalSupply: supplyBn,
          decimals: dec,
          pricePerTokenLamports: pricePerSmallest,
        },
        mintKeypair
      );

      let attachSig: string | undefined;
      if (verificationUri.trim()) {
        setMessage("Attaching verification URI…");
        attachSig = await attachMetadata({
          connection,
          wallet: anchorWallet,
          mint,
          metadataUri: verificationUri.trim(),
        });
      }

      setResult({ signature, mint: mint.toBase58(), attachSig });
      setPhase("success");
      setMessage(null);
    } catch (e) {
      setPhase("error");
      setMessage(formatSolanaError(e));
    }
  }

  if (!connected) {
    return (
      <div>
        <h1>Create project</h1>
        <p className="muted">Connect Phantom as the farmer to create an asset.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Create agricultural project</h1>
      <p className="muted">
        Deploys a new SPL mint and stores extended metadata on an Asset PDA. Full
        supply is locked in the program treasury for investors. Optionally attach
        a URI to JSON matching <code>schemas/rwa-asset-metadata.schema.json</code>.
      </p>

      {phase === "pending" ? (
        <div className="banner banner-pending">
          <span className="spinner" aria-hidden />
          {message}
        </div>
      ) : null}
      {phase === "error" && message ? (
        <div className="banner banner-err">{message}</div>
      ) : null}

      <form onSubmit={(e) => void submit(e)} style={{ maxWidth: 480 }}>
        <label htmlFor="proj-name">Project name</label>
        <input
          id="proj-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          required
        />

        <label htmlFor="desc">Description</label>
        <textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          rows={3}
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "0.45rem 0.6rem",
            borderRadius: 4,
            border: "1px solid #30363d",
            background: "#010409",
            color: "inherit",
            resize: "vertical",
          }}
          required
        />

        <label htmlFor="supply">Total supply (raw units)</label>
        <input
          id="supply"
          value={totalSupply}
          onChange={(e) => setTotalSupply(e.target.value)}
          required
        />

        <label htmlFor="decimals">Decimals (0–9)</label>
        <input
          id="decimals"
          value={decimals}
          onChange={(e) => setDecimals(e.target.value)}
        />

        <label htmlFor="solprice">Price (SOL per 1.0 full token)</label>
        <input
          id="solprice"
          value={solPerFullToken}
          onChange={(e) => setSolPerFullToken(e.target.value)}
        />

        <label htmlFor="vuri">Verification URI (optional, IPFS or HTTPS)</label>
        <input
          id="vuri"
          value={verificationUri}
          onChange={(e) => setVerificationUri(e.target.value)}
          placeholder="ipfs://… or https://…"
        />

        <div style={{ marginTop: "1rem" }}>
          <button type="submit" disabled={!anchorWallet || phase === "pending"}>
            {phase === "pending" ? "Working…" : "Create asset (sign)"}
          </button>
        </div>
      </form>

      {result ? (
        <div className="banner banner-ok" style={{ marginTop: "1.25rem" }}>
          <p style={{ marginTop: 0 }}>Mint: {result.mint}</p>
          <p>
            Create tx:{" "}
            <a
              href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              Explorer
            </a>
          </p>
          {result.attachSig ? (
            <p>
              Metadata tx:{" "}
              <a
                href={`https://explorer.solana.com/tx/${result.attachSig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Explorer
              </a>
            </p>
          ) : null}
          <p style={{ marginBottom: 0 }}>
            <Link href="/marketplace">Open marketplace</Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
