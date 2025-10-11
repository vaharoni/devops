import { CLICommandParser, printUsageAndExit, StrongParams } from "./common";
import { buildDev, deploy } from "../libs/cloudrun-helpers";

const oneLiner =
  "Supports cloudrun images";
const keyExamples = `
    $ devops cloudrun deploy cloudrun-image SHA --env staging --region us-east1 [--forward-env ENV1,ENV2 --allow-unauthenticated]
    $ devops cloudrun build-dev cloudrun-image
`.trim();

const usage = `
${oneLiner}

USAGE
  Configuration prerequisites:
    - The image should be defined in images.yaml with:
      cloudrun: true
    - The artifact registry URL should be set in config/constants.yaml:
      cloudrun-artifact-registry-repo-path: REGION-docker.pkg.dev/PROJECT_ID/REPO

  Deploy a cloudrun image to Cloud Run:
    devops cloudrun deploy <image> <sha> --env <env> --region <region> [options]

    Options:
      --forward-env ENV1,ENV2     Comma-separated env var names to forward into the service
      --allow-unauthenticated     Allow unauthenticated access
      --cpu <cpu>                 CPU, e.g. 0.25, 0.5, 1
      --memory <mem>              Memory, e.g. 256Mi, 512Mi, 1Gi
      --min-instances <n>         Minimum instances
      --max-instances <n>         Maximum instances
      --timeout <time>            Request timeout, e.g. 60s
      --                          Pass through additional args to gcloud (e.g. -- --ingress internal)

      Notes: 
      - The image must already be pushed to the artifact registry.
      - <env> also supports local environments (e.g. development).
      - For remote monorepo environments, variables specified in --forward-env that 
        are not present in the current process's env are fetched from the cluster.

  Build a cloudrun image locally in development environment:
    devops cloudrun build-dev cloudrun-image

    This command builds the image locally with a random SHA and pushes it to the artifact registry.

EXAMPLES
    ${keyExamples}
`;

const handlers = {
  "build-dev": (opts: StrongParams) => {
    buildDev(opts.required("image"));
  },
  _deploy: (opts: StrongParams) => {
    const rawForwardEnv = opts.optional("forwardEnv");
    const forwardEnv = rawForwardEnv
      ? rawForwardEnv.split(",").map(v => v.trim()).filter(Boolean)
      : [];
    const minInstancesStr = opts.optional("minInstances");
    const maxInstancesStr = opts.optional("maxInstances");

    deploy({
      image: opts.required("image"),
      env: opts.required("env"),
      sha: opts.required("sha"),
      region: opts.required("region"),
      forwardEnv,
      allowUnauthenticated: opts.optional("allowUnauthenticated") === "true",
      cpu: opts.optional("cpu"),
      memory: opts.optional("memory"),
      minInstances: minInstancesStr ? Number(minInstancesStr) : undefined,
      maxInstances: maxInstancesStr ? Number(maxInstancesStr) : undefined,
      timeout: opts.optional("timeout"),
      extraArgs: opts.optional("extraArgs"),
    });
  },
} as const;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const parsed = cmdObj.parseOptions({
    params: [
      "--keep-last",
      "--forward-env",
      "--region",
      "--cpu",
      "--memory",
      "--min-instances",
      "--max-instances",
      "--timeout",
      "--sha",
    ],
    booleans: ["--allow-unauthenticated"],
    passthroughArgs: true,
  });
  const [subcommand, image, sha] = parsed.args;

  // Inject env variables as forwarding is needed
  if (subcommand === "deploy") {
    cmdObj.executorFromEnv(
      `devops cloudrun _deploy ${cmdObj.args.slice(1).join(" ")}`,
      { checkEnvYaml: false }
    ).spawn();
    return;
  }

  const handler = handlers[subcommand as keyof typeof handlers];
  if (!handler) {
    console.error(`Unknown subcommand: ${subcommand}`);
    printUsageAndExit(usage);
  }

  const params = new StrongParams(usage, {
    env: cmdObj.env,
    subcommand,
    image,
    sha,
    keepLast: parsed.options["--keep-last"],
    forwardEnv: parsed.options["--forward-env"],
    region: parsed.options["--region"],
    allowUnauthenticated: parsed.options["--allow-unauthenticated"] ? "true" : undefined,
    cpu: parsed.options["--cpu"],
    memory: parsed.options["--memory"],
    minInstances: parsed.options["--min-instances"],
    maxInstances: parsed.options["--max-instances"],
    timeout: parsed.options["--timeout"],
    extraArgs: parsed.passthrough ? parsed.passthrough.join(" ") : undefined,
  });
  handler(params);
}

export default {
  cloudrun: { oneLiner, keyExamples, run },
};
