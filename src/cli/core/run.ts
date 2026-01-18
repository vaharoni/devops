import { CLICommandParser, printUsageAndExit } from "../common";
import path from "path";
import { getWorkspace } from "../../libs/discovery";
import { pkgRoot } from "../../pkg-root";

const execShPath = path.join(pkgRoot, "cli/exec.sh");

const oneLiner =
  "Runs a script defined in package.json after injecting env variables";
const keyExamples = `$ devops run project:test`;

const usage = `
${oneLiner}

GENERAL USAGE
    devops run <project-name>:<script-name> [--] [options for script]

NOTES
    - Only works for node projects. Use 'devopspy' for python projects.
    - Does not allow interactive mode. If you need interactivity, use devops exec instead.

EXAMPLES
    ${keyExamples}
`;

async function runFn(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const [workspace, script] = cmdObj.args[0].split(":");
  if (!workspace || !script) printUsageAndExit(usage);

  const rootPath = getWorkspace(workspace).rootPath;
  const remaining = cmdObj.args.slice(1).join(" ");

  cmdObj
    .executorFromEnv(
      `${execShPath} ${rootPath} bun run ${script} ${remaining}`,
      { checkEnvYaml: true }
    )
    .spawn();
}

export const run = { oneLiner, keyExamples, run: runFn };
