import { getWorkspace } from "../libs/workspace-discovery";
import { CLICommandParser, CommandExecutor, printUsageAndExit } from "./common";

const oneLiner =
  "Executes a command after injecting env variables, either globally or in a workspace";
const keyExamples = `
    $ ./devops exec tmp/test.sh
    $ ./devops exec bun test.ts --in myworkspace --env staging
`.trim();

const usage = `
${oneLiner}

USAGE
    ./devops exec <command>
    ./devops exec --in <workspace> <command>
    ./devops exec --in <workspace> <command> --interactive

EXAMPLES
    ${keyExamples}
`;

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const parsed = cmdObj.parseOptions({
    params: ["--in"],
    booleans: ["--interactive"],
  });
  const workspace = parsed.options["--in"] as string | undefined;
  let executor: CommandExecutor;
  if (workspace) {
    const rootPath = getWorkspace(workspace).rootPath;
    executor = cmdObj.executorFromEnv(
      `.devops/cli/exec.sh ${rootPath} ${parsed.argsStr}`,
      { checkEnvYaml: true }
    );
  } else {
    executor = cmdObj.executorFromEnv(parsed.argsStr, { checkEnvYaml: true });
  }

  const interactive = Boolean(parsed.options["--interactive"]);
  if (interactive) {
    executor.spawn();
  } else {
    executor.exec();
  }
}

export default {
  exec: { oneLiner, keyExamples, run },
};
