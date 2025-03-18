import { getConst } from "../libs/config";
import {
  envToNamespace,
  imageDebugName,
} from "../libs/k8s-constants";
import { kubectlCommand } from "../libs/k8s-helpers";
import { CLICommandParser, printUsageAndExit } from "./common";

const oneLiner = "Get a shell into the debug pod of an image";
const keyExamples = `
$ devops console node-services
`.trim();

const usage = `
${oneLiner}

Each image has a debug pod. This command gets a shell into the debug pod of the specified image.

EXAMPLES
  ${keyExamples}
`;

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const image = cmdObj.args[0];
  const debugName = imageDebugName(image);
  const namespace = envToNamespace(cmdObj.env);
  const podName = cmdObj
    .executorFromEnv(
      kubectlCommand(`get pod -n ${namespace} -l app=${debugName} -o name`, {
        namespace,
      }),
      { quiet: true }
    )
    .exec()
    .trim();
  cmdObj
    .executorFromEnv(
      kubectlCommand(`exec -it ${podName} -- /bin/bash`, { namespace })
    )
    .spawn();
}

export default {
  console: { oneLiner, keyExamples, run },
};
