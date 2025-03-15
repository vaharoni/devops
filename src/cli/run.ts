import { getWorkspace } from "../libs/workspace-discovery";
import { CLICommandParser, printUsageAndExit } from "./common";

const oneLiner =
  "Runs a script defined in package.json after injecting env variables";
const keyExamples = `$ ./devops run project:test`;

const usage = `
${oneLiner}

GENERAL USAGE
    ./devops run <project-name>:<script-name> [--] [options for script]

NOTE
    Does not allow interactive mode. If you need interactivity, use ./devops exec instead.

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
      `.devops/cli/exec.sh ${rootPath} bun run ${script} ${remaining}`,
      { checkEnvYaml: true }
    )
    .spawn();
}

export default {
  run: { oneLiner, keyExamples, run },
};
