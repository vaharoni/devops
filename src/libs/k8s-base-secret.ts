import { CommandExecutor } from "../cli/common";
import { secretName } from "./k8s-generators/k8s-constants";
import { patchSecretCommand } from "./k8s-helpers";
import { randomBytes } from "crypto";

export const BASE_SECRET_KEY = 'baseSecret';

export function patchBaseSecret(monorepoEnv: string) {
  const { fullCommand, redactedCommand } = patchSecretCommand(
    monorepoEnv, 
    secretName(), 
    BASE_SECRET_KEY, 
    randomBytes(32).toString('hex')
  );
  new CommandExecutor(fullCommand, { quiet: true, redactedCommand }).exec();
}

