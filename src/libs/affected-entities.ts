import { getImageNames } from "./config";
import { commitExists, isAffected } from "./git-helpers";
import { getImageVersion } from "./k8s-lifecycle";
import {
  getImageDescendentData,
  getWorkspace,
  getWorkspaceImages,
} from "./workspace-discovery";

type AffectedOpts = {
  baseSha?: string;
  headSha?: string;
  fromLiveVersion?: boolean;
  monorepoEnv?: string;
};

export function isImageAffected(image: string, opts: AffectedOpts = {}) {
  const headSha = opts.headSha ?? "HEAD";
  let baseSha;
  if (opts.fromLiveVersion) {
    if (!opts.monorepoEnv) {
      throw new Error("monorepoEnv is required when fromLiveVersion is true");
    }
    baseSha = getImageVersion(opts.monorepoEnv, image);
    if (!baseSha) return true;
  }
  baseSha ??= opts.baseSha ?? "HEAD^";
  const descendentData = getImageDescendentData(image);
  if (!commitExists(baseSha) || !commitExists(headSha)) return true;

  for (const { rootPath } of descendentData) {
    if (isAffected(rootPath, { baseSha, headSha, skipCheck: true })) {
      return true;
    }
  }
  return false;
}

export function findImagesAffected(opts: AffectedOpts = {}) {
  return getImageNames().filter((imageName) =>
    isImageAffected(imageName, opts)
  );
}

export function isWorkspaceAffected(
  workspaceName: string,
  opts: { baseSha?: string; headSha?: string } = {}
) {
  const data = getWorkspace(workspaceName);
  return isAffected(data.rootPath, opts);
}

export function findImageWithAffectedWorkspace(
  workspaceName: string,
  opts: AffectedOpts = {}
) {
  const headSha = opts.headSha ?? "HEAD";
  const defaultBaseSha = opts.baseSha ?? "HEAD^";
  const rootPath = getWorkspace(workspaceName).rootPath;
  if (opts.fromLiveVersion && !opts.monorepoEnv) {
    throw new Error("monorepoEnv is required when fromLiveVersion is true");
  }
  for (const imageName of getWorkspaceImages(workspaceName)) {
    const baseSha = opts.fromLiveVersion
      ? getImageVersion(opts.monorepoEnv!, imageName)
      : defaultBaseSha;

    if (isAffected(rootPath, { baseSha, headSha })) {
      return imageName;
    }
  }
}
