import "dotenv/config";
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL && !process.env.DATABASE_RUNTIME_URL) {
  console.error(
    "DATABASE_URL or DATABASE_RUNTIME_URL is missing. Add your Supabase Postgres connection strings to .env first.",
  );
  process.exit(1);
}

const push = runDbPush(process.env.DATABASE_URL);

if (push.status !== 0) {
  if (!process.env.DATABASE_RUNTIME_URL) {
    process.exit(push.status ?? 1);
  }

  console.warn("Direct database push failed. Retrying with DATABASE_RUNTIME_URL.");
  const runtimePush = runDbPush(process.env.DATABASE_RUNTIME_URL);
  if (runtimePush.status !== 0) {
    process.exit(runtimePush.status ?? 1);
  }
}

const generate = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  shell: true,
});

if (generate.status !== 0) {
  process.exit(generate.status ?? 1);
}

console.log("Postgres schema is ready.");

function runDbPush(databaseUrl) {
  return spawnSync("npx", ["prisma", "db", "push"], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}
