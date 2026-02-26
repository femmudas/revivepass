import type { SnapshotRow } from "./csv.js";
import { PublicKey } from "@solana/web3.js";

export type SnapshotMergeResult = {
  rows: SnapshotRow[];
  csvProvided: number;
  manualProvided: number;
  manualInserted: number;
  duplicatesIgnored: number;
  invalidEntries: string[];
};

type MergeAddressesResult = {
  merged: string[];
  invalid: string[];
  duplicatesIgnored: number;
};

const normalizeWalletAddress = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    return null;
  }
};

const mergeAddresses = (csvAddresses: string[], manualAddresses: string[]): MergeAddressesResult => {
  const merged: string[] = [];
  const invalid: string[] = [];
  let duplicatesIgnored = 0;
  const seen = new Set<string>();

  for (const raw of [...csvAddresses, ...manualAddresses]) {
    const normalized = normalizeWalletAddress(raw);
    if (!normalized) {
      if (raw.trim()) invalid.push(raw.trim());
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      duplicatesIgnored += 1;
      continue;
    }
    seen.add(key);
    merged.push(normalized);
  }

  return { merged, invalid, duplicatesIgnored };
};

const splitAddressEntries = (value: string): string[] =>
  value
    .split(/[\r\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const parseManualAddressesInput = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input.flatMap((entry) => splitAddressEntries(String(entry)));
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.flatMap((entry) => splitAddressEntries(String(entry)));
        }
      } catch {
        // fall back to line parser
      }
    }
    return splitAddressEntries(trimmed);
  }
  return [];
};

export const mergeSnapshotRows = (
  csvRows: SnapshotRow[],
  manualAddressesInput: unknown
): SnapshotMergeResult => {
  const manualAddresses = parseManualAddressesInput(manualAddressesInput);
  const mergedAddresses = mergeAddresses(
    csvRows.map((row) => row.solana_wallet),
    manualAddresses
  );

  const csvRowsByWallet = new Map<string, SnapshotRow>();
  for (const row of csvRows) {
    const key = row.solana_wallet.toLowerCase();
    if (!csvRowsByWallet.has(key)) {
      csvRowsByWallet.set(key, row);
    }
  }

  const rows: SnapshotRow[] = [];
  let manualInserted = 0;

  for (const walletAddress of mergedAddresses.merged) {
    const key = walletAddress.toLowerCase();
    const fromCsv = csvRowsByWallet.get(key);
    if (fromCsv) {
      rows.push(fromCsv);
    } else {
      manualInserted += 1;
      rows.push({
        evm_address: "manual_entry",
        solana_wallet: walletAddress,
        amount: 1,
      });
    }
  }

  return {
    rows,
    csvProvided: csvRows.length,
    manualProvided: manualAddresses.length,
    manualInserted,
    duplicatesIgnored: mergedAddresses.duplicatesIgnored,
    invalidEntries: mergedAddresses.invalid,
  };
};
