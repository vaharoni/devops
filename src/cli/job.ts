import {
} from "../libs/k8s-image-config";
import { CLICommandParser, printUsageAndExit, StrongParams } from "../../src/cli/common";
import { generateDbMigrateJob } from "../libs/k8s-generate";
import { applyHandler } from "../libs/k8s-helpers";
import { k8sJobWaiter, printJobStatuses } from "../libs/k8s-job-waiter";
import { dbMigrateJobName } from "../libs/k8s-constants";

const oneLiner = "Creates a k8s job and waits for it to run";
const keyExamples = `
    $ devops job db-migrate gen    node-services <sha> --env staging
    $ devops job db-migrate create node-services <sha> --env staging --timeout 120
`.trim();

const usage = `
${oneLiner}

GENERAL USAGE
    devops job db-migrate gen    <image> <sha>
    devops job db-migrate create <image> <sha> --timeout <timeout>

EXAMPLES
    ${keyExamples}
`;

const handlers = {
  gen: (opts: StrongParams) => {
    console.log(
      generateDbMigrateJob(opts.required("env"), opts.required("image"), opts.required("sha"))
    )
  },
  create: async (opts: StrongParams) => {
    const env = opts.required("env");
    const image = opts.required("image");
    const sha = opts.required("sha");
    const timeout = opts.optional("timeout") ?? '240';
    const manifest = generateDbMigrateJob(env, image, sha);
    const jobName = dbMigrateJobName(sha);

    applyHandler(`apply-${jobName}`, 'apply', manifest);
    const statuses = await k8sJobWaiter(env, Number(timeout ?? '240'), [jobName]);
    if (statuses && Object.keys(statuses).length > 0) {
      printJobStatuses(statuses);
    }
  },
};

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);

  const parsedArgs = cmdObj.parseOptions({
    params: ["--timeout"]
  });

  const [jobName, command, image, sha] = parsedArgs.args;

  if (jobName !== 'db-migrate') {
    console.error(`Unknown job: ${jobName}. Only db-migrate is supported at this time.`);
    process.exit(1)
  }

  const handler = handlers[command as keyof typeof handlers];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printUsageAndExit(usage);
  }

  const timeout = parsedArgs.options["--timeout"] as string | undefined;
  const params = new StrongParams(usage, {
    env: cmdObj.env,
    image,
    sha,
    timeout
  });
  handler(params);
}

export default {
  job: { oneLiner, keyExamples, run },
};
