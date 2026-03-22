import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="border border-[var(--color-line)] bg-[var(--color-panel)] px-8 py-10 text-center">
        <p className="section-kicker text-black/40">404</p>
        <h1 className="mt-3 text-5xl text-[var(--color-ink)] serif-display">Story not found</h1>
        <p className="mt-4 max-w-md text-black/60">
          The requested release was not found in the local database. Check the URL or run a fresh sync.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-full bg-[var(--color-sun)] px-5 py-3 font-semibold text-black">
          Back to front page
        </Link>
      </div>
    </main>
  );
}
