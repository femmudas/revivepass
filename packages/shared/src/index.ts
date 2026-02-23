import { z } from "zod";

export const createMigrationSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "slug can include lowercase letters, numbers and hyphens"),
  description: z.string().min(10),
  symbol: z.string().min(2).max(10).default("RVPASS"),
});

export const authNonceSchema = z.object({
  wallet: z.string().min(32).max(64),
});

export const authVerifySchema = z.object({
  wallet: z.string().min(32).max(64),
  nonce: z.string().min(8),
  signature: z.string().min(40),
});

export const claimSchema = z.object({
  wallet: z.string().min(32).max(64),
  signature: z.string().min(40),
  nonce: z.string().min(8),
});

export type CreateMigrationInput = z.infer<typeof createMigrationSchema>;
export type AuthNonceInput = z.infer<typeof authNonceSchema>;
export type AuthVerifyInput = z.infer<typeof authVerifySchema>;
export type ClaimInput = z.infer<typeof claimSchema>;
