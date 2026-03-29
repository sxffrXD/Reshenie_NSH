import { AnchorProvider, BN, type Idl, Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { wrapRpc } from "./errors";
import rawIdl from "./idl/rwa_tokenization.json";

export const PROGRAM_ID = new PublicKey(
  (rawIdl as { address: string }).address
);

export const idl = rawIdl as unknown as Idl;

/** Matches `#[program]` status constants on-chain */
export const AssetStatus = {
  Active: 0,
  Funded: 1,
  Completed: 2,
} as const;

export type AssetStatusValue = (typeof AssetStatus)[keyof typeof AssetStatus];

export function assetStatusLabel(code: number): string {
  switch (code) {
    case AssetStatus.Active:
      return "Active";
    case AssetStatus.Funded:
      return "Funded";
    case AssetStatus.Completed:
      return "Completed";
    default:
      return `Unknown (${code})`;
  }
}

/** Matches `@coral-xyz/anchor` `AnchorProvider` wallet parameter */
export type AnchorWallet = {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[]
  ): Promise<T[]>;
};

/** Decoded on-chain `Asset` account (camelCase field names from Anchor TS) */
export type AssetAccount = {
  farmer: PublicKey;
  mint: PublicKey;
  treasury: PublicKey;
  bump: number;
  name: string;
  description: string;
  metadataUri: string;
  totalSupply: BN;
  soldAmount: BN;
  pricePerTokenLamports: BN;
  decimals: number;
  status: number;
};

export type AssetRecord = {
  publicKey: PublicKey;
  account: AssetAccount;
};

export type UserTokenBalance = {
  mint: PublicKey;
  ata: PublicKey;
  rawAmount: string;
  uiAmount: number;
  decimals: number;
  assetPda: PublicKey;
  projectName: string;
  description: string;
  metadataUri: string;
  status: number;
  totalSupply: BN;
  soldAmount: BN;
  availableRaw: BN;
  pricePerTokenLamports: BN;
};

function getProgram(connection: Connection, wallet: AnchorWallet): Program<Idl> {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program(idl, provider);
}

function getReadonlyProgram(connection: Connection): Program<Idl> {
  const dummy: AnchorWallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) =>
      tx,
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[]
    ) => txs,
  };
  const provider = new AnchorProvider(connection, dummy, {
    commitment: "confirmed",
  });
  return new Program(idl, provider);
}

export function deriveAssetPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("asset"), mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function availableRawFromAccount(account: AssetAccount): BN {
  const left = account.totalSupply.sub(account.soldAmount);
  return left.isNeg() ? new BN(0) : left;
}

function coerceAssetAccount(raw: Record<string, unknown>): AssetAccount {
  return {
    farmer: raw.farmer as PublicKey,
    mint: raw.mint as PublicKey,
    treasury: raw.treasury as PublicKey,
    bump: raw.bump as number,
    name: raw.name as string,
    description: (raw.description as string) ?? "",
    metadataUri: (raw.metadataUri as string) ?? (raw.metadata_uri as string) ?? "",
    totalSupply: raw.totalSupply as BN,
    soldAmount: (raw.soldAmount as BN) ?? new BN(0),
    pricePerTokenLamports: raw.pricePerTokenLamports as BN,
    decimals: raw.decimals as number,
    status: (raw.status as number) ?? AssetStatus.Active,
  };
}

export type CreateAssetParams = {
  connection: Connection;
  wallet: AnchorWallet;
  name: string;
  description: string;
  /** Raw token units (smallest units) */
  totalSupply: BN | number | string;
  decimals: number;
  /** Lamports per smallest token unit */
  pricePerTokenLamports: BN | number | string;
};

export type CreateAssetResult = {
  signature: string;
  asset: PublicKey;
  mint: PublicKey;
};

/**
 * Farmer creates a project: new mint, metadata PDA, full supply minted to program treasury.
 */
export async function createAsset(
  params: CreateAssetParams,
  mintKeypair: Keypair
): Promise<CreateAssetResult> {
  return wrapRpc(async () => {
    const {
      connection,
      wallet,
      name,
      description,
      totalSupply,
      decimals,
      pricePerTokenLamports,
    } = params;

    const program = getProgram(connection, wallet);
    const farmer = wallet.publicKey;

    const asset = deriveAssetPda(mintKeypair.publicKey);
    const treasury = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      asset,
      true
    );

    const sig = await program.methods
      .createAsset(
        name,
        description,
        new BN(totalSupply.toString()),
        decimals,
        new BN(pricePerTokenLamports.toString())
      )
      .accounts({
        farmer,
        asset,
        mint: mintKeypair.publicKey,
        treasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([mintKeypair])
      .rpc();

    return { signature: sig, asset, mint: mintKeypair.publicKey };
  }, "create_asset");
}

export type AttachMetadataParams = {
  connection: Connection;
  wallet: AnchorWallet;
  mint: PublicKey;
  metadataUri: string;
};

/** Farmer pins IPFS/HTTPS URI pointing at JSON matching `schemas/rwa-asset-metadata.schema.json`. */
export async function attachMetadata(
  params: AttachMetadataParams
): Promise<string> {
  const { connection, wallet, mint, metadataUri } = params;
  return wrapRpc(async () => {
    const program = getProgram(connection, wallet);
    const asset = deriveAssetPda(mint);
    return program.methods
      .attachMetadata(metadataUri)
      .accounts({
        farmer: wallet.publicKey,
        asset,
      })
      .rpc();
  }, "attach_metadata");
}

export type UpdateAssetStatusParams = {
  connection: Connection;
  wallet: AnchorWallet;
  mint: PublicKey;
  newStatus: AssetStatusValue;
};

/** Farmer updates lifecycle milestone (trust / transparency). */
export async function updateAssetStatus(
  params: UpdateAssetStatusParams
): Promise<string> {
  const { connection, wallet, mint, newStatus } = params;
  return wrapRpc(async () => {
    const program = getProgram(connection, wallet);
    const asset = deriveAssetPda(mint);
    return program.methods
      .updateAssetStatus(newStatus)
      .accounts({
        farmer: wallet.publicKey,
        asset,
      })
      .rpc();
  }, "update_asset_status");
}

export type BuyTokensParams = {
  connection: Connection;
  wallet: AnchorWallet;
  mint: PublicKey;
  amount: BN | number | string;
};

export async function buyTokens(params: BuyTokensParams): Promise<string> {
  return wrapRpc(async () => {
    const { connection, wallet, mint, amount } = params;
    const buyer = wallet.publicKey;
    const program = getProgram(connection, wallet);

    const asset = deriveAssetPda(mint);
    const assetAccount = coerceAssetAccount(
      (await program.account.asset.fetch(asset)) as unknown as Record<
        string,
        unknown
      >
    );
    const farmer = assetAccount.farmer;

    const treasury = getAssociatedTokenAddressSync(mint, asset, true);
    const buyerAta = getAssociatedTokenAddressSync(mint, buyer, false);

    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({
      feePayer: buyer,
      recentBlockhash: latestBlockhash.blockhash,
    });

    const ataInfo = await connection.getAccountInfo(buyerAta);
    if (!ataInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          buyer,
          buyerAta,
          buyer,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    const ix = await program.methods
      .purchaseTokens(new BN(amount.toString()))
      .accounts({
        buyer,
        farmer,
        asset,
        mint,
        treasury,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    tx.add(ix);

    const signed = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );
    return sig;
  }, "purchase_tokens");
}

export async function getUserTokens(
  connection: Connection,
  owner: PublicKey
): Promise<UserTokenBalance[]> {
  const program = getReadonlyProgram(connection);
  const resp = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const out: UserTokenBalance[] = [];

  for (const { pubkey, account } of resp.value) {
    const parsed = account.data.parsed as {
      info: {
        mint: string;
        tokenAmount: { amount: string; decimals: number; uiAmount: number | null };
      };
    };
    const mint = new PublicKey(parsed.info.mint);
    const assetPda = deriveAssetPda(mint);
    const info = await connection.getAccountInfo(assetPda);
    if (!info) continue;

    let assetData: AssetAccount;
    try {
      assetData = coerceAssetAccount(
        (await program.account.asset.fetch(assetPda)) as unknown as Record<
          string,
          unknown
        >
      );
    } catch {
      continue;
    }

    const raw = parsed.info.tokenAmount.amount;
    if (raw === "0") continue;

    out.push({
      mint,
      ata: pubkey,
      rawAmount: raw,
      uiAmount: parsed.info.tokenAmount.uiAmount ?? 0,
      decimals: parsed.info.tokenAmount.decimals,
      assetPda,
      projectName: assetData.name,
      description: assetData.description,
      metadataUri: assetData.metadataUri,
      status: assetData.status,
      totalSupply: assetData.totalSupply,
      soldAmount: assetData.soldAmount,
      availableRaw: availableRawFromAccount(assetData),
      pricePerTokenLamports: assetData.pricePerTokenLamports,
    });
  }

  return out;
}

export async function fetchAllAssets(
  connection: Connection
): Promise<AssetRecord[]> {
  const program = getReadonlyProgram(connection);
  const all = await program.account.asset.all();
  return all.map(({ publicKey, account }) => ({
    publicKey,
    account: coerceAssetAccount(account as unknown as Record<string, unknown>),
  }));
}

export type SimulateIncomeParams = {
  connection: Connection;
  wallet: AnchorWallet;
  mint: PublicKey;
  reportedLamports: BN | number | string;
  memo: string;
};

export async function simulateIncomeDistribution(
  params: SimulateIncomeParams
): Promise<string> {
  const { connection, wallet, mint, reportedLamports, memo } = params;
  return wrapRpc(async () => {
    const program = getProgram(connection, wallet);
    const asset = deriveAssetPda(mint);
    return program.methods
      .simulateIncomeDistribution(new BN(reportedLamports.toString()), memo)
      .accounts({
        farmer: wallet.publicKey,
        asset,
      })
      .rpc();
  }, "simulate_income_distribution");
}
