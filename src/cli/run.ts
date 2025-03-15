import { getWorkspace } from "../libs/workspace-discovery";
import { CLICommandParser, printUsageAndExit } from "./common";
import url from "url";
import path from "path";

const __file__ = url.fileURLToPath(import.meta.url);
const __src__ = path.join(path.dirname(__file__), "../..", "src");
const execShPath = path.join(__src__, "cli/exec.sh");

const oneLiner =
  "Runs a script defined in package.json after injecting env variables";
const keyExamples = `$ devops run project:test`;

const usage = `
${oneLiner}

GENERAL USAGE
    devops run <project-name>:<script-name> [--] [options for script]

NOTE
    Does not allow interactive mode. If you need interactivity, use devops exec instead.

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
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

export default {
  run: { oneLiner, keyExamples, run },
};
