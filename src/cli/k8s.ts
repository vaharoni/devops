import {
  copySecretHarborToNamespace,
  patchServiceAccountImagePullSecret,
} from "../libs/hetzner/reg-secret";
import {
  generateDbMigrateJob,
  generateEnvSetup,
  generateImageDeployments,
} from "../libs/k8s-generate";
import { type JobStatuses, printJobStatuses } from "../libs/k8s-job-waiter";
import {
  checkEnvSetup,
  createDbMigrateJob,
  createEnvSetup,
  createImageDeployments,
  deleteDbMigrateJob,
  deleteEnvSetup,
  deleteImageDeployments,
  deleteImageVersion,
  getImageVersion,
  setImageVersion,
} from "../libs/k8s-lifecycle";
import {
  CLICommandParser,
  CommandExecutor,
  StrongParams,
  printUsageAndExit,
} from "./common";

const oneLiner =
  "Kubernetes helper utility that manages the cluster lifecycle during deployment";
const keyExamples = `
    $ ./devops k8s check  env-setup      --env production
    $ ./devops k8s gen    env-setup      --env production
    $ ./devops k8s create env-setup      --env production
    $ ./devops k8s gen    deployments    node-services <sha>
    $ ./devops k8s create deployments    node-services <sha>
    $ ./devops k8s create db-migrate-job node-services <sha> --timeout 120
    $ ./devops k8s delete deployments    node-services
    $ ./devops k8s get    version        node-services
    $ ./devops k8s set    version        node-services <sha>
    $ ./devops k8s unset  version        node-services
`.trim();

const usage = `
${oneLiner}

USAGE
    Image-independent commands:
        ./devops k8s <sub-command> env-setup --env <env>

        Note that on Hetzner, "create" does a bit more than generating a YAML file and applying it. It also copies 
        the Harbor secret to the namespace and patches the default service account to use it.

    Image-specific commands:
        ./devops k8s <sub-command> deployments <image> <sha>
        ./devops k8s <sub-command> db-migrate-job <image> <sha> --timeout <timeout>
        ./devops k8s <sub-command> version <image> <sha>

    sub-command can be:
    - gen       prints to stdout
    - create    creates a manifest file and applies it
    - delete    creates a manifest file and deletes it. Does not require a sha to be provided.
    - check     only relevant for env-setup. Ensures that the namespace exists.
    - get       only relevant for version. Prints the current version of the image.
    - set       only relevant for version. Sets the version of the image.
    - unset     only relevant for version. Unsets the version of the image.

    db-migrate-job command accept an optional timeout to wait for all jobs to complete.
    Default is 240 seconds.
    
    The db-migrate-job must receive an image. During a deployment process, typically we first
    discern which images are affected since the last successful deployment, and then apply their deployments 
    and build jobs. If the db project is affected, we pick one random affected image to use when applying the 
    db-migrate-job.

EXAMPLES
    ${keyExamples}
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function awaitAndPrint(res: Promise<any>) {
  const concluded = await res;
  console.log(concluded ?? "");
}

async function handleGenerate({ manifest }: { manifest: string }) {
  console.log(manifest);
}

async function handleJobsStatuses(res: Promise<{ statuses?: JobStatuses }>) {
  const { statuses } = await res;
  if (statuses && Object.keys(statuses).length > 0) {
    printJobStatuses(statuses);
  }
}

function handleEnvCheck(exists: boolean) {
  if (exists) return;
  console.error(`
    The environment does not exist in the cluster.
    In order to create resources for it in the cluster, it must be first set up. This is done to protect from unintentional resource creation.
    To set up the environment, run the following from your dev machine:
    $ ./devops k8s create env-setup --env <env>
  `);
  process.exit(1);
}

const config = {
  "env-setup": {
    gen: (opt: StrongParams) =>
      handleGenerate(generateEnvSetup(opt.required("env"))),
    create: (opt: StrongParams) => {
      createEnvSetup(opt.required("env"));
      copySecretHarborToNamespace(opt.required("env"));
      patchServiceAccountImagePullSecret(opt.required("env"));
    },
    delete: (opt: StrongParams) => deleteEnvSetup(opt.required("env")),
    check: (opt: StrongParams) =>
      handleEnvCheck(checkEnvSetup(opt.required("env"))),
  },
  deployments: {
    gen: (opt: StrongParams) =>
      handleGenerate(
        generateImageDeployments(
          opt.required("env"),
          opt.required("image"),
          opt.required("gitSha")
        )
      ),
    create: (opt: StrongParams) =>
      createImageDeployments(
        opt.required("env"),
        opt.required("image"),
        opt.required("gitSha")
      ),
    delete: (opt: StrongParams) =>
      deleteImageDeployments(opt.required("env"), opt.required("image")),
  },
  "db-migrate-job": {
    gen: (opt: StrongParams) =>
      handleGenerate(
        generateDbMigrateJob(
          opt.required("env"),
          opt.required("image"),
          opt.required("gitSha")
        )
      ),
    create: (opt: StrongParams) =>
      handleJobsStatuses(
        createDbMigrateJob(
          opt.required("env"),
          opt.required("image"),
          opt.required("gitSha"),
          Number(opt.required("timeout"))
        )
      ),
    delete: (opt: StrongParams) =>
      deleteDbMigrateJob(opt.required("env"), opt.required("image")),
  },
  version: {
    get: (opt: StrongParams) =>
      awaitAndPrint(
        getImageVersion(opt.required("env"), opt.required("image"))
      ),
    set: (opt: StrongParams) =>
      setImageVersion(
        opt.required("env"),
        opt.required("image"),
        opt.required("gitSha")
      ),
    unset: (opt: StrongParams) =>
      deleteImageVersion(opt.required("env"), opt.required("image")),
  },
};

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);
  const { args, options } = cmdObj.parseOptions({
    params: ["--timeout"],
    booleans: [],
  });

  const [subCommand, entity, image, gitSha] = args;
  const timeout = Number(options["--timeout"]) || 240;
  const strongParams = new StrongParams(usage, {
    env: cmdObj.env,
    image,
    gitSha,
    timeout: timeout.toString(),
  });
  // @ts-expect-error left as an exercise for the reader
  const configEntry = config[entity]?.[subCommand];
  if (!configEntry) printUsageAndExit(usage);
  await configEntry(strongParams);
}

export default {
  k8s: { oneLiner, keyExamples, run },
};
