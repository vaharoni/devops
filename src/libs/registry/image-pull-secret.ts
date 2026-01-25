import { CommandExecutor } from "../../cli/common";
import { getConst } from "../config";
import { envToNamespace } from "../k8s-constants";
import { kubectlCommand } from "../k8s-helpers";

const SECRET_NAME = "external-registry-secret";
const SOURCE_NAMESPACE = "default";

function isApplicable() {
  const useImagePullSecret = getConst("use-image-pull-secret");
  if (!useImagePullSecret) {
    return false;
  }
  return true;
}

export function copyRegistrySecretToNamespace(monorepoEnv: string) {
  if (!isApplicable()) return;

  const cmd = kubectlCommand(`get secret ${SECRET_NAME} -o json`, {
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
  // prettier-ignore
  const copyCmd = `echo '${JSON.stringify(relevantParts)}' | kubectl apply -f -`;
  new CommandExecutor(copyCmd, { quiet: true }).exec();
}

export function patchServiceAccountImagePullSecret(monorepoEnv: string) {
  if (!isApplicable()) return;

  const cmd = kubectlCommand(
    `patch serviceaccount default -p '{"imagePullSecrets": [{"name": "${SECRET_NAME}"}]}'`,
    { monorepoEnv }
  );
  new CommandExecutor(cmd, { quiet: true }).exec();
}
