import { CommandExecutor } from "../../cli/common";
import { getConst } from "../config";
import { envToNamespace } from "../k8s-constants";
import { kubectlCommand } from "../k8s-helpers";

function isApplicable() {
  const registryInfra = getConst("registry-infra");
  if (registryInfra !== "harbor") {
    console.warn(
      "Setting up registry permissions is only needed for Harbor in a Hetzner setup"
    );
    return false;
  }
  return true;
}

export function copySecretHarborToNamespace(monorepoEnv: string) {
  if (!isApplicable()) return;

  const cmd = kubectlCommand("get secret harbor-registry-secret -o json", {
    monorepoEnv,
    namespace: "harbor",
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
    `patch serviceaccount default -p '{"imagePullSecrets": [{"name": "harbor-registry-secret"}]}'`,
    { monorepoEnv }
  );
  new CommandExecutor(cmd, { quiet: true }).exec();
}
