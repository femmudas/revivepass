import { parse } from "csv-parse/sync";

export type SnapshotRow = {
  evm_address: string;
  solana_wallet: string;
  amount: number;
};

export const parseSnapshotCsv = (csv: string): SnapshotRow[] => {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  if (records.length > 0) {
    const headerKeys = Object.keys(records[0]);
    const required = ["evm_address", "solana_wallet", "amount"];
    for (const key of required) {
      if (!headerKeys.includes(key)) {
        throw new Error("CSV headers must be: evm_address,solana_wallet,amount");
      }
    }
  }

  const parsed = records.map((row, idx) => {
    if (!row.evm_address || !row.solana_wallet) {
      throw new Error(`Row ${idx + 2} missing evm_address or solana_wallet`);
    }
    const amount = Number(row.amount ?? "1");
    if (!Number.isFinite(amount) || amount < 1) {
      throw new Error(`Row ${idx + 2} has invalid amount`);
    }
    return {
      evm_address: row.evm_address.toLowerCase(),
      solana_wallet: row.solana_wallet,
      amount: Math.floor(amount),
    };
  });

  return parsed;
};
