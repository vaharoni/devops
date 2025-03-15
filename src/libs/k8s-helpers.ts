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
