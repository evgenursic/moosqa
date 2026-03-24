import "dotenv/config";
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add your direct Supabase Postgres connection string to .env first.");
  process.exit(1);
}

const push = spawnSync("npx", ["prisma", "db", "push"], {
  stdio: "inherit",
  shell: true,
});

if (push.status !== 0) {
  process.exit(push.status ?? 1);
}

const generate = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  shell: true,
});

if (generate.status !== 0) {
  process.exit(generate.status ?? 1);
}

console.log("Postgres schema is ready.");
