import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createMigrationSchema, claimSchema } from "@revivepass/shared";
import { db } from "../db.js";
import {
  mergeSnapshotCsvAandB,
  parseSnapshotAmountCsv,
  parseSnapshotCsv,
  parseSnapshotMappingCsv,
  type SnapshotRow,
} from "../lib/csv.js";
import { mintRevivalPass } from "../lib/mint.js";
import { env } from "../config.js";
import { verifyWalletSignature } from "../lib/auth.js";
import { mergeSnapshotRows } from "../lib/snapshot.js";
import { requireAdmin } from "../lib/admin.js";

type Migration = {
  id: number;
  name: string;
  slug: string;
  description: string;
  symbol: string;
  status: "draft" | "open" | "closed";
  total_snapshot_count: number;
};

type MetadataJson = {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
};

const getMigration = (slug: string) =>
  db
    .prepare(`SELECT * FROM migrations WHERE slug = ?`)
    .get(slug) as Migration | undefined;

const clusterSuffix = env.SOLANA_RPC_URL.includes("devnet")
  ? "?cluster=devnet"
  : env.SOLANA_RPC_URL.includes("testnet")
    ? "?cluster=testnet"
    : "";

const migrationStatusSchema = z.object({
  status: z.enum(["draft", "open", "closed"]),
});

const loadMetadataJson = async (): Promise<MetadataJson | null> => {
  try {
    const response = await fetch(env.METADATA_URI, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as MetadataJson;
  } catch {
    return null;
  }
};

export const registerMigrationRoutes = async (app: FastifyInstance) => {
  app.post("/migrations", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    const parsed = createMigrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      db.prepare(
        `INSERT INTO migrations(name, slug, description, symbol, status)
         VALUES (?, ?, ?, ?, 'draft')`
      ).run(parsed.data.name, parsed.data.slug, parsed.data.description, parsed.data.symbol);
    } catch {
      return reply.status(409).send({ error: "Migration slug already exists" });
    }

    const migration = getMigration(parsed.data.slug);
    return reply.status(201).send({ migration });
  });

  app.post("/migrations/:slug/snapshot", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    const { slug } = request.params as { slug: string };
    const migration = getMigration(slug);
    if (!migration) {
      return reply.status(404).send({ error: "Migration not found" });
    }

    if (migration.status !== "draft") {
      return reply
        .status(409)
        .send({ error: "Snapshot can only be updated while migration status is draft" });
    }

    let csvCombined = "";
    let csvA = "";
    let csvB = "";
    const manualAddressInputs: unknown[] = [];
    let jsonManualAddressesInput: unknown;
    if (request.isMultipart()) {
      for await (const part of request.parts()) {
        if (part.type === "field") {
          if (part.fieldname === "manualAddresses" || part.fieldname === "manualAddresses[]") {
            manualAddressInputs.push(part.value);
          }
          continue;
        }

        if (!["file", "csv", "csvA", "csvB"].includes(part.fieldname)) {
          for await (const _ of part.file) {
            // consume unknown file stream
          }
          continue;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const value = Buffer.concat(chunks).toString("utf8");

        if (part.fieldname === "file" || part.fieldname === "csv") {
          csvCombined = value;
        } else if (part.fieldname === "csvA") {
          csvA = value;
        } else if (part.fieldname === "csvB") {
          csvB = value;
        }
      }
    } else {
      const body = request.body as {
        csv?: string;
        csvA?: string;
        csvB?: string;
        manualAddresses?: unknown;
      };
      csvCombined = body?.csv ?? "";
      csvA = body?.csvA ?? "";
      csvB = body?.csvB ?? "";
      jsonManualAddressesInput = body?.manualAddresses;
    }

    let rows: SnapshotRow[] = [];
    let csvProvided = 0;
    let csvAProvided = 0;
    let csvBProvided = 0;
    let matched = 0;
    let unmatchedA = 0;
    let unmatchedB = 0;
    let csvDuplicatesIgnored = 0;

    if (csvCombined.trim()) {
      try {
        rows = parseSnapshotCsv(csvCombined);
        csvProvided = rows.length;
        matched = rows.length;
      } catch (error) {
        return reply.status(400).send({ error: (error as Error).message });
      }
    } else if (csvA.trim() || csvB.trim()) {
      try {
        const rowsA = csvA.trim() ? parseSnapshotAmountCsv(csvA) : [];
        const rowsB = csvB.trim() ? parseSnapshotMappingCsv(csvB) : [];
        const merged = mergeSnapshotCsvAandB(rowsA, rowsB);
        rows = merged.rows;
        csvAProvided = merged.csvAProvided;
        csvBProvided = merged.csvBProvided;
        matched = merged.matched;
        unmatchedA = merged.unmatchedA;
        unmatchedB = merged.unmatchedB;
        csvDuplicatesIgnored = merged.duplicatesIgnored;
      } catch (error) {
        return reply.status(400).send({ error: (error as Error).message });
      }
    }

    const mergeResult = mergeSnapshotRows(
      rows,
      request.isMultipart() ? manualAddressInputs : jsonManualAddressesInput
    );

    if (!csvCombined.trim() && !csvA.trim() && !csvB.trim() && mergeResult.manualProvided === 0) {
      return reply
        .status(400)
        .send({ error: "CSV snapshot input or manual addresses are required" });
    }

    const snapshotRows = mergeResult.rows;

    if (snapshotRows.length === 0) {
      return reply.status(400).send({
        error: "No valid wallet addresses found",
        invalid: mergeResult.invalidEntries.length,
        invalidEntries: mergeResult.invalidEntries,
      });
    }

    const sync = db.transaction(() => {
      db.prepare(`DELETE FROM snapshot_entries WHERE migration_id = ?`).run(migration.id);
      const insert = db.prepare(
        `INSERT INTO snapshot_entries(migration_id, evm_address, solana_wallet, amount)
         VALUES (?, ?, ?, ?)`
      );

      for (const row of snapshotRows) {
        insert.run(migration.id, row.evm_address, row.solana_wallet, row.amount);
      }

      db.prepare(`UPDATE migrations SET total_snapshot_count = ? WHERE id = ?`).run(
        snapshotRows.length,
        migration.id
      );
    });

    try {
      sync();
    } catch (error) {
      return reply.status(400).send({ error: `Snapshot sync failed: ${(error as Error).message}` });
    }

    return {
      inserted: snapshotRows.length,
      status: migration.status,
      csvProvided: mergeResult.csvProvided,
      csvAProvided,
      csvBProvided,
      matched,
      unmatchedA,
      unmatchedB,
      manualProvided: mergeResult.manualProvided,
      manualInserted: mergeResult.manualInserted,
      duplicatesIgnored: mergeResult.duplicatesIgnored + csvDuplicatesIgnored,
      invalid: mergeResult.invalidEntries.length,
      invalidEntries: mergeResult.invalidEntries,
    };
  });

  app.get("/migrations/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const migration = getMigration(slug);
    if (!migration) {
      return reply.status(404).send({ error: "Migration not found" });
    }

    const claimed = db
      .prepare(`SELECT COUNT(*) as count FROM claims WHERE migration_id = ?`)
      .get(migration.id) as { count: number };

    return {
      migration,
      claimed: claimed.count,
      remaining: Math.max(0, migration.total_snapshot_count - claimed.count),
      claimLink: `/claim/${migration.slug}`,
    };
  });

  app.post("/migrations/:slug/status", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    const { slug } = request.params as { slug: string };
    const parsed = migrationStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const migration = getMigration(slug);
    if (!migration) {
      return reply.status(404).send({ error: "Migration not found" });
    }

    const nextStatus = parsed.data.status;
    const current = migration.status;

    if (nextStatus === current) {
      return { ok: true, migration: { ...migration, status: current } };
    }

    const isValidTransition =
      (current === "draft" && nextStatus === "open") ||
      (current === "open" && nextStatus === "closed");

    if (!isValidTransition) {
      return reply.status(400).send({
        error: `Invalid status transition: ${current} -> ${nextStatus}. Allowed flow is draft -> open -> closed.`,
      });
    }

    if (nextStatus === "open" && migration.total_snapshot_count < 1) {
      return reply.status(400).send({ error: "Cannot open claim without snapshot entries" });
    }

    db.prepare(`UPDATE migrations SET status = ? WHERE id = ?`).run(nextStatus, migration.id);
    const updated = getMigration(slug);
    return { ok: true, migration: updated };
  });

  app.get("/migrations/:slug/metadata", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const migration = getMigration(slug);
    if (!migration) {
      return reply.status(404).send({ error: "Migration not found" });
    }

    const upstream = await loadMetadataJson();

    return {
      metadataUri: env.METADATA_URI,
      name: upstream?.name ?? `${migration.name} Revival Pass`,
      symbol: upstream?.symbol ?? migration.symbol,
      description: upstream?.description ?? migration.description,
      image: upstream?.image ?? null,
    };
  });

  app.get("/migrations/:slug/eligibility", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { wallet } = request.query as { wallet?: string };

    if (!wallet) {
      return reply.status(400).send({ error: "wallet query param is required" });
    }

    const migration = getMigration(slug);
    if (!migration) {
      return reply.status(404).send({ error: "Migration not found" });
    }

    const row = db
      .prepare(
        `SELECT evm_address, solana_wallet, amount
         FROM snapshot_entries
         WHERE migration_id = ? AND lower(solana_wallet) = lower(?)`
      )
      .get(migration.id, wallet) as
      | { evm_address: string; solana_wallet: string; amount: number }
      | undefined;

    const alreadyClaimed = db
      .prepare(`SELECT tx_signature, mint_address FROM claims WHERE migration_id = ? AND wallet = ?`)
      .get(migration.id, wallet) as
      | { tx_signature: string; mint_address: string }
      | undefined;
    const claimOpen = migration.status === "open";

    return {
      eligible: Boolean(row),
      claimOpen,
      migrationStatus: migration.status,
      amount: row?.amount ?? 0,
      evmAddress: row?.evm_address ?? null,
      alreadyClaimed: Boolean(alreadyClaimed),
      existingClaim: alreadyClaimed
        ? {
            txSignature: alreadyClaimed.tx_signature,
            mintAddress: alreadyClaimed.mint_address,
            explorer: `https://explorer.solana.com/tx/${alreadyClaimed.tx_signature}${clusterSuffix}`,
          }
        : null,
    };
  });

  app.post("/migrations/:slug/claim", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parsed = claimSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const migration = getMigration(slug);
    if (!migration) {
      return reply.status(404).send({ error: "Migration not found" });
    }

    const existing = db
      .prepare(`SELECT tx_signature, mint_address FROM claims WHERE migration_id = ? AND wallet = ?`)
      .get(migration.id, parsed.data.wallet) as
      | { tx_signature: string; mint_address: string }
      | undefined;

    if (existing) {
      return {
        idempotent: true,
        txSignature: existing.tx_signature,
        mintAddress: existing.mint_address,
        explorer: `https://explorer.solana.com/tx/${existing.tx_signature}${clusterSuffix}`,
      };
    }

    if (migration.status !== "open") {
      return reply.status(403).send({ error: "Claim portal is not open for this migration" });
    }

    const nonceRow = db
      .prepare(
        `SELECT id, purpose, expires_at, used FROM auth_nonces
         WHERE wallet = ? AND nonce = ? ORDER BY id DESC LIMIT 1`
      )
      .get(parsed.data.wallet, parsed.data.nonce) as
      | { id: number; purpose: string; expires_at: string; used: number }
      | undefined;

    if (!nonceRow || nonceRow.used) {
      return reply.status(401).send({ error: "Nonce is invalid or already used" });
    }

    if (nonceRow.purpose !== "claim") {
      return reply.status(401).send({ error: "Nonce purpose mismatch" });
    }

    if (Date.parse(nonceRow.expires_at) < Date.now()) {
      return reply.status(401).send({ error: "Nonce expired" });
    }

    const valid = verifyWalletSignature(
      parsed.data.wallet,
      parsed.data.nonce,
      parsed.data.signature
    );

    if (!valid) {
      return reply.status(401).send({ error: "Invalid wallet signature" });
    }

    const entry = db
      .prepare(
        `SELECT evm_address, amount FROM snapshot_entries
         WHERE migration_id = ? AND lower(solana_wallet) = lower(?)`
      )
      .get(migration.id, parsed.data.wallet) as
      | { evm_address: string; amount: number }
      | undefined;

    if (!entry) {
      return reply.status(403).send({ error: "Wallet is not in snapshot" });
    }

    let minted: { txSignature: string; mintAddress: string };
    try {
      minted = await mintRevivalPass({
        ownerWallet: parsed.data.wallet,
        uri: env.METADATA_URI,
        name: `${migration.name} Revival Pass`,
        symbol: migration.symbol,
      });
    } catch (error) {
      request.log.error(error, "Mint failed");
      return reply.status(500).send({ error: "NFT mint failed" });
    }

    const commitClaim = db.transaction(() => {
      db.prepare(
        `INSERT INTO claims(migration_id, wallet, evm_address, amount, tx_signature, mint_address)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        migration.id,
        parsed.data.wallet,
        entry.evm_address,
        entry.amount,
        minted.txSignature,
        minted.mintAddress
      );

      db.prepare(`UPDATE auth_nonces SET used = 1 WHERE id = ?`).run(nonceRow.id);
    });

    try {
      commitClaim();
    } catch {
      const dup = db
        .prepare(`SELECT tx_signature, mint_address FROM claims WHERE migration_id = ? AND wallet = ?`)
        .get(migration.id, parsed.data.wallet) as
        | { tx_signature: string; mint_address: string }
        | undefined;
      if (dup) {
        return {
          idempotent: true,
          txSignature: dup.tx_signature,
          mintAddress: dup.mint_address,
          explorer: `https://explorer.solana.com/tx/${dup.tx_signature}${clusterSuffix}`,
        };
      }
      return reply.status(500).send({ error: "Claim persistence failed" });
    }

    return {
      idempotent: false,
      txSignature: minted.txSignature,
      mintAddress: minted.mintAddress,
      explorer: `https://explorer.solana.com/tx/${minted.txSignature}${clusterSuffix}`,
    };
  });

  app.get("/migrations/:slug/stats", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const migration = getMigration(slug);
    if (!migration) {
      return reply.status(404).send({ error: "Migration not found" });
    }

    const total = migration.total_snapshot_count;
    const claimed = (db
      .prepare(`SELECT COUNT(*) as count FROM claims WHERE migration_id = ?`)
      .get(migration.id) as { count: number }).count;
    const remaining = Math.max(0, total - claimed);

    const claimHistory = db
      .prepare(
        `SELECT substr(created_at, 1, 10) as date, COUNT(*) as value
         FROM claims WHERE migration_id = ?
         GROUP BY substr(created_at, 1, 10)
         ORDER BY date ASC`
      )
      .all(migration.id) as { date: string; value: number }[];

    return {
      total,
      claimed,
      remaining,
      progress: total > 0 ? Number(((claimed / total) * 100).toFixed(2)) : 0,
      claimHistory,
    };
  });
};
