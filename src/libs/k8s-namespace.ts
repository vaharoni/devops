import { CommandExecutor } from "../cli/common";
import { envToNamespace, secretName } from "./k8s-constants";
import { kubectlCommand, patchSecretKeyCommand } from "./k8s-helpers";
import { randomBytes } from "crypto";

export const BASE_SECRET_KEY = 'baseSecret';

export function checkEnvSetup(monorepoEnv: string) {
  const namespace = envToNamespace(monorepoEnv);
  const exitCode = new CommandExecutor(
    kubectlCommand(`get ns ${namespace}`)
  ).exec({
    onlyStatusCode: true,
  });
  return exitCode === 0;
}

export function createNamespace(monorepoEnv: string) {
  new CommandExecutor(kubectlCommand(`create ns ${envToNamespace(monorepoEnv)}`)).exec();
}

export function createEmptyEnvSecret(monorepoEnv: string) {
  const cmd = kubectlCommand(`create secret generic ${secretName()}`, {namespace: envToNamespace(monorepoEnv)});
  new CommandExecutor(cmd).exec();
}

export function patchBaseSecret(monorepoEnv: string) {
  const { fullCommand, redactedCommand } = patchSecretKeyCommand(
    monorepoEnv, 
    secretName(), 
    BASE_SECRET_KEY, 
    randomBytes(32).toString('hex')
  );
  new CommandExecutor(fullCommand, { quiet: true, redactedCommand }).exec();
}

export function deleteNamespace(monorepoEnv: string) {
  const cmd = kubectlCommand(`delete ns ${envToNamespace(monorepoEnv)}`);
  new CommandExecutor(cmd).exec();
}

