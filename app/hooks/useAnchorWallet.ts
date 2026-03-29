"use client";

import type { AnchorWallet } from "../../lib/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

export function useAnchorWallet(): AnchorWallet | null {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  return useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    return { publicKey, signTransaction, signAllTransactions };
  }, [publicKey, signTransaction, signAllTransactions]);
}
