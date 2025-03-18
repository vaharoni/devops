import { getConst } from "./config";

export const K8S_SUPPORTED_ENVS = ["staging", "production"];
export const ALL_SUPPORTED_ENVS = [
  ...K8S_SUPPORTED_ENVS,
  "development",
  "test",
];

function validateEnv(monorepoEnv?: string) {
  if (!monorepoEnv) throw new Error("MONOREPO_ENV cannot be empty");
  if (!K8S_SUPPORTED_ENVS.includes(monorepoEnv)) {
    console.error(
      `MONOREPO_ENV must be one of: ${K8S_SUPPORTED_ENVS.join(", ")}. Can be set using --env flag.`
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

export function containerRegistryRepoName(image: string, monorepoEnv: string) {
  validateEnv(monorepoEnv);
  return `${getConst("project-name")}-${monorepoEnv}-${image}`;
}

export function containerRegistryPath() {
  return [getConst("registry-base-url"), getConst("registry-name")].join("/");
}

export function containerRegistryRepoPath(
  image: string,
  monorepoEnv: string,
  gitSha: string
) {
  return [
    getConst("registry-base-url"),
    getConst("registry-name"),
    [containerRegistryRepoName(image, monorepoEnv), gitSha].join(":"),
  ].join("/");
}

export function domainNameForEnv(monorepoEnv: string) {
  return monorepoEnv === "production"
    ? getConst("production-domain")
    : getConst("staging-domain");
}

export function dbMigrateJobName(gitSha: string) {
  return `db-migrate-job-${gitSha.slice(0, 8)}`;
}
