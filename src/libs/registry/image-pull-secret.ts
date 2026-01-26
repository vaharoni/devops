import { CommandExecutor } from "../../cli/common";
import { getConst } from "../config";
import { envToNamespace } from "../k8s-constants";
import { kubectlCommand } from "../k8s-helpers";

const SOURCE_NAMESPACE = "default";

function getSecretName(): string | null {
  const secretName = getConst("image-pull-secret-name");
  return secretName || null;
}

export function copyRegistrySecretToNamespace(monorepoEnv: string) {
  const secretName = getSecretName();
  if (!secretName) return;

  const cmd = kubectlCommand(`get secret ${secretName} -o json`, {
    monorepoEnv,
    namespace: SOURCE_NAMESPACE,
  });
  const secretStr = new CommandExecutor(cmd, { quiet: true }).exec();
  const secretJson = JSON.parse(secretStr);
  const {
    apiVersion,
    data,
    kind,
    metadata: { name },
    type,
  } = secretJson;

  const relevantParts = {
    apiVersion,
    data,
    kind,
    metadata: { name, namespace: envToNamespace(monorepoEnv) },
    type,
  };
  const redactedParts = {
    ...relevantParts,
    data: "**REDACTED**",
  };
  // prettier-ignore
  const copyCmd = `echo '${JSON.stringify(relevantParts)}' | kubectl apply -f -`;
  // prettier-ignore
  const redactedCommand = `echo '${JSON.stringify(redactedParts)}' | kubectl apply -f -`;
  new CommandExecutor(copyCmd, { quiet: true, redactedCommand }).exec();
}

export function patchServiceAccountImagePullSecret(monorepoEnv: string) {
  const secretName = getSecretName();
  if (!secretName) return;

  const cmd = kubectlCommand(
    `patch serviceaccount default -p '{"imagePullSecrets": [{"name": "${secretName}"}]}'`,
    { monorepoEnv }
  );
  new CommandExecutor(cmd, { quiet: true }).exec();
}
