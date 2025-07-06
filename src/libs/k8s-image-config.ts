import { CommandExecutor } from "../cli/common";
import { getWorkspace } from "./discovery";
import { imageConfigMap } from "./k8s-constants";
import { kubectlCommand, upsertConfigMapCommand } from "./k8s-helpers";

//= config map

type ImageConfigMap = {
  version?: string;
  scale?: string;
}

function updateImageConfigMap(monorepoEnv: string, image: string, data = {}) {
  const imageConfigMapName = imageConfigMap(image);
  return new CommandExecutor(
    upsertConfigMapCommand(monorepoEnv, imageConfigMapName, data)
  ).exec();
}

function getImageConfigMap(monorepoEnv: string, image: string): ImageConfigMap {
  const imageConfigMapName = imageConfigMap(image);
  const { statusCode, stdout } = new CommandExecutor(
    kubectlCommand(
      `get configmap ${imageConfigMapName} -o jsonpath='{.data}'`,
      { monorepoEnv }
    ),
    { quiet: true }
  ).exec({ asObject: true });
  if (statusCode !== 0 || !stdout) return {};
  try {
    return JSON.parse(stdout);
  } catch {
    console.error(
      `Error parsing config map data for ${image}. Received: ${stdout}`
    );
    process.exit(1);
  }
}

function deserializeImageConfigMapKey<T>(monorepoEnv: string, image: string, key: keyof ImageConfigMap): Record<string, T> {
  const value = getImageConfigMap(monorepoEnv, image)[key];
  if (!value) return {};
  try {
    return JSON.parse(value);
  }
  catch {
    console.error(`Error parsing config map data for ${image} for key ${key}. Received: ${value}`);
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
  const serviceName = workspaceData.packageDataEntries.find(x => x.deployment?.service_name)?.deployment?.service_name;
  if (!serviceName) {
    console.error(
      `Workspace ${workspaceName} must have a service_name defined in its deployment key in package.json. Skipping.`
    );
    return false;
  }
  new CommandExecutor(
    kubectlCommand(
      `scale deployment ${workspaceName} --replicas=${replicaCount}`,
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
  if (!workspaceData.packageDataEntries.find(x => x.deployment)) {
    console.error(`Workspace ${workspaceName} does not have deployment data.`);
    process.exit(1);
  }
  if (replicaCount < 1) {
    console.error("Replica count must be at least 1.");
    process.exit(1);
  }
  const { scale: _scale, ...rest } = getImageConfigMap(monorepoEnv, image);
  const parsedScale = deserializeImageConfigMapKey<number>(monorepoEnv, image, "scale");
  const isApplicable = setK8sScale(monorepoEnv, workspaceName, replicaCount);
  if (!isApplicable) return;
  updateImageConfigMap(monorepoEnv, image, {
    ...rest,
    scale: JSON.stringify({
      ...parsedScale,
      [workspaceName]: replicaCount,
    }),
  });
  return parsedScale?.[workspaceName] ?? 1;
}

export function getWorkspaceScale(monorepoEnv: string, image: string): Record<string, number>;
export function getWorkspaceScale(monorepoEnv: string, image: string, workspaceName: string): number;
export function getWorkspaceScale(
  monorepoEnv: string,
  image: string,
  /** If not provided, returns all workspaces */
  workspaceName?: string
) {
  const parsedScale = deserializeImageConfigMapKey<number>(monorepoEnv, image, "scale");
  if (!workspaceName) return parsedScale ?? {};
  const _ensureWorkspace = getWorkspace(workspaceName);
  return parsedScale?.[workspaceName] ?? 1;
}

// /** Returns the old scale prior to deletion */
export function resetWorkspaceScale(
  monorepoEnv: string,
  image: string,
  workspaceName?: string
) {
  const { scale: _scale, ...rest } = getImageConfigMap(monorepoEnv, image);
  const parsedScale = deserializeImageConfigMapKey<number>(monorepoEnv, image, "scale");
  if (!workspaceName) {
    updateImageConfigMap(monorepoEnv, image, rest);
    Object.entries(parsedScale ?? {})
      .filter(([_name, scale]) => Number(scale) > 1)
      .forEach(([name, _scale]) => {
        setK8sScale(monorepoEnv, name, 1);
      });
    return parsedScale;
  } else {
    const oldScale = parsedScale?.[workspaceName] ?? 1;
    const newScale = { ...parsedScale };
    delete newScale[workspaceName];
    updateImageConfigMap(monorepoEnv, image, { ...rest, scale: JSON.stringify(newScale) });
    setK8sScale(monorepoEnv, workspaceName, 1);
    return oldScale;
  }
}
