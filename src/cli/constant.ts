import { getConst, type AvailableConstKeys } from "../libs/config";
import { CLICommandParser, printUsageAndExit } from "./common";

const oneLiner = "Prints to stdout a constant from constant.yaml";
const keyExamples = `$ devops constant infra`;

const usage = `
${oneLiner}

GENERAL USAGE
    devops constant <constant-name>

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const [constant] = cmdObj.args;
  console.log(getConst(constant as AvailableConstKeys));
}

export default {
  constant: { oneLiner, keyExamples, run },
};
