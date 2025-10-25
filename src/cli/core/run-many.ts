import { workspaceDirectoryForLanguage } from "../../libs/discovery";
import { CLICommandParser, printUsageAndExit } from "../common";
import concurrently, {
  type ConcurrentlyCommandInput,
  type ConcurrentlyOptions,
} from "concurrently";

const oneLiner =
  "Runs a script concurrently in all projects that define it in their package.json";
const keyExamples = `
    $ devops run-many build
`.trim();

const usage = `
${oneLiner}

USAGE
    devops run-many <script-name> [--kill-others-on-fail]

NOTE
    Only works for node projects. Use 'devopspy' for python projects.

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const parsed = cmdObj.parseOptions({ booleans: ["--kill-others-on-fail"] });
  const [script] = parsed.args;
  const remaining = parsed.args.slice(1).join(" ");
  const commands: ConcurrentlyCommandInput[] = [];

  Object.values(workspaceDirectoryForLanguage('node')).forEach(async (packageData) => {
    if (packageData.scripts?.[script]) {
      commands.push({
        name: packageData.name,
        command: `devops --env ${cmdObj.env} run ${packageData.name}:${script} ${remaining}`,
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

export const runMany = { command: 'run-many', oneLiner, keyExamples, run };
