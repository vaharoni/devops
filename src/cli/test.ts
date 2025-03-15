import { CLICommandParser, CommandExecutor, printUsageAndExit } from "./common";

const oneLiner = "Runs tests in all projects or one specific project";
const keyExamples = `
$ devops test
$ devops test project
`;

const usage = `
${oneLiner}

USAGE
  ${keyExamples}
`;

function run(cmdObj: CLICommandParser) {
  const options = cmdObj.parseOptions({ params: ["--in"] });
  if (cmdObj.help || options.args.length > 1) printUsageAndExit(usage);
  const workspace = options.args[0];
  const env = cmdObj.envForced ? cmdObj.env : "test";
  if (workspace) {
    new CommandExecutor(`bunx nx run ${workspace}:test`, {
      env,
      checkEnvYaml: true,
    }).spawn();
  } else {
    new CommandExecutor("bunx nx run-many -t test", {
      env,
      checkEnvYaml: true,
    }).spawn();
  }
}

export default {
  test: { oneLiner, keyExamples, run },
};
