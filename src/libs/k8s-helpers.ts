import { envToNamespace } from "./k8s-generators/k8s-constants";

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

export function patchSecretCommand(monorepoEnv: string, secretName: string, secretKey: string, secretValue: string) {
  const redactedCommand = kubectlCommand(
    `patch secret ${secretName} -p='{"stringData": {"${secretKey}": **REDACTED**}}'`,
    { monorepoEnv }
  );
  const fullCommand = redactedCommand.replace(
    "**REDACTED**",
    secretValue
  );
  return { fullCommand, redactedCommand };
}