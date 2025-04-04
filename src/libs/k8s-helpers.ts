import { CommandExecutor } from "../cli/common";
import { envToNamespace } from "./k8s-constants";
import fs from "fs";

const TMP_MANIFEST_FOLDER = "tmp/k8s-manifests";

export function kubectlCommand(
  cmd: string,
  opts: { monorepoEnv?: string; namespace?: string } = {}
) {
  if (opts.monorepoEnv || opts.namespace) {
    const namespace = opts.namespace ?? envToNamespace(opts.monorepoEnv);
    return `kubectl -n ${namespace} ${cmd}`;
  } else {
    return `kubectl ${cmd}`;
  }
}

export function upsertConfigMapCommand(monorepoEnv: string, configMapName: string, data: Record<string, string>) {
  const manifest = { 
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: configMapName,
      namespace: envToNamespace(monorepoEnv),
      labels: {
        env: monorepoEnv
      }
    },
    data
  }
  const applyCmd = kubectlCommand(`apply -f -`, { monorepoEnv });
  return `echo '${JSON.stringify(manifest)}' | ${applyCmd}`;
}

export function patchSecretKeyCommand(monorepoEnv: string, secretName: string, secretKey: string, secretValue: string) {
  const redactedCommand = kubectlCommand(
    `patch secret ${secretName} -p='{"stringData": {"${secretKey}": **REDACTED**}}'`,
    { monorepoEnv }
  );
  const fullCommand = redactedCommand.replace(
    "**REDACTED**",
    JSON.stringify(secretValue)
  );
  return { fullCommand, redactedCommand };
}

export function applyHandler(
  filePrefix: string,
  command: "apply" | "delete",
  manifest: string
) {
  if (!fs.existsSync(TMP_MANIFEST_FOLDER)) {
    fs.mkdirSync(TMP_MANIFEST_FOLDER, { recursive: true });
  }
  const path = `${TMP_MANIFEST_FOLDER}/${filePrefix}-${Date.now()}.yaml`;
  fs.writeFileSync(path, manifest);
  new CommandExecutor(kubectlCommand(`${command} -f ${path}`)).exec();
}