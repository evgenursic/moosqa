import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requireSupabaseAuthConfig } from "@/lib/supabase/config";

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
