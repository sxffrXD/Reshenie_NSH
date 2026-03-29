# RWA Agri — fractional farmland on Solana (hackathon MVP)

## Problem statement

**Illiquid agricultural projects** find it hard to raise transparent, **fractional** capital. Paper contracts and informal fundraising do not give investors **on-chain** proof of what they bought or how a **real-world asset** maps to a **digital share**.

## Solution

A **minimal** Real-World Asset (RWA) flow on **Solana devnet**:

- Each project is an **Anchor `Asset`** + **SPL mint**; supply sits in a **program treasury** until sold.
- **Investors** pay **SOL** to the farmer and receive **SPL** at a fixed per-unit price — all via **real transactions** (no mocks).
- **Off-chain linkage:** farmers attach a **`metadata_uri`** (IPFS/HTTPS) to JSON describing location and proof (see **`schemas/rwa-asset-metadata.schema.json`**).
- **Trust innovation:** on-chain **status** milestones (**Active → Funded → Completed**) with events, so progress is **verifiable on Solana** without a private database.

## How Solana is used (judges / demo)

1. **Single program + SPL:** custody and sales rules live in an **Anchor program**; fractional units are **standard SPL tokens** (wallets, explorers, future DeFi).
2. **PDA-backed asset:** one **Asset PDA** per mint (`seeds: ["asset", mint]`) holds metadata, pricing, **sold counter**, **URI**, and **status** — cheap to index via `getProgramAccounts`.
3. **Atomic primary sales:** `purchase_tokens` **atomically** moves **SOL** to the farmer and **SPL** from treasury to the buyer; supply/closed states are enforced in the program.
4. **Events for transparency:** `AssetCreated`, `TokensPurchased`, `AssetStatusUpdated`, `IncomeDistributed` support explorers and off-chain indexers.
5. **Composable:** any wallet that speaks SPL can hold positions; Phantom is the reference UX.

See **`architecture.md`** for diagrams, account layout, and security notes.

## Architecture summary

| Layer | Stack |
|-------|--------|
| UI | Next.js 14, Phantom |
| Client | `lib/` — Anchor + web3.js + spl-token |
| Chain | Anchor program, SPL Token, devnet |

## Demo flow (3 minutes)

1. **Deploy program** (see Setup) and set Phantom to **devnet**.
2. **Airdrop SOL** to farmer and investor wallets.
3. **Farmer:** Create project (`/create`) — name, description, supply, price, then optionally set **verification URI** (`/marketplace` farmer tools).
4. **Farmer:** Advance **status** to **Funded** / **Completed** when narrating milestones.
5. **Investor:** Open **Marketplace** — check **available** tokens, **Invest**.
6. **Investor:** **My Investments** — balances and links to explorer.
7. (Optional) Open `metadata_uri` JSON in a browser / IPFS gateway to show **RWA disclosure** pattern.

## Setup instructions

### Prerequisites

Rust, Solana CLI, Anchor 0.30.x, Node 18+.

### Program

```bash
mkdir -p target/deploy
cp keys/rwa_tokenization-keypair.json target/deploy/rwa_tokenization-keypair.json
anchor build
cp target/idl/rwa_tokenization.json lib/idl/rwa_tokenization.json
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet
```

> **Important:** If you change Rust types or instructions, always **`anchor build`** and **copy the generated IDL** into `lib/idl/` so the frontend matches the chain.

> **This revision changes the `Asset` account layout** (metadata, `sold_amount`, `status`, new instructions). **Re-deploy** the program to devnet; old `Asset` accounts from the previous layout are incompatible.

### Frontend

```bash
cd app
npm install
npm run dev
```

Optional RPC: `app/.env.local` → `NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com`

### TypeScript client only

```bash
cd lib
npm install
```

## Project layout

```
programs/rwa-tokenization/   # Anchor (Rust)
lib/                         # Web3 + IDL
app/                         # Next.js
schemas/                     # Off-chain JSON schema
architecture.md              # Deep-dive
```

## License

MIT — demo / educational.
# Reshenie_NSH
# Reshenie_NSH
