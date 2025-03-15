import chalk from "chalk";
import { getWorkspace, workspaceNames } from "../libs/workspace-discovery";
import { CLICommandParser, printUsageAndExit } from "./common";

const oneLiner = "Runs verify in all projects or one specific project";
const keyExamples = `
    $ ./devops verify
    $ ./devops verify project
`.trim();

const usage = `
${oneLiner}

USAGE
    ./devops verify [workspace]

EXAMPLES
    ${keyExamples}
`;

function run(cmdObj: CLICommandParser) {
  // Validate the command arguments
  if (cmdObj.help || cmdObj.args.length > 2) printUsageAndExit(usage);

  // Use CLICommandParser to parse options
  const options = cmdObj.parseOptions();
  const workspace = options.args[0] || "";

  // Handle cases where invalid or excessive arguments are passed
  if (options.args.length > 1) {
    printUsageAndExit(usage);
  }

  console.log(chalk.green("\nRunning verify...\n"));

  const workspaces = workspace ? [workspace] : workspaceNames();

  workspaces.forEach(async (workspaceName) => {
    const { data, rootPath } = getWorkspace(workspaceName);
    const scripts = data.scripts ?? {};
    if ("verify" in scripts) {
      console.log(chalk.blue(`\nRunning verify in ${workspaceName}\n`));
      await cmdObj
        .executorFromEnv(`.devops/cli/exec.sh ${rootPath} bun run verify`, {
          checkEnvYaml: false,
        })
        .spawn();
    }
  });
}

export default {
  verify: { oneLiner, keyExamples, run },
};
