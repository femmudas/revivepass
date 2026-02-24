import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const schema = z.object({
  SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  PRIVATE_KEY: z
    .string()
    .default(
      JSON.stringify([
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      ])
    ),
  METADATA_URI: z
    .string()
    .url()
    .default(
      "https://gateway.pinata.cloud/ipfs/bafybeidxodle6nc54u6igkez7tuve24utvtbhmldxal5ewbsmpuaskkj4u"
    ),
  TAPESTRY_API_URL: z.string().url().default("https://api.usetapestry.dev"),
  TAPESTRY_API_KEY: z.string().default(""),
  DB_PATH: z.string().min(1).default("./data/revivepass.sqlite"),
  PORT: z.coerce.number().default(4000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
