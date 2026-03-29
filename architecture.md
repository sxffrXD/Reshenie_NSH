# Architecture — Solana RWA Agri MVP

## System overview

The product connects **farmers** and **investors** on **Solana devnet**:

- Each agricultural project is an **Asset** program account (PDA) plus an **SPL mint**.
- The **entire supply** is minted once into a **treasury ATA** owned by the Asset PDA.
- **Investors** buy fractions: they pay **SOL** to the farmer and receive **SPL** from the treasury at a fixed **lamports-per-smallest-unit** price.
- **Off-chain verification** is simulated by a **`metadata_uri`** on the Asset pointing to JSON (see `schemas/rwa-asset-metadata.schema.json`). The chain only stores the URI; trust is “bring your own verifier” (explorer, IPFS gateway, future oracle).
- **Innovation (trust):** farmers can advance **`status`** (`Active` → `Funded` → `Completed`) on-chain so investors see lifecycle milestones without a centralized listings DB.

```
┌─────────────────┐     RPC / txs      ┌──────────────────┐
│  Next.js (app)  │ ◄──────────────► │  Solana devnet    │
│  Phantom wallet │                    │  + Anchor program │
└────────┬────────┘                    └────────┬─────────┘
         │                                      │
         │  imports                             │  SPL Token program
         ▼                                      ▼
┌─────────────────┐                    ┌──────────────────┐
│  lib/ (TS)      │                    │  Mint + ATAs     │
│  Anchor client  │                    │  Asset PDA       │
└─────────────────┘                    └──────────────────┘
         │
         │ optional HTTPS / IPFS
         ▼
┌─────────────────┐
│  JSON metadata  │  (schema in /schemas)
└─────────────────┘
```

## Components

### Frontend (`app/`)

- **Next.js 14 (App Router)**, **Phantom** via `@solana/wallet-adapter-react`.
- Pages: home, **Marketplace** (all assets), **Create project**, **My Investments**, **Dashboard** (summary).
- Responsibilities: wallet connect, forms, **loading / error / tx feedback**, links to Solana Explorer.

### Web3 interaction layer (`lib/`)

- **`@solana/web3.js`**, **`@solana/spl-token`**, **`@coral-xyz/anchor`** + **`lib/idl/rwa_tokenization.json`**.
- Exposes typed helpers: `createAsset`, `attachMetadata`, `updateAssetStatus`, `buyTokens`, `getUserTokens`, `fetchAllAssets`, `simulateIncomeDistribution`.
- **`errors.ts`**: maps common failures to short UI copy; **`wrapRpc`** wraps async RPC calls.

### Solana program (`programs/rwa-tokenization/`)

- **Anchor** program: state + CPI to SPL token for minting and transfers.
- **Single PDA per asset:** seeds `["asset", mint_pubkey]`.
- **No duplicate mint PDAs:** mint is a signer keypair created off-chain (classic MVP pattern).

## Data flow

### Create asset (farmer)

1. Frontend generates a **new mint keypair**.
2. Tx: `create_asset(name, description, total_supply, decimals, price_per_token_lamports)`.
3. Program: initializes **Asset PDA**, **Mint** (authority = PDA), **treasury ATA** (owner = PDA), **mint_to** full supply to treasury, sets `sold_amount = 0`, `status = Active`.
4. Optional follow-up: `attach_metadata(metadata_uri)` (farmer only).

### Buy tokens (investor)

1. Frontend ensures buyer **ATA** exists (adds ATA ix if needed).
2. Tx: `purchase_tokens(amount)`.
3. Program: checks `status != Completed`, treasury balance, and `amount <= total_supply - sold_amount`; transfers **SOL** buyer → farmer; **SPL** treasury → buyer ATA; increments `sold_amount`.
4. Emits **`TokensPurchased`** for indexers / UI analytics.

### Simulate income (farmer)

1. Tx: `simulate_income_distribution(reported_lamports, memo)` — **farmer must equal `asset.farmer`**.
2. Program emits **`IncomeDistributed`** (no token movement; hackathon-friendly “yield announced” signal).

### Lifecycle status (farmer)

1. Tx: `update_asset_status(new_status)` with `0 | 1 | 2`.
2. Emits **`AssetStatusUpdated`** (previous + new). Investors rely on this as a **transparent milestone trail** (future: restrict who can move status via multisig / oracle).

## On-chain vs off-chain

| Concern | On-chain | Off-chain |
|--------|----------|-----------|
| Ownership, supply, price, sales | Asset account + SPL | — |
| URI to verification JSON | `metadata_uri` | Hosting: IPFS / HTTPS |
| Location, permits, doc hashes | — | JSON at URI (`schemas/…`) |
| UX, listings UI | — | Next.js |
| “Oracle-grade” proof | — | Future: cross-check hash, attestation service |

## Account structure

| Account | Role |
|---------|------|
| **Asset PDA** | Farmer, mint, treasury, `name`, `description`, `metadata_uri`, `total_supply`, `sold_amount`, `price_per_token_lamports`, `decimals`, `status`, `bump` |
| **Token mint** | SPL mint; mint authority = Asset PDA |
| **Treasury ATA** | SPL token account: owner = Asset PDA; holds unsold inventory |
| **User ATA** | Standard SPL account per (user, mint) |

**PDAs:** only `Asset` uses a PDA (`["asset", mint]`). Mint is a conventional keypair to avoid extra complexity.

## Security considerations

- **Mint authority** is the Asset PDA — farmers cannot silently inflate supply after creation without program upgrade.
- **Purchases** enforce **treasury balance** and **remaining supply** (`total_supply - sold_amount`); **completed** offerings reject new buys.
- **Metadata attach, status changes, income simulation** require **farmer signer** = `asset.farmer`.
- **Price** is set at creation (no on-chain oracle) — MVP simplicity; production would use guarded updates or pools.
- **metadata_uri** is **not** authenticated on-chain: clients must fetch over HTTPS/IPFS and validate JSON; production would pin hashes or use verifiable storage proofs.

## Real-world verification (hackathon narrative)

1. Farmer publishes JSON following **`schemas/rwa-asset-metadata.schema.json`** (e.g. on IPFS).
2. Farmer calls **`attach_metadata`** with that document’s URI.
3. Investors treat the URI as a **disclosure pointer**: same pattern as NFT `uri`, extendable later to **hashes attested by an oracle** or **ZK commitments** without changing the core MVP.

## Innovative trust feature: on-chain **asset status**

**Problem:** Token holders cannot see whether the **real-world project** reached funding or completion.

**Approach:** Farmer (or future DAO/oracle) updates `status` with **`AssetStatusUpdated`** events. Wallets and explorers can show **Active → Funded → Completed** as a **public audit trail** tied to the mint. This is intentionally simple but maps cleanly to **milestones** (e.g. crop planted, harvest sold) in a pitch or demo.

---

After changing the Rust `Asset` layout, **redeploy** the program and run `anchor build` then copy `target/idl/rwa_tokenization.json` → `lib/idl/` so the TypeScript layer stays aligned.
