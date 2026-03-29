import rawIdl from "./idl/rwa_tokenization.json";

const ERROR_CODE_BY_HEX: Record<string, string> = {};
const ERROR_CODE_BY_DECIMAL: Record<string, string> = {};

for (const entry of (rawIdl as { errors?: { code: number; name: string; msg?: string }[] }).errors ?? []) {
  const n =
    typeof entry.code === "number"
      ? entry.code
      : parseInt(String(entry.code), 10);
  const hex = (n & 0xffff).toString(16).padStart(4, "0");
  ERROR_CODE_BY_HEX[hex] = entry.msg ?? entry.name;
  ERROR_CODE_BY_DECIMAL[String(n)] = entry.msg ?? entry.name;
}

/** Thrown by {@link wrapRpc} with a short, UI-safe message. */
export class RwaClientError extends Error {
  readonly original: unknown;

  constructor(message: string, original: unknown) {
    super(message);
    this.name = "RwaClientError";
    this.original = original;
  }
}

/**
 * Map Anchor / RPC failures to short user-facing copy (keeps MVP simple).
 */
export function formatSolanaError(err: unknown): string {
  if (err == null) return "Unknown error";

  if (err instanceof RwaClientError) return err.message;

  const msg = err instanceof Error ? err.message : String(err);

  const customHex = msg.match(/custom program error: 0x([0-9a-fA-F]+)/);
  if (customHex) {
    const mapped = ERROR_CODE_BY_HEX[customHex[1].toLowerCase()];
    if (mapped) return mapped;
  }
  const customDec = msg.match(/custom program error: (\d+)/);
  if (customDec) {
    const mapped = ERROR_CODE_BY_DECIMAL[customDec[1]];
    if (mapped) return mapped;
  }

  if (msg.includes("User rejected")) return "Wallet rejected the request.";
  if (msg.includes("insufficient lamports")) return "Insufficient SOL for fees or payment.";

  return msg.length > 220 ? `${msg.slice(0, 217)}…` : msg;
}

export async function wrapRpc<T>(
  op: () => Promise<T>,
  label = "Transaction"
): Promise<T> {
  try {
    return await op();
  } catch (e) {
    throw new RwaClientError(`${label}: ${formatSolanaError(e)}`, e);
  }
}
