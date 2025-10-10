import { CommandExecutor } from "../cli/common";
import { secretName } from "./k8s-constants";
import { kubectlCommand, patchSecretKeyCommand } from "./k8s-helpers";

// This env file should not be used in local development
const SECRET_FILE_NAME = "env_json";

// Basic commands (L1)

// Override the secret value with the new value
function execUpdateSecret(
  monorepoEnv: string,
  secretValue: Record<string, string>
) {
  const { fullCommand, redactedCommand } = patchSecretKeyCommand(monorepoEnv, secretName(), SECRET_FILE_NAME, JSON.stringify(secretValue));
  new CommandExecutor(fullCommand, { quiet: true, redactedCommand }).exec();
}

export function getMonorepoSecretObject(monorepoEnv: string, keys: string[] = []) {
  // Dots in jsonpath can only be accessed with a \ prefix
  const escapedSecretFileName = SECRET_FILE_NAME.replaceAll(".", "\\.");
  // prettier-ignore
  const cmd = kubectlCommand(`get secrets/${secretName()} -o jsonpath="{.data['${escapedSecretFileName}']}"`, { monorepoEnv });
  const res = new CommandExecutor(cmd, { quiet: true }).exec();
  if (!res) return {};
  const resJson: Record<string, string> = JSON.parse(atob(res));
  if (!keys || keys.length === 0) return resJson;
  return Object.fromEntries(
    keys.filter((x) => resJson[x]).map((x) => [x, resJson[x]])
  );
}

// Combined commands (L2)

function updateSecret(monorepoEnv: string, vars: Record<string, string>) {
  if (!vars || Object.keys(vars).length === 0) {
    console.error(
      "Keys-value pairs to set must be provided, e.g. KEY1=val1 KEY2=val2"
    );
    process.exit(1);
  }
  const current = getMonorepoSecretObject(monorepoEnv);
  const newVars = { ...current, ...vars };
  execUpdateSecret(monorepoEnv, newVars);
}

function deleteSecretKeys(monorepoEnv: string, keys: string[] = []) {
  if (!keys || keys.length === 0) {
    console.error("Keys to delete must be provided");
    process.exit(1);
  }
  const secretValue = getMonorepoSecretObject(monorepoEnv);
  keys.forEach((key) => delete secretValue[key]);
  execUpdateSecret(monorepoEnv, secretValue);
}

//= Interface (L3)

export function getMonorepoSecretStr(monorepoEnv: string, keys: string[] = []) {
  const value = getMonorepoSecretObject(monorepoEnv, keys);
  if (Object.keys(value).length === 1) {
    return Object.values(value)[0];
  }
  
  return Object.entries(value)
    .map((pair) => pair.join("="))
    .join("\n");
}

/** E.g.: setMonorepoSecret('staging', ['KEY1=val1', 'KEY2=val2']) */
export function setMonorepoSecret(monorepoEnv: string, pairs: string[] = []) {
  const pairsObj = Object.fromEntries(
    pairs.map((x) => {
      const [key, ...values] = x.split("=");
      return [key, values.join("=")];
    })
  );
  updateSecret(monorepoEnv, pairsObj);
}

export function deleteMonorepoSecret(monorepoEnv: string, keys: string[] = []) {
  deleteSecretKeys(monorepoEnv, keys);
}
