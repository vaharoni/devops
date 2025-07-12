import { getConst, getImageData } from "../libs/config";
import { prune } from "../libs/digital-ocean/container-reg";
import {
  containerRegistryPath,
  containerRegistryImageName,
  containerRegistryRepoPath,
} from "../libs/k8s-constants";
import { CLICommandParser, StrongParams, printUsageAndExit } from "./common";

const oneLiner = "Manage container repositories";
const keyExamples = `
    $ devops registry server-url
    $ devops registry reg-url
    $ devops registry repo-url my-image sha
    $ devops registry prune    my-image
`.trim();

const usage = `
${oneLiner}

USAGE
  Get base URLs
      devops registry server-url
      devops registry reg-url

  Gets the URL of an image in the container registry:
    devops registry repo-url <image> <sha> --env <env>

  Prunes the repository of old images to enforce the "image-versions-to-keep" constant in config/constants.yaml:
    devops registry prune <image> --env <env>

    This is only relevant when the "infra" constant is set to "digitalocean".

EXAMPLES
    ${keyExamples}
`;

const handlers = {
  "server-url": () => console.log(getConst("registry-base-url")),
  "reg-url": () => console.log(containerRegistryPath()),
  "repo-url": (opts: StrongParams) => {
    console.log(
      containerRegistryRepoPath(
        opts.required("image"),
        opts.required("env"),
        opts.required("sha")
      )
    );
  },
  prune: (opts: StrongParams) => {
    const regName = containerRegistryPath();
    const repoName = containerRegistryImageName(
      opts.required("image"),
      opts.required("env")
    );
    prune(regName, repoName);
  },
};

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);

  const [command, image, sha] = cmdObj.args;
  // @ts-expect-error left as an exercise for the reader
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printUsageAndExit(usage);
  }
  const params = new StrongParams(usage, { image, env: cmdObj.env, sha });
  handler(params);
}

export default {
  registry: { oneLiner, keyExamples, run },
};
