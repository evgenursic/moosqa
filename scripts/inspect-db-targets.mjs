import "dotenv/config";
import { Client } from "pg";

const targets = [
  { name: "DATABASE_URL", value: process.env.DATABASE_URL || "" },
  { name: "DATABASE_RUNTIME_URL", value: process.env.DATABASE_RUNTIME_URL || "" },
].filter((target) => target.value);

if (targets.length === 0) {
  console.error("DATABASE_URL or DATABASE_RUNTIME_URL is missing.");
  process.exit(1);
}

const requiredTables = [
  "Release",
  "UserProfile",
  "UserPreference",
  "UserSavedRelease",
  "UserFollow",
  "NotificationJob",
  "NotificationDeliveryLog",
];

for (const target of targets) {
  const client = new Client({
    connectionString: target.value,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 8_000,
    query_timeout: 8_000,
  });

  try {
    await client.connect();
    const result = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `);
    const tableNames = result.rows.map((row) => row.table_name);
    console.log(
      JSON.stringify(
        {
          target: target.name,
          host: new URL(target.value).hostname,
          requiredTablesPresent: requiredTables.every((tableName) => tableNames.includes(tableName)),
          missingTables: requiredTables.filter((tableName) => !tableNames.includes(tableName)),
          tableCount: tableNames.length,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          target: target.name,
          host: safeReadHost(target.value),
          ok: false,
          code: error?.code || null,
          message: error instanceof Error ? error.message : "Unknown database error",
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

function safeReadHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "invalid-url";
  }
}
