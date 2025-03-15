import fs from "fs";
import { CommandExecutor } from "../cli/common";
import {
  generateDbMigrateJob,
  generateEnvSetup,
  generateImageConfigMap,
  generateImageDeployments,
} from "./k8s-generate";
import { envToNamespace, imageConfigMap, secretName } from "./k8s-generators/k8s-constants";
import { k8sJobWaiter } from "./k8s-job-waiter";
import { kubectlCommand } from "./k8s-helpers";
import { getWorkspace } from "./workspace-discovery";

function applyHandler(
  filePrefix: string,
  command: "apply" | "delete",
  generator: () => { manifest: string; jobs?: string[] }
) {
  const folder = "tmp/k8s-manifests";
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }
  const path = `${folder}/${filePrefix}-${Date.now()}.yaml`;
  const { manifest, jobs } = generator();
  if (!manifest) {
    console.error("Manifest generated was empty. Skipping.");
    return { path: "", jobs: [] };
  }
  fs.writeFileSync(path, manifest);
  new CommandExecutor(kubectlCommand(`${command} -f ${path}`)).exec();
  return { path, jobs };
}

//= Image deployment

export function createImageDeployments(
  monorepoEnv: string,
  image: string,
  gitSha: string
) {
  return applyHandler(
    `apply-deployment-${image}-${gitSha.slice(0, 8)}`,
    "apply",
    () => generateImageDeployments(monorepoEnv, image, gitSha)
  );
}

export function deleteImageDeployments(monorepoEnv: string, image: string) {
  return applyHandler(`delete-deployment-${image}`, "delete", () =>
    generateImageDeployments(monorepoEnv, image, "delete-dummy")
  );
}

//= Env setup

export function checkEnvSetup(monorepoEnv: string) {
  const namespace = envToNamespace(monorepoEnv);
  const exitCode = new CommandExecutor(
    kubectlCommand(`get ns ${namespace}`)
  ).exec({
    onlyStatusCode: true,
  });
  return exitCode === 0;
}

export function createEnvSetup(monorepoEnv: string) {
  return applyHandler(`apply-env-setup`, "apply", () =>
    generateEnvSetup(monorepoEnv)
  );
}

export function deleteEnvSetup(monorepoEnv: string) {
  return applyHandler(`delete-env-setup`, "delete", () =>
    generateEnvSetup(monorepoEnv)
  );
}

//= DB Migrate job

export async function createDbMigrateJob(
  monorepoEnv: string,
  image: string,
  gitSha: string,
  timeoutInS: number
) {
  const { path, jobs } = applyHandler(
    `apply-db-migrate-job-${image}-${gitSha.slice(0, 8)}`,
    "apply",
    () => generateDbMigrateJob(monorepoEnv, image, gitSha)
  );
  if (!jobs || jobs.length === 0) {
    return { path, jobs };
  }
  const jobStatuses = await k8sJobWaiter(monorepoEnv, timeoutInS, jobs);
  return { path, jobs, statuses: jobStatuses };
}

export function deleteDbMigrateJob(monorepoEnv: string, image: string) {
  return applyHandler(`delete-db-migrate-job-${image}`, "delete", () =>
    generateDbMigrateJob(monorepoEnv, image, "delete-dummy")
  );
}

//= config map

function updateImageConfigMap(monorepoEnv: string, image: string, data = {}) {
  return applyHandler(`apply-image-config-map-${image}`, "apply", () =>
    generateImageConfigMap(monorepoEnv, image, data)
  );
}

function _deleteImageConfigMap(monorepoEnv: string, image: string) {
  return applyHandler(`delete-image-config-map-${image}`, "delete", () =>
    generateImageConfigMap(monorepoEnv, image)
  );
}

function getImageConfigMap(monorepoEnv: string, image: string) {
  const imageConfigMapName = imageConfigMap(image);
  const { statusCode, stdout } = new CommandExecutor(
    kubectlCommand(
      `get configmap ${imageConfigMapName} -o jsonpath='{.data.jsonKey}'`,
      { monorepoEnv }
    ),
    { quiet: true }
  ).exec({ asObject: true });
  if (statusCode !== 0) return {};
  try {
    return JSON.parse(stdout);
  } catch {
    console.error(
      `Error parsing config map data for ${image}. Received: ${stdout}`
    );
    process.exit(1);
  }
}

// = Version

export function getImageVersion(monorepoEnv: string, image: string) {
  const data = getImageConfigMap(monorepoEnv, image);
  return data.version;
}

export function setImageVersion(
  monorepoEnv: string,
  image: string,
  version: string
) {
  const data = getImageConfigMap(monorepoEnv, image);
  return updateImageConfigMap(monorepoEnv, image, { ...data, version });
}

export function deleteImageVersion(monorepoEnv: string, image: string) {
  const { version, ...rest } = getImageConfigMap(monorepoEnv, image);
  return updateImageConfigMap(monorepoEnv, image, rest);
}

// = Scale

function setK8sScale(
  monorepoEnv: string,
  workspaceName: string,
  replicaCount: number
) {
  const workspaceData = getWorkspace(workspaceName);
  const serviceName = workspaceData.data.deployment?.service_name;
  if (!serviceName) {
    console.error(
      `Workspace ${workspaceName} must have a service_name defined in its deployment key in package.json. Skipping.`
    );
    return false;
  }
  new CommandExecutor(
    kubectlCommand(
      `scale deployment ${serviceName} --replicas=${replicaCount}`,
      { monorepoEnv }
    )
  ).exec();
  return true;
}

// Returns the old version prior to setting
export function setWorkspaceScale(
  monorepoEnv: string,
  image: string,
  workspaceName: string,
  replicaCount: number
) {
  const workspaceData = getWorkspace(workspaceName);
  if (!workspaceData.data.deployment) {
    console.error(`Workspace ${workspaceName} does not have deployment data.`);
    process.exit(1);
  }
  if (replicaCount < 1) {
    console.error("Replica count must be at least 1.");
    process.exit(1);
  }
  const { scale, ...rest } = getImageConfigMap(monorepoEnv, image);
  updateImageConfigMap(monorepoEnv, image, {
    ...rest,
    scale: {
      ...scale,
      [workspaceName]: replicaCount,
    },
  });
  setK8sScale(monorepoEnv, workspaceName, replicaCount);
  return scale?.[workspaceName] ?? 1;
}

export function getWorkspaceScale(
  monorepoEnv: string,
  image: string,
  /** If not provided, returns all workspaces */
  workspaceName?: string
) {
  const { scale } = getImageConfigMap(monorepoEnv, image);
  if (!workspaceName) return scale ?? {};
  const _ensureWorkspace = getWorkspace(workspaceName);
  return scale?.[workspaceName] ?? 1;
}

/** Returns the old scale prior to deletion */
export function resetWorkspaceScale(
  monorepoEnv: string,
  image: string,
  workspaceName?: string
) {
  const { scale, ...rest } = getImageConfigMap(monorepoEnv, image);
  if (!workspaceName) {
    updateImageConfigMap(monorepoEnv, image, rest);
    Object.entries(scale)
      .filter(([_name, scale]) => Number(scale) > 1)
      .forEach(([name, scale]) => {
        setK8sScale(monorepoEnv, name, 1);
      });
    return scale;
  } else {
    const oldScale = scale[workspaceName];
    const newScale = { ...scale };
    delete newScale[workspaceName];
    updateImageConfigMap(monorepoEnv, image, { ...rest, scale: newScale });
    setK8sScale(monorepoEnv, workspaceName, 1);
    return oldScale;
  }
}
