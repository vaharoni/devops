import { InternalToken } from "../app-support/crypto";
import { CLICommandParser, printUsageAndExit } from "./common";

const oneLiner =
  "Returns a JWT-like token to allow verifying internal communication within the namespace";
const keyExamples = `$ devops jwt jobs`;

const usage = `
${oneLiner}

GENERAL USAGE
    devops jwt <subject>

NOTE
    The token is valid for 60 seconds and bears the specified subject.
    --env should not be used with this command. It is expected to be run inside pods in the namespace.
    Relies on the MONOREPO_BASE_SECRET environment variable for signing the token.

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0 || cmdObj.envForced) printUsageAndExit(usage);
  const subject = cmdObj.args[0];

  console.log(new InternalToken(subject).generate());
}

export default {
  jwt: { oneLiner, keyExamples, run },
};
