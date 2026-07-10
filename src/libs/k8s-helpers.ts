import { spawn } from "child_process";
import chalk from "chalk";
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

/**
 * Runs a kubectl port-forward command and automatically restarts it when it
 * drops. kubectl terminates the whole forward whenever any single forwarded
 * connection errors (e.g. the remote end resets a connection), so a bare
 * port-forward disconnects constantly under real use. Ctrl-C stops the loop
 * (SIGINT reaches both this process and the child).
 *
 * If the forward exits immediately several times in a row (bad namespace,
 * no cluster access), it gives up instead of spamming retries.
 */
export function establishResilientPortForward(cmd: string) {
  const restartDelayMs = 1000;
  const rapidExitThresholdMs = 3000;
  const maxConsecutiveRapidExits = 3;
  let consecutiveRapidExits = 0;
  console.log(cmd);
  const run = () => {
    const startedAt = Date.now();
    const child = spawn(cmd, { stdio: "inherit", shell: true });
    child.on("error", (error) => {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    });
    child.on("close", (code) => {
      const rapidExit = Date.now() - startedAt < rapidExitThresholdMs;
      consecutiveRapidExits = rapidExit ? consecutiveRapidExits + 1 : 0;
      if (consecutiveRapidExits >= maxConsecutiveRapidExits) {
        console.error(
          chalk.red(
            `Port-forward keeps exiting immediately (last code ${code}); giving up.`
          )
        );
        process.exit(code ?? 1);
      }
      console.error(
        chalk.yellow(
          `Port-forward exited (code ${code}); restarting in ${restartDelayMs / 1000}s — Ctrl-C to stop.`
        )
      );
      setTimeout(run, restartDelayMs);
    });
  };
  run();
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