import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { ReactNode } from "react";

import { requestSignInLink, signOut } from "@/app/account/actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAccountAuthMessage, normalizeAuthNextPath } from "@/lib/auth-flow";
import { getSiteUrl } from "@/lib/site";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/user-product";

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your MooSQA account, preferences, saved releases, and personal radar.",
  alternates: {
    canonical: `${getSiteUrl()}/account`,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountPage({ searchParams }: AccountPageProps) {
  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />

        <Suspense fallback={<AccountSkeleton />}>
          <AccountContent searchParams={searchParams} />
        </Suspense>

        <SiteFooter />
      </div>
    </main>
  );
}

async function AccountContent({ searchParams }: AccountPageProps) {
  await connection();

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const authMessage = getAccountAuthMessage(resolvedSearchParams.auth);
  const isSignedOut = resolvedSearchParams.signedOut === "1";
  const nextPath = normalizeAuthNextPath(
    Array.isArray(resolvedSearchParams.next)
      ? resolvedSearchParams.next[0]
      : resolvedSearchParams.next,
  );
  const authConfigured = isSupabaseAuthConfigured();
  const authState = authConfigured
    ? await getSupabaseServerUser()
    : { configured: false as const, user: null, error: null };

  let profileError = false;

  if (authState.user) {
    try {
      await ensureUserProfile({
        id: authState.user.id,
        email: authState.user.email,
        displayName: getDisplayName(authState.user.user_metadata),
      });
    } catch (error) {
      profileError = true;
      console.error("Account profile bootstrap failed.", error);
    }
  }

  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <div>
          <p className="section-kicker text-black/43">Listener account</p>
          <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-7xl">
            Your radar, saved.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-black/64">
            Sign in to start building a personal MooSQA layer for saved releases,
            followed artists and labels, and future digest controls.
          </p>
        </div>

        <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5 md:p-7">
          {authMessage ? <AccountNotice>{authMessage}</AccountNotice> : null}
          {isSignedOut ? <AccountNotice>You are signed out.</AccountNotice> : null}
          {authState.error ? (
            <AccountNotice>Account status could not be verified. Try again shortly.</AccountNotice>
          ) : null}

          {!authConfigured ? (
            <UnavailableAccountState />
          ) : authState.user ? (
            <SignedInAccountState
              email={authState.user.email || "Signed-in listener"}
              profileError={profileError}
            />
          ) : (
                <SignedOutAccountState nextPath={nextPath} />
          )}
        </div>
      </div>
    </section>
  );
}

function AccountSkeleton() {
  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <div>
          <p className="section-kicker text-black/43">Listener account</p>
          <div className="mt-4 h-20 max-w-lg animate-pulse bg-[var(--color-panel)]" />
          <div className="mt-5 h-20 max-w-xl animate-pulse bg-[var(--color-panel)]" />
        </div>
        <div className="min-h-64 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
      </div>
    </section>
  );
}

function SignedOutAccountState({ nextPath }: { nextPath: string }) {
  return (
    <div>
      <p className="section-kicker text-black/44">Sign in</p>
      <form action={requestSignInLink} className="mt-5 grid gap-4">
        <input type="hidden" name="next" value={nextPath} />
        <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-black/58">
          Email
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            className="min-h-12 border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-base normal-case tracking-normal text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)]"
            placeholder="you@example.com"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-ink)] px-5 py-3 text-xs uppercase tracking-[0.18em] text-white transition hover:bg-[var(--color-accent-strong)]"
        >
          Send sign-in link
        </button>
      </form>
      <p className="mt-4 text-xs leading-6 text-black/55">
        MooSQA uses a secure email link for first sign-in and returning accounts.
      </p>
    </div>
  );
}

function SignedInAccountState({
  email,
  profileError,
}: {
  email: string;
  profileError: boolean;
}) {
  return (
    <div>
      <p className="section-kicker text-black/44">Signed in</p>
      <p className="mt-4 break-words text-lg text-[var(--color-ink)]">{email}</p>
      {profileError ? (
        <AccountNotice>
          Your session is active, but the local profile could not be prepared yet.
        </AccountNotice>
      ) : null}
      <div className="mt-6 grid gap-3 border-t border-[var(--color-soft-line)] pt-5 text-sm leading-7 text-black/64">
        <p>Saved releases, follows, and digest preferences are ready for the next product slice.</p>
        <Link
          href="/radar"
          className="inline-flex w-fit border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white transition hover:opacity-90"
        >
          Open radar
        </Link>
        <Link
          href="/#latest"
          className="inline-flex w-fit border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Back to latest
        </Link>
      </div>
      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

function UnavailableAccountState() {
  return (
    <div>
      <p className="section-kicker text-black/44">Setup required</p>
      <p className="mt-4 text-sm leading-7 text-black/64">
        Supabase Auth is not configured for this environment yet. Public discovery remains
        available while account access is prepared.
      </p>
    </div>
  );
}

function AccountNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-sm leading-6 text-black/66">
      {children}
    </div>
  );
}

function getDisplayName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const displayName = record.display_name || record.full_name || record.name;

  return typeof displayName === "string" ? displayName : null;
}
