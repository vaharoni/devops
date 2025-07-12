import { getConst, getImageData } from "./config";

export const MISSING_DOMAIN_KEY_ERROR = "$$$MISSING_DOMAIN_KEY$$$"
const DEFAULT_REMOTE_ENVS = ["staging", "production"];
const DEFAULT_LOCAL_ENVS = ["development", "test"];

let _remoteSupportedEnvs: string[];
function remoteSupportedEnvs() {
  if (_remoteSupportedEnvs) return _remoteSupportedEnvs;
  const extra = getConst("extra-remote-environments", { ignoreIfInvalid: true }) ?? [];
  _remoteSupportedEnvs = [...DEFAULT_REMOTE_ENVS, ...extra];
  return _remoteSupportedEnvs;
}

let _localSupportedEnvs: string[];
function localSupportedEnvs() {
  if (_localSupportedEnvs) return _localSupportedEnvs;
  const extra = getConst("extra-local-environments", { ignoreIfInvalid: true }) ?? [];
  _localSupportedEnvs = [...DEFAULT_LOCAL_ENVS, ...extra];
  return _localSupportedEnvs
}

export function allSupportedEnvs() {
  return [...remoteSupportedEnvs(), ...localSupportedEnvs()];
}

function validateEnv(monorepoEnv?: string) {
  if (!monorepoEnv) throw new Error("MONOREPO_ENV cannot be empty");
  if (!remoteSupportedEnvs().includes(monorepoEnv)) {
    console.error(
      `MONOREPO_ENV must be one of: ${remoteSupportedEnvs().join(", ")}. Can be set using --env flag.`
    );
    process.exit(1);
  }
}

export function envToNamespace(monorepoEnv?: string) {
  validateEnv(monorepoEnv);
  return `${getConst("project-name")}-${monorepoEnv}`;
}

export function secretName() {
  return `${getConst("project-name")}-secret`;
}

export function imageDebugName(image: string) {
  return `${image}-debug`;
}

export function imageConfigMap(image: string) {
  return `image-config-${image}`;
}

export function containerRegistryImageName(image: string, monorepoEnv: string) {
  validateEnv(monorepoEnv);
  return `${getConst("project-name")}-${monorepoEnv}-${image}`;
}

export function containerRegistryPath() {
  return [getConst("registry-base-url"), getConst("registry-image-path-prefix", { ignoreIfInvalid: true })].filter(Boolean).join("/");
}

export function containerRegistryRepoPath(
  image: string,
  monorepoEnv: string,
  gitSha: string
) {
  return [
    getConst("registry-base-url"),
    getConst("registry-image-path-prefix", { ignoreIfInvalid: true }),
    [containerRegistryImageName(image, monorepoEnv), gitSha].join(":"),
  ].filter(Boolean).join("/");
}

export function domainNameForEnv(image: string, monorepoEnv: string) {
  const imageData = getImageData(image); 
  const value = imageData["domains"]?.[monorepoEnv] ?? MISSING_DOMAIN_KEY_ERROR;
  return value;
}

export function dbMigrateJobName(gitSha: string) {
  return `db-migrate-job-${gitSha.slice(0, 8)}`;
}
