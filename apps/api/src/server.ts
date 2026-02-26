import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config.js";
import { runMigrations } from "./db.js";
import { registerMigrationRoutes } from "./routes/migrations.js";
import { registerAuthRoutes } from "./routes/auth.js";

const app = Fastify({ logger: true, trustProxy: true });

await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 1024 * 1024 * 5 } });

runMigrations();

app.get("/health", async () => ({ ok: true, app: "revivepass-api" }));
await registerAuthRoutes(app);
await registerMigrationRoutes(app);

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
