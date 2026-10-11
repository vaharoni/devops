import { DEVOPS_VERSION } from "../../version";
import { CLICommandParser, printUsageAndExit } from "../common";

const oneLiner = "Prints the version of devops";
const keyExamples = `$ devops version`;

const usage = `
${oneLiner}

GENERAL USAGE
    devops version

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help) printUsageAndExit(usage);
  console.log(DEVOPS_VERSION);
}

export const version = { oneLiner, keyExamples, run };
