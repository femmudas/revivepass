import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "./config.js";

const dbDir = path.dirname(env.DB_PATH);
if (dbDir && dbDir !== ".") {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(env.DB_PATH);
db.pragma("journal_mode = WAL");

export const runMigrations = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      symbol TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      total_snapshot_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS snapshot_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_id INTEGER NOT NULL,
      evm_address TEXT NOT NULL,
      solana_wallet TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (migration_id) REFERENCES migrations(id),
      UNIQUE(migration_id, solana_wallet)
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      evm_address TEXT,
      amount INTEGER NOT NULL DEFAULT 1,
      tx_signature TEXT NOT NULL,
      mint_address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (migration_id) REFERENCES migrations(id),
      UNIQUE(migration_id, wallet)
    );

    CREATE TABLE IF NOT EXISTS auth_nonces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL,
      nonce TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_snapshot_migration_wallet
      ON snapshot_entries(migration_id, solana_wallet);
    CREATE INDEX IF NOT EXISTS idx_claims_migration
      ON claims(migration_id);
    CREATE INDEX IF NOT EXISTS idx_nonce_wallet
      ON auth_nonces(wallet, nonce);
  `);
};