import { parse } from "csv-parse/sync";
import { PublicKey } from "@solana/web3.js";

export type SnapshotRow = {
  evm_address: string;
  solana_wallet: string;
  amount: number;
};

export type SnapshotAmountRow = {
  evm_address: string;
  amount: number;
};

export type SnapshotMappingRow = {
  evm_address: string;
  solana_wallet: string;
};

export type SnapshotABMergeResult = {
  rows: SnapshotRow[];
  csvAProvided: number;
  csvBProvided: number;
  matched: number;
  unmatchedA: number;
  unmatchedB: number;
  duplicatesIgnored: number;
};

const normalizeEvmAddress = (value: string): string | null => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
};

export const normalizeSolanaWallet = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    return null;
  }
};

const parseRecords = (csv: string) =>
  parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

const ensureHeaders = (records: Record<string, string>[], required: string[], message: string) => {
  if (records.length === 0) return;
  const headerKeys = Object.keys(records[0]);
  for (const key of required) {
    if (!headerKeys.includes(key)) {
      throw new Error(message);
    }
  }
};

export const parseSnapshotCsv = (csv: string): SnapshotRow[] => {
  const records = parseRecords(csv);
  ensureHeaders(records, ["evm_address", "solana_wallet", "amount"], "CSV headers must be: evm_address,solana_wallet,amount");

  return records.map((row, idx) => {
    const evm = normalizeEvmAddress(row.evm_address ?? "");
    if (!evm || !row.solana_wallet) {
      throw new Error(`Row ${idx + 2} missing evm_address or solana_wallet`);
    }
    const normalizedWallet = normalizeSolanaWallet(row.solana_wallet);
    if (!normalizedWallet) {
      throw new Error(`Row ${idx + 2} has invalid solana_wallet`);
    }
    const amount = Number(row.amount ?? "1");
    if (!Number.isFinite(amount) || amount < 1) {
      throw new Error(`Row ${idx + 2} has invalid amount`);
    }
    return {
      evm_address: evm,
      solana_wallet: normalizedWallet,
      amount: Math.floor(amount),
    };
  });
};

export const parseSnapshotAmountCsv = (csv: string): SnapshotAmountRow[] => {
  const records = parseRecords(csv);
  ensureHeaders(records, ["evm_address", "amount"], "CSV A headers must be: evm_address,amount");

  return records.map((row, idx) => {
    const evm = normalizeEvmAddress(row.evm_address ?? "");
    if (!evm) {
      throw new Error(`CSV A row ${idx + 2} missing evm_address`);
    }
    const amount = Number(row.amount ?? "1");
    if (!Number.isFinite(amount) || amount < 1) {
      throw new Error(`CSV A row ${idx + 2} has invalid amount`);
    }
    return {
      evm_address: evm,
      amount: Math.floor(amount),
    };
  });
};

export const parseSnapshotMappingCsv = (csv: string): SnapshotMappingRow[] => {
  const records = parseRecords(csv);
  ensureHeaders(records, ["evm_address", "solana_wallet"], "CSV B headers must be: evm_address,solana_wallet");

  return records.map((row, idx) => {
    const evm = normalizeEvmAddress(row.evm_address ?? "");
    if (!evm || !row.solana_wallet) {
      throw new Error(`CSV B row ${idx + 2} missing evm_address or solana_wallet`);
    }
    const wallet = normalizeSolanaWallet(row.solana_wallet);
    if (!wallet) {
      throw new Error(`CSV B row ${idx + 2} has invalid solana_wallet`);
    }
    return {
      evm_address: evm,
      solana_wallet: wallet,
    };
  });
};

export const mergeSnapshotCsvAandB = (
  csvA: SnapshotAmountRow[],
  csvB: SnapshotMappingRow[]
): SnapshotABMergeResult => {
  const amounts = new Map<string, number>();
  const mappings = new Map<string, string>();
  const seenWallets = new Set<string>();
  let duplicatesIgnored = 0;

  for (const row of csvA) {
    if (amounts.has(row.evm_address)) {
      duplicatesIgnored += 1;
      continue;
    }
    amounts.set(row.evm_address, row.amount);
  }

  for (const row of csvB) {
    if (mappings.has(row.evm_address)) {
      duplicatesIgnored += 1;
      continue;
    }
    mappings.set(row.evm_address, row.solana_wallet);
  }

  const rows: SnapshotRow[] = [];
  let unmatchedA = 0;
  let unmatchedB = 0;

  for (const [evm, amount] of amounts.entries()) {
    const wallet = mappings.get(evm);
    if (!wallet) {
      unmatchedA += 1;
      continue;
    }
    const key = wallet.toLowerCase();
    if (seenWallets.has(key)) {
      duplicatesIgnored += 1;
      continue;
    }
    seenWallets.add(key);
    rows.push({
      evm_address: evm,
      solana_wallet: wallet,
      amount,
    });
  }

  for (const evm of mappings.keys()) {
    if (!amounts.has(evm)) {
      unmatchedB += 1;
    }
  }

  return {
    rows,
    csvAProvided: csvA.length,
    csvBProvided: csvB.length,
    matched: rows.length,
    unmatchedA,
    unmatchedB,
    duplicatesIgnored,
  };
};

