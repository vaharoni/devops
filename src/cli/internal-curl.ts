import { InternalToken } from "../app-support/crypto";
import { CLICommandParser, printUsageAndExit } from "./common";

const oneLiner =
  "Runs a curl command bearing an internal jwt-like token to allow verifying internal communication within the namespace";
const keyExamples = `$ devops internal-curl jobs http://service-name:port/path`;

const usage = `
${oneLiner}

GENERAL USAGE
    devops internal-curl <subject> [curl-options] <url>

NOTE
    --env should not be used with this command. It is expected to be run inside pods in the namespace.
    Relies on the MONOREPO_BASE_SECRET environment variable for signing the token.
    
    'subject' is the subject of the token. Receiving endpoints should verify it matches the expected value using the 
    'InternalToken' class exposed by @vaharoni/devops.

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0 || cmdObj.envForced) printUsageAndExit(usage);
  const [subject, ...rest] = cmdObj.args;

  // A trick to allow running this command locally while setting the MONOREPO_BASE_SECRET in .env.global.
  // Basically we have to inject the env variables into the shell, which is why we execute 'devops jwt' first
  let token;
  if (process.env.MONOREPO_BASE_SECRET) {
    token = new InternalToken(subject).generate();
  } else {
    const res = cmdObj.executorFromEnv(`devops jwt ${subject}`).exec({ asObject: true });
    if (res.statusCode !== 0) {
      console.error("Failed to generate token. Aborting.");
      process.exit(1);
    }
    token = res.stdout.trim();
  }

  cmdObj.executorFromEnv(`curl -H "Authorization: Bearer ${token}" ${rest.join(" ")}`).exec();
}

export default {
  'internal-curl': { oneLiner, keyExamples, run },
};
