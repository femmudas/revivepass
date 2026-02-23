import fs from "node:fs";
import path from "node:path";
import { runMigrations, db } from "../db.js";
import { parseSnapshotCsv } from "../lib/csv.js";

runMigrations();

const slug = "sunrise-community";

const existing = db
  .prepare(`SELECT id FROM migrations WHERE slug = ?`)
  .get(slug) as { id: number } | undefined;

const migrationId = (() => {
  if (existing) {
    return existing.id;
  }
  const result = db
    .prepare(
      `INSERT INTO migrations(name, slug, description, symbol)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      "Sunrise Community Revival",
      slug,
      "Revive legacy-chain communities with a verified Solana migration pass.",
      "RVPASS"
    );
  return Number(result.lastInsertRowid);
})();

const samplePath = path.resolve(process.cwd(), "../../samples/demo.csv");
const sampleCsv = fs.readFileSync(samplePath, "utf8");
const rows = parseSnapshotCsv(sampleCsv);

const seed = db.transaction(() => {
  db.prepare(`DELETE FROM snapshot_entries WHERE migration_id = ?`).run(migrationId);
  const insert = db.prepare(
    `INSERT INTO snapshot_entries(migration_id, evm_address, solana_wallet, amount)
     VALUES (?, ?, ?, ?)`
  );
  for (const row of rows) {
    insert.run(migrationId, row.evm_address, row.solana_wallet, row.amount);
  }

  db.prepare(`DELETE FROM claims WHERE migration_id = ?`).run(migrationId);
  db.prepare(`UPDATE migrations SET total_snapshot_count = ? WHERE id = ?`).run(rows.length, migrationId);
});

seed();

console.log(`Seeded ${rows.length} snapshot entries for migration ${slug}.`);
