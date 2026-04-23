import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

import {
  isSupabaseAuthConfigured,
  requireSupabaseAuthConfig,
} from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const { url, publishableKey } = requireSupabaseAuthConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Route handlers and
          // server actions can; proxy token refresh will be added with auth UI.
        }
      },
    },
  });
}

export type SupabaseServerUserState = {
  configured: boolean;
  user: User | null;
  error: string | null;
};

export async function getSupabaseServerUser(): Promise<SupabaseServerUserState> {
  if (!isSupabaseAuthConfigured()) {
    return { configured: false, user: null, error: null };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return { configured: true, user: null, error: error.message };
  }

  return { configured: true, user: data.user, error: null };
}
