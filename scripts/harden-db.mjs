import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const candidateUrls = [process.env.DATABASE_URL, process.env.DATABASE_RUNTIME_URL].filter(Boolean);

if (candidateUrls.length === 0) {
  console.error(
    "DATABASE_URL or DATABASE_RUNTIME_URL is missing. Add your Supabase Postgres connection strings to .env first.",
  );
  process.exit(1);
}

const PUBLIC_TABLES = [
  '"Release"',
  '"Vote"',
  '"AppState"',
  '"AnalyticsEvent"',
  '"RateLimitEntry"',
  '"ReleaseReaction"',
  '"AnalyticsActionLock"',
  '"WorkflowRunState"',
  '"OpsAlert"',
  '"AlertDeliveryLog"',
];

async function main() {
  let lastError = null;

  for (const connectionString of candidateUrls) {
    const pool = createPool(connectionString);
    let client = null;

    try {
      client = await pool.connect();
      await client.query("begin");

      await client.query(`
      create or replace function public.moosqa_rls_auto_enable()
      returns event_trigger
      language plpgsql
      security definer
      set search_path = pg_catalog
      as $$
      declare
        cmd record;
      begin
        for cmd in
          select *
          from pg_event_trigger_ddl_commands()
          where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
            and object_type in ('table', 'partitioned table')
        loop
          if cmd.schema_name is not null
             and cmd.schema_name in ('public')
             and cmd.schema_name not in ('pg_catalog', 'information_schema')
             and cmd.schema_name not like 'pg_toast%'
             and cmd.schema_name not like 'pg_temp%' then
            begin
              execute format('alter table if exists %s enable row level security', cmd.object_identity);
            exception
              when others then
                raise log 'moosqa_rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
            end;
          end if;
        end loop;
      end;
      $$;
    `);

      await client.query(`drop event trigger if exists moosqa_ensure_rls;`);
      await client.query(`
      create event trigger moosqa_ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.moosqa_rls_auto_enable();
    `);

      await client.query(`
      alter default privileges for role postgres in schema public
      revoke all on tables from anon, authenticated;
    `);
      await client.query(`
      alter default privileges for role postgres in schema public
      revoke all on sequences from anon, authenticated;
    `);

      for (const tableName of PUBLIC_TABLES) {
        await client.query(`alter table if exists public.${tableName} enable row level security;`);
        await client.query(`revoke all on table public.${tableName} from anon, authenticated;`);
        await client.query(`revoke all on table public.${tableName} from public;`);

        const policyRows = await client.query(
          `
          select policyname
          from pg_policies
          where schemaname = 'public'
            and tablename = $1
        `,
          [tableName.replaceAll('"', "")],
        );

        for (const row of policyRows.rows) {
          await client.query(`drop policy if exists "${row.policyname}" on public.${tableName};`);
        }
      }

      await client.query("commit");
      console.log(
        JSON.stringify(
          {
            ok: true,
            hardenedTables: PUBLIC_TABLES.map((tableName) => `public.${tableName}`),
            eventTrigger: "moosqa_ensure_rls",
            connectionHost: new URL(connectionString).hostname,
          },
          null,
          2,
        ),
      );
      return;
    } catch (error) {
      lastError = error;
      if (client) {
        try {
          await client.query("rollback");
        } catch {}
      }
    } finally {
      client?.release();
      await pool.end();
    }
  }

  throw lastError;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function shouldUseSsl(connectionString) {
  try {
    const hostname = new URL(connectionString).hostname.toLowerCase();
    return !["localhost", "127.0.0.1"].includes(hostname);
  } catch {
    return true;
  }
}

function createPool(connectionString) {
  return new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString)
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
    max: 1,
  });
}
