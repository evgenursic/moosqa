type SupabaseAuthEnv = Record<string, string | undefined> & {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

export type SupabaseAuthConfig = {
  url: string;
  publishableKey: string;
};

function normalizeSupabaseUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    const isLocal =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.endsWith(".local");

    if (parsed.protocol !== "https:" && !isLocal) {
      return null;
    }

    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getSupabaseAuthConfig(
  env: SupabaseAuthEnv = process.env,
): SupabaseAuthConfig | null {
  const url = normalizeSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const publishableKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseAuthConfigured(env: SupabaseAuthEnv = process.env) {
  return getSupabaseAuthConfig(env) !== null;
}

export function requireSupabaseAuthConfig(
  env: SupabaseAuthEnv = process.env,
): SupabaseAuthConfig {
  const config = getSupabaseAuthConfig(env);

  if (!config) {
    throw new Error(
      "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return config;
}
