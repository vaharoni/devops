import { CommandExecutor } from "../cli/common";

export function commitExists(sha: string) {
  const statusCode = new CommandExecutor(
    `git merge-base --is-ancestor "${sha}" HEAD`
  ).exec({ onlyStatusCode: true });
  return statusCode === 0;
}

export function firstCommit() {
  const res = new CommandExecutor(`git rev-list --max-parents=0 HEAD`, {
    quiet: true,
  }).exec();
  return res?.trim();
}

export function isAffected(
  path: string,
  opts: { baseSha?: string; headSha?: string; skipCheck?: boolean } = {}
) {
  const baseSha = opts.baseSha || "HEAD^";
  const headSha = opts.headSha || "HEAD";
  // When in doubt, assume it's affected
  if (!opts.skipCheck && (!commitExists(baseSha) || !commitExists(headSha)))
    return true;

  const statusCode = new CommandExecutor(
    `git diff --quiet ${baseSha} ${headSha} -- ${path}`,
    { quiet: true }
  ).exec({ onlyStatusCode: true });
  return statusCode !== 0;
}
