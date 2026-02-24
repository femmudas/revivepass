import fs from "node:fs";
import path from "node:path";
import { runMigrations, db } from "../db.js";
import { parseSnapshotCsv } from "../lib/csv.js";

runMigrations();

const campaigns = [
  {
    slug: "community-revival-demo",
    name: "Community Revival Demo",
    description: "Demo migration campaign for testing claim and dashboard flow.",
    symbol: "REVIVE",
  },
  {
    slug: "social-campaign",
    name: "Migration Social Share",
    description: "Share your migration journey via Tapestry and connect with others.",
    symbol: "SOCIAL",
  },
];

const samplePath = path.resolve(process.cwd(), "../../samples/demo.csv");
const sampleCsv = fs.readFileSync(samplePath, "utf8");
const rows = parseSnapshotCsv(sampleCsv);

const ensureMigration = (campaign: (typeof campaigns)[number]) => {
  const existing = db
    .prepare(`SELECT id FROM migrations WHERE slug = ?`)
    .get(campaign.slug) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE migrations
       SET name = ?, description = ?, symbol = ?
       WHERE id = ?`
    ).run(campaign.name, campaign.description, campaign.symbol, existing.id);
    return existing.id;
  }

  const created = db
    .prepare(
      `INSERT INTO migrations(name, slug, description, symbol)
       VALUES (?, ?, ?, ?)`
    )
    .run(campaign.name, campaign.slug, campaign.description, campaign.symbol);

  return Number(created.lastInsertRowid);
};

const applySnapshot = db.transaction((migrationId: number) => {
  db.prepare(`DELETE FROM snapshot_entries WHERE migration_id = ?`).run(migrationId);
  db.prepare(`DELETE FROM claims WHERE migration_id = ?`).run(migrationId);

  const insert = db.prepare(
    `INSERT INTO snapshot_entries(migration_id, evm_address, solana_wallet, amount)
     VALUES (?, ?, ?, ?)`
  );

  for (const row of rows) {
    insert.run(migrationId, row.evm_address, row.solana_wallet, row.amount);
  }

  db.prepare(`UPDATE migrations SET total_snapshot_count = ? WHERE id = ?`).run(rows.length, migrationId);
});

for (const campaign of campaigns) {
  const migrationId = ensureMigration(campaign);
  applySnapshot(migrationId);
  console.log(`Seeded ${rows.length} snapshot entries for migration ${campaign.slug}.`);
}
