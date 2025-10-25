import { CLICommandParser, CommandExecutor, printUsageAndExit } from "../common";
import url from "url";
import path from "path";
import { getWorkspace } from "../../libs/discovery";

const __file__ = url.fileURLToPath(import.meta.url);
const __cli__ = path.join(path.dirname(__file__), "../..", "cli");
const execShPath = path.join(__cli__, "exec.sh");

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
    executor = cmdObj.executorFromEnv(
      `${execShPath} ${rootPath} ${parsed.argsStr}`,
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

export const exec = { oneLiner, keyExamples, run };
