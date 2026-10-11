import { CLICommandParser, CommandExecutor, printUsageAndExit } from "../common";
import { getWorkspace } from "../../libs/discovery";

const oneLiner =
  "Executes a command after injecting env variables, either globally or in a workspace";
const keyExamples = `
    $ devops exec tmp/test.sh
    $ devops exec bun test.ts --in myworkspace --env staging
`.trim();

const usage = `
${oneLiner}

USAGE
    devops exec <command>
    devops exec --in <workspace> <command>
    devops exec --in <workspace> <command> --interactive

    With --in, only env variables declared in the env.yaml files of the workspace and its dependencies are injected.
    Without it, all env variables are injected.

EXAMPLES
    ${keyExamples}
`;

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const parsed = cmdObj.parseOptions({
    params: ["--in"],
    booleans: ["--interactive"],
  });
  const workspace = parsed.options["--in"];
  let executor: CommandExecutor;
  if (workspace) {
    const rootPath = getWorkspace(workspace).rootPath;
    executor = cmdObj.executorFromEnv(parsed.argsStr, {
      checkEnvYaml: true,
      envScope: workspace,
      cwd: rootPath,
    });
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

export const exec = { oneLiner, keyExamples, run };
