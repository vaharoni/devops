import { generateDebugPod } from "../../libs/k8s-generate";
import { kubectlCommand } from "../../libs/k8s-helpers";
import { getImageVersion } from "../../libs/k8s-image-config";
import { CLICommandParser, CommandExecutor, printUsageAndExit } from "../common";
import yaml from "yaml";

const oneLiner = "Spin up a debug pod of the specified image and get a shell into it.";
const keyExamples = `
$ devops console main-node
`.trim();

const usage = `
${oneLiner}

USAGE
    devops console <image> [--version <version>]

    Options:
      --version <version>    The version (git SHA) of the image to use. 
                             If not specified, the live version of the image (obtained using 'devops image version get <image>') is used.

EXAMPLES
  ${keyExamples}
`;

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const parsed = cmdObj.parseOptions({ params: ["--version"] });
  if (parsed.args.length !== 1) printUsageAndExit(usage);
  const image = parsed.args[0];
  const version = parsed.options["--version"];

  const gitSha = version ?? getImageVersion(cmdObj.env, image);
  if (!gitSha) {
    console.error(`No git SHA found for image ${image} in environment ${cmdObj.env}`);
    process.exit(1);
  }
  const debugYaml = generateDebugPod(cmdObj.env, image, gitSha);
  if (!debugYaml) {
    console.error(`The image ${image} does not specify debug-template in images.yaml`);
    process.exit(1);
  }

  const userName = new CommandExecutor(`kubectl auth whoami -o jsonpath='{.status.userInfo.username}'`).exec();

  const debugManifestsJson = JSON.stringify(yaml.parse(debugYaml));
  const randomId = Math.random().toString(36).substring(2, 10);
  const podName = ['ephemeral-console', slugify(userName), slugify(image), randomId].filter(Boolean).join('-');

  new CommandExecutor(kubectlCommand(
    `run ${podName} --restart=Never --rm -it --image=overridden --overrides='${debugManifestsJson}'`, { monorepoEnv: cmdObj.env })
  ).spawn();
}

function slugify(str: string, maxLength = 20) {
  return str.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, maxLength);
}

export const consoleCommand = { command: 'console', oneLiner, keyExamples, run };
