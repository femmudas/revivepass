import { spawn } from "node:child_process";

const detectTarget = () => {
  const explicit = (process.env.SERVICE_TARGET || "").toLowerCase();
  if (explicit === "api" || explicit === "web") return explicit;

  const serviceName = (process.env.RAILWAY_SERVICE_NAME || "").toLowerCase();
  if (serviceName.includes("api")) return "api";
  if (serviceName.includes("web")) return "web";

  // Default to web so a single-service deploy still boots.
  return "web";
};

const target = detectTarget();
const args =
  target === "api"
    ? ["--filter", "@revivepass/api", "start"]
    : ["--filter", "@revivepass/web", "start"];

console.log(`[railway-start] target=${target}`);

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, args, { stdio: "inherit" });

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

