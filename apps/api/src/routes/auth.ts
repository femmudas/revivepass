import { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { authNonceSchema, authVerifySchema } from "@revivepass/shared";
import { db } from "../db.js";
import { verifyWalletSignature } from "../lib/auth.js";

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post("/auth/nonce", async (request, reply) => {
    const parsed = authNonceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const nonce = nanoid(24);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare(
      `INSERT INTO auth_nonces(wallet, nonce, expires_at, used) VALUES (?, ?, ?, 0)`
    ).run(parsed.data.wallet, nonce, expiresAt);

    return { nonce, message: `RevivePass nonce: ${nonce}`, expiresAt };
  });

  app.post("/auth/verify", async (request, reply) => {
    const parsed = authVerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const nonceRow = db
      .prepare(
        `SELECT wallet, nonce, expires_at, used FROM auth_nonces
         WHERE wallet = ? AND nonce = ? ORDER BY id DESC LIMIT 1`
      )
      .get(parsed.data.wallet, parsed.data.nonce) as
      | { wallet: string; nonce: string; expires_at: string; used: number }
      | undefined;

    if (!nonceRow) {
      return reply.status(400).send({ error: "Nonce not found" });
    }

    if (nonceRow.used) {
      return reply.status(400).send({ error: "Nonce already used" });
    }

    if (Date.parse(nonceRow.expires_at) < Date.now()) {
      return reply.status(400).send({ error: "Nonce expired" });
    }

    const valid = verifyWalletSignature(
      parsed.data.wallet,
      parsed.data.nonce,
      parsed.data.signature
    );

    if (!valid) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    return { ok: true };
  });
};