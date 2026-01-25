import { CLICommandParser, printUsageAndExit, StrongParams } from "../../../src/cli/common";
import {
  copyRegistrySecretToNamespace,
  patchServiceAccountImagePullSecret,
} from "../../../src/libs/registry/image-pull-secret";
import { checkEnvSetup, createEmptyEnvSecret, createNamespace, deleteNamespace, patchBaseSecret } from "../../libs/k8s-namespace";

const oneLiner = "Creates the basic prerequisites for a monorepo";
const keyExamples = `
    $ devops namespace create --env staging
    $ devops namespace delete --env staging
    $ devops namespace check  --env staging
`.trim();

const usage = `
${oneLiner}

GENERAL USAGE
    devops namespcae create|delete|check --env <env>

    'create' does the following:
      1. Creates the namepace
      2. Creates a secret to hold environment variables (used by devops env) and the base cryptographic secret
      3. If use-image-pull-secret is true, copies the external-registry-secret to the namespace and patches the default service account to use it

    'delete' removes the namespace in kubernetes, which deletes all entities within it.

    'check' returns exit code 0 if the namespace exists in kubernetes, 1 otherwise.

EXAMPLES
    ${keyExamples}
`;

const handlers = {
  create (opts: StrongParams) {
    const env = opts.required("env");
    createNamespace(env);
    createEmptyEnvSecret(env);
    patchBaseSecret(env);
    copyRegistrySecretToNamespace(env);
    patchServiceAccountImagePullSecret(env);
  },
  delete (opts: StrongParams) {
    deleteNamespace(opts.required("env"));
  },
  check (opts: StrongParams) {
    const exists = checkEnvSetup(opts.required("env"));
    if (exists) return;
    console.error(`
      The environment does not exist in the cluster.
      In order to create resources for it in the cluster, it must be first set up. This is done to protect from unintentional resource creation.
      To set up the environment, run the following from your dev machine:
      $ devops namespace create --env <env>
    `);
    process.exit(1);
  },
};

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);

  const [command] = cmdObj.args;
  const handler = handlers[command as keyof typeof handlers];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printUsageAndExit(usage);
  }
  const params = new StrongParams(usage, {
    env: cmdObj.env,
  });
  handler(params);
}

export const namespace = { oneLiner, keyExamples, run };
