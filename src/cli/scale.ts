import {
  resetWorkspaceScale,
  getWorkspaceScale,
  setWorkspaceScale,
} from "../libs/k8s-lifecycle";
import { CLICommandParser, printUsageAndExit, StrongParams } from "./common";

const oneLiner = "Scales a deployment to the specified number of replicas";
const keyExamples = `$ devops scale set node-services www 3 --env production`;

const usage = `
${oneLiner}

GENERAL USAGE
    devops scale set <image-name> <workspace-name> <replica-count>
    devops scale get <image-name> [<workspace-name>]
    devops scale reset <image-name> [<workspace-name>]

NOTE
    Performing 'set' stores the scale count in the image config map so that it persists across deployments.
    Both 'set' and 'reset' return the previous scale count prior to the operation.

EXAMPLES
    ${keyExamples}
`;

const handlers = {
  set: (opts: StrongParams) => {
    const workspace = opts.required("workspace");
    const image = opts.required("image");
    const replicas = Number(opts.required("replicas"));
    const res = setWorkspaceScale(
      opts.required("env"),
      image,
      workspace,
      replicas
    );
    console.warn(
      `Scale for ${workspace} in ${image} set to ${replicas}. Previous value:`
    );
    console.log(res);
  },
  get: (opts: StrongParams) => {
    const scale = getWorkspaceScale(
      opts.required("env"),
      opts.required("image"),
      opts.optional("workspace")
    );
    console.log(scale);
  },
  reset: (opts: StrongParams) => {
    const image = opts.required("image");
    const workspace = opts.optional("workspace");

    const prev = resetWorkspaceScale(opts.required("env"), image, workspace);
    if (workspace) {
      console.warn(`Scale for ${workspace} in ${image} reset. Previous scale:`);
      console.log(prev);
    } else {
      console.warn(
        `Scale for all workspaces in ${image} reset. Previous scale:`
      );
      console.log(prev);
    }
  },
};

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);

  const [command, image, workspace, replicas] = cmdObj.args;
  // @ts-expect-error left as an exercise for the reader
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printUsageAndExit(usage);
  }
  const params = new StrongParams(usage, {
    env: cmdObj.env,
    image,
    workspace,
    replicas,
  });
  handler(params);
}

export default {
  scale: { oneLiner, keyExamples, run },
};
