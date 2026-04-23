import Link from "next/link";

import { FollowTargetType } from "@/generated/prisma/enums";
import {
  followReleaseTargetAction,
  saveReleaseAction,
  unfollowReleaseTargetAction,
  unsaveReleaseAction,
} from "@/app/releases/actions";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getReleaseUserActionState } from "@/lib/user-product";

type ReleaseUserActionsProps = {
  releaseId: string;
  slug: string;
  artistName: string | null;
  labelName: string | null;
};

export async function ReleaseUserActions({
  releaseId,
  slug,
  artistName,
  labelName,
}: ReleaseUserActionsProps) {
  const returnPath = `/releases/${slug}`;

  if (!isSupabaseAuthConfigured()) {
    return <AccountPrompt returnPath={returnPath} message="Account saves are not enabled yet." />;
  }

  const authState = await getSupabaseServerUser();

  if (authState.error) {
    return (
      <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5 text-sm leading-7 text-black/62">
        Account actions are temporarily unavailable.
      </div>
    );
  }

  if (!authState.user) {
    return <AccountPrompt returnPath={returnPath} message="Sign in to save and follow this release." />;
  }

  const state = await getReleaseUserActionState({
    userId: authState.user.id,
    releaseId,
    artistName,
    labelName,
  });

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <p className="section-kicker text-black/45">Personal radar</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={state.isSaved ? unsaveReleaseAction : saveReleaseAction}>
          <input type="hidden" name="releaseId" value={releaseId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className={state.isSaved ? activeButtonClassName : buttonClassName}
          >
            {state.isSaved ? "Saved" : "Save release"}
          </button>
        </form>

        {state.followTargets.map((target) => (
          <form
            key={`${target.targetType}:${target.normalizedValue}`}
            action={target.isFollowing ? unfollowReleaseTargetAction : followReleaseTargetAction}
          >
            <input type="hidden" name="targetType" value={target.targetType} />
            <input type="hidden" name="targetValue" value={target.targetValue} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className={target.isFollowing ? activeButtonClassName : buttonClassName}
            >
              {target.isFollowing ? "Following" : `Follow ${getTargetLabel(target.targetType)}`}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

function AccountPrompt({ returnPath, message }: { returnPath: string; message: string }) {
  const href = `/account?next=${encodeURIComponent(returnPath)}`;

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <p className="section-kicker text-black/45">Personal radar</p>
      <p className="mt-3 text-sm leading-7 text-black/62">{message}</p>
      <Link
        href={href}
        className="mt-4 inline-flex border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
      >
        Open account
      </Link>
    </div>
  );
}

function getTargetLabel(targetType: FollowTargetType) {
  return targetType === FollowTargetType.ARTIST ? "artist" : "label";
}

const buttonClassName =
  "inline-flex min-h-11 items-center justify-center border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]";

const activeButtonClassName =
  "inline-flex min-h-11 items-center justify-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white transition hover:opacity-90";
