import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { ReactNode } from "react";

import {
  requestSignInLink,
  signOut,
  updateNotificationPreferencesAction,
} from "@/app/account/actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAccountAuthMessage, normalizeAuthNextPath } from "@/lib/auth-flow";
import { getNotificationPreferenceState } from "@/lib/notifications";
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
  const notificationMessage = getAccountNotificationMessage(resolvedSearchParams.notifications);
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
  let notificationError = false;
  let notificationPreferences = null;

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

    try {
      notificationPreferences = await getNotificationPreferenceState(authState.user.id);
    } catch (error) {
      notificationError = true;
      console.error("Notification preference load failed.", error);
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
          {notificationMessage ? <AccountNotice>{notificationMessage}</AccountNotice> : null}
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
              notificationPreferences={notificationPreferences}
              notificationError={notificationError}
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
  notificationPreferences,
  notificationError,
}: {
  email: string;
  profileError: boolean;
  notificationPreferences: Awaited<ReturnType<typeof getNotificationPreferenceState>> | null;
  notificationError: boolean;
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
      {notificationError ? (
        <AccountNotice>Notification preferences could not be loaded right now.</AccountNotice>
      ) : null}
      <div className="mt-6 grid gap-3 border-t border-[var(--color-soft-line)] pt-5 text-sm leading-7 text-black/64">
        <p>Saved releases, follows, and digest delivery are managed from the same listener profile.</p>
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
      {notificationPreferences ? (
        <section id="notifications" className="mt-8 border-t border-[var(--color-soft-line)] pt-6">
          <p className="section-kicker text-black/44">Notifications</p>
          <div className="mt-4 grid gap-4 text-sm leading-7 text-black/64">
            <p>
              Digests use your account email{" "}
              <span className="break-words text-[var(--color-ink)]">{notificationPreferences.notificationEmail || "No email on file"}</span>.
            </p>
            {!notificationPreferences.transportReady ? (
              <AccountNotice>
                Email delivery is paused until server-side email transport is configured.
              </AccountNotice>
            ) : null}
            {!notificationPreferences.notificationEmail ? (
              <AccountNotice>
                Your auth account does not expose an email address, so notification delivery will stay paused.
              </AccountNotice>
            ) : null}
          </div>
          <form action={updateNotificationPreferencesAction} className="mt-5 grid gap-5">
            <label className="flex items-start gap-3 border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
              <input
                type="checkbox"
                name="emailNotifications"
                defaultChecked={notificationPreferences.emailNotifications}
                className="mt-1 h-4 w-4 accent-[var(--color-accent-strong)]"
              />
              <span className="grid gap-1">
                <span className="text-sm uppercase tracking-[0.16em] text-[var(--color-ink)]">
                  Email notifications
                </span>
                <span className="text-sm leading-6 text-black/58">
                  Master switch for all digest and future instant email delivery.
                </span>
              </span>
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <PreferenceToggle
                name="dailyDigest"
                title="Daily digest"
                description="A compact rundown of fresh matches from your follows and saved taste signals."
                defaultChecked={notificationPreferences.dailyDigest}
              />
              <PreferenceToggle
                name="weeklyDigest"
                title="Weekly digest"
                description="A broader Monday roundup when you want fewer, denser email touchpoints."
                defaultChecked={notificationPreferences.weeklyDigest}
              />
              <PreferenceToggle
                name="instantAlerts"
                title="Instant alerts"
                description="Reserved for direct follow matches. Preference is stored now, live sends can be added later."
                defaultChecked={notificationPreferences.instantAlerts}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-black/58">
                Digest timezone
                <input
                  name="digestTimezone"
                  type="text"
                  defaultValue={notificationPreferences.digestTimezone}
                  className="min-h-12 border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-base normal-case tracking-normal text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)]"
                  placeholder="Europe/Ljubljana"
                />
                <span className="text-[11px] normal-case tracking-normal text-black/48">
                  Use an IANA timezone name, for example Europe/Ljubljana or America/New_York.
                </span>
              </label>
              <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-black/58">
                Local digest hour
                <select
                  name="digestHourLocal"
                  defaultValue={String(notificationPreferences.digestHourLocal)}
                  className="min-h-12 border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-base normal-case tracking-normal text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)]"
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {hour.toString().padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
                <span className="text-[11px] normal-case tracking-normal text-black/48">
                  Digests only queue when the current local hour reaches this slot.
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-ink)] px-5 py-3 text-xs uppercase tracking-[0.18em] text-white transition hover:bg-[var(--color-accent-strong)]"
              >
                Save notification settings
              </button>
              <Link
                href="/radar"
                className="inline-flex min-h-12 items-center justify-center border border-[var(--color-line)] px-5 py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
              >
                Review radar
              </Link>
            </div>
          </form>
        </section>
      ) : null}
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

function PreferenceToggle({
  name,
  title,
  description,
  defaultChecked,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex h-full items-start gap-3 border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 accent-[var(--color-accent-strong)]"
      />
      <span className="grid gap-1">
        <span className="text-sm uppercase tracking-[0.16em] text-[var(--color-ink)]">{title}</span>
        <span className="text-sm leading-6 text-black/58">{description}</span>
      </span>
    </label>
  );
}

function getAccountNotificationMessage(value: string | string[] | undefined) {
  const code = Array.isArray(value) ? value[0] : value;

  if (code === "saved") {
    return "Notification preferences updated.";
  }

  if (code === "invalid-timezone") {
    return "Notification timezone must be a valid IANA timezone.";
  }

  return null;
}

function getDisplayName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const displayName = record.display_name || record.full_name || record.name;

  return typeof displayName === "string" ? displayName : null;
}
