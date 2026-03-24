let validated = false;

export async function ensureDatabase() {
  if (validated) {
    return;
  }

  if (!process.env.DATABASE_URL && !process.env.DATABASE_RUNTIME_URL) {
    throw new Error(
      "DATABASE_URL or DATABASE_RUNTIME_URL is required. Set your Supabase Postgres connection strings before starting MooSQA.",
    );
  }

  validated = true;
}
