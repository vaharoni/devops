import { CLICommandParser, printUsageAndExit } from "./common";
import { getWorkspace, workspaceNames } from "../libs/workspace-discovery";
import concurrently, {
  type ConcurrentlyCommandInput,
  type ConcurrentlyOptions,
} from "concurrently";

const oneLiner =
  "Runs a script concurrently in all projects that define it in their package.json";
const keyExamples = `
    $ ./devops run-many build
`.trim();

const usage = `
${oneLiner}

USAGE
    ./devops run-many <script-name> [--kill-others-on-fail]

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const parsed = cmdObj.parseOptions({ booleans: ["--kill-others-on-fail"] });
  const [script] = parsed.args;
  const remaining = parsed.args.slice(1).join(" ");
  const commands: ConcurrentlyCommandInput[] = [];

  workspaceNames().forEach(async (workspace) => {
    const projectData = getWorkspace(workspace);
    if (projectData.data.scripts?.[script]) {
      commands.push({
        name: workspace,
        command: `./devops --env ${cmdObj.env} run ${workspace}:${script} ${remaining}`,
      });
    }
  });

  if (!commands.length) {
    console.error(`No workspaces define the script: ${script}`);
    process.exit(0);
  }

  // prettier-ignore
  const options: Partial<ConcurrentlyOptions> = parsed.options["--kill-others-on-fail"] ? { killOthers: "failure" } : {};

  concurrently(commands, options)
    .result.then(() => {})
    .catch((error) => {
      console.error("One of the commands failed");
      process.exit(1);
    });
}

export default {
  "run-many": { oneLiner, keyExamples, run },
};
