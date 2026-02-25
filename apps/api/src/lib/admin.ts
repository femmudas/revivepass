import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import { env } from "../config.js";

const normalizeWallet = (wallet: string): string | null => {
  const trimmed = wallet.trim();
  if (!trimmed) return null;
  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    return null;
  }
};

const adminWalletSet = new Set(
  env.ADMIN_WALLETS.split(",")
    .map((entry) => normalizeWallet(entry) ?? "")
    .filter(Boolean)
    .map((entry) => entry.toLowerCase())
);

export const isAdminAuthEnabled = () => adminWalletSet.size > 0;

export const isAdminWallet = (wallet: string) => {
  if (!isAdminAuthEnabled()) return false;
  const normalized = normalizeWallet(wallet);
  if (!normalized) return false;
  return adminWalletSet.has(normalized.toLowerCase());
};

const readTokenFromRequest = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;
  if (authorization && authorization.startsWith("Bearer ")) {
    const value = authorization.slice("Bearer ".length).trim();
    if (value) return value;
  }
  const fallback = request.headers["x-admin-token"];
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }
  return null;
};

export const createAdminSession = (wallet: string) => {
  const normalized = normalizeWallet(wallet);
  if (!normalized) {
    throw new Error("Invalid admin wallet");
  }
  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + env.ADMIN_SESSION_HOURS * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO admin_sessions(wallet, token, expires_at, revoked)
     VALUES (?, ?, ?, 0)`
  ).run(normalized, token, expiresAt);
  return { token, wallet: normalized, expiresAt };
};

export const getAdminSession = (request: FastifyRequest) => {
  const token = readTokenFromRequest(request);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT wallet, token, expires_at, revoked
       FROM admin_sessions
       WHERE token = ?
       ORDER BY id DESC
       LIMIT 1`
    )
    .get(token) as
    | { wallet: string; token: string; expires_at: string; revoked: number }
    | undefined;

  if (!row || row.revoked) return null;
  if (Date.parse(row.expires_at) < Date.now()) return null;
  if (!isAdminWallet(row.wallet)) return null;

  return { wallet: row.wallet, token: row.token, expiresAt: row.expires_at };
};

export const revokeAdminSession = (token: string) => {
  db.prepare(`UPDATE admin_sessions SET revoked = 1 WHERE token = ?`).run(token);
};

export const requireAdmin = (request: FastifyRequest, reply: FastifyReply) => {
  if (!isAdminAuthEnabled()) {
    return {
      wallet: "public-access",
      token: "admin-auth-disabled",
      expiresAt: "never",
    };
  }

  const session = getAdminSession(request);
  if (!session) {
    reply.status(401).send({ error: "Admin authentication required" });
    return null;
  }
  return session;
};
