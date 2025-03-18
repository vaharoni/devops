import {
} from "../libs/k8s-image-config";
import { CLICommandParser, printUsageAndExit, StrongParams } from "../../src/cli/common";
import { generateDbMigrateJob, generateDebugDeployment, generateWorkspaceDeployment, ImageContextGenerator } from "../libs/k8s-generate";
import { getWorkspace, getWorkspaceImages } from "../libs/workspace-discovery";
import chalk from "chalk";

const SUPPORTED_CONTEXT_TYPES = ['deployment', 'db-migrate', 'debug'];

const oneLiner = "Utilities to help validate manifest templates rendering.";
const keyExamples = `
    $ devops template context deployment www
    $ devops template context debug
    $ devops template context db-migrate
    $ devops template gen     deployment www
    $ devops template gen     debug      www
    $ devops template gen     db-migrate
`.trim();

const usage = `
${oneLiner}

IMPORTANT
    This command generates examples only. It's intended to help design new templates by showing what context variables are available
    and how they get rendered using handlebar replacement. They should not be used to apply changes to the cluster.

SHOW CONTEXT OBJECT
    devops template context deployment <workspace>
    devops template context db-migrate-job|debug

    Prints out a context object with dummy values for the specified template type.
    For deployment, the workspace name is required.

GENERATE DEPLOYMENT TEMPLATE
    devops template gen deployment|debug <workspace>

    For deployment, generates an example manifest of a workspace, including override files present under the 'manifests' folder.
    For debug, generates a debug deployment manifest for the debug image configured for the workspace.

GENERATE OTHER TEMPLATES
    devops template gen db-migrate-job

    Generates an example manifest file for the db migrate job.

EXAMPLES
    ${keyExamples}
`;

const handlers = {
  context: {
    'deployment': (opts: StrongParams) => {
      const workspaceData = getWorkspace(opts.required('workspace'))
      console.warn(chalk.green("\nThis is a sample context object used to render a manifest template of type deployment:\n"))
      console.log(
        JSON.stringify(
          new ImageContextGenerator(opts.required('env'), 'dummy-image', 'dummy-sha').getDeployment(workspaceData.data),
          null,
          2
        )
      )
    },
    'db-migrate': (opts: StrongParams) => {
      console.warn(chalk.green("\nThis is a sample context object used to render a manifest template of type db-migrate:\n"))
      console.log(
        JSON.stringify(
          new ImageContextGenerator(opts.required('env'), 'dummy-image', 'dummy-sha').getDbMigrate(),
          null,
          2
        )
      )
    },
    'debug': (opts: StrongParams) => {
      console.warn(chalk.green("\nThis is a sample context object used to render a manifest template of type debug:\n"))
      console.log(
        JSON.stringify(
          new ImageContextGenerator(opts.required('env'), 'dummy-image', 'dummy-sha').getDebug(),
          null,
          2
        )
      )
    },
  },
  gen: {
    'deployment': (opts: StrongParams) => {
      const workspace = opts.required('workspace');
      const projectData = getWorkspace(workspace);
      console.warn(chalk.green(`\nThis is a sample of generated manifests for the ${workspace} workspace:\n`))
      console.log(
        generateWorkspaceDeployment(
          projectData,
          opts.required('env'),
          'dummy-image',
          'dummy-sha'
        )
      )
    },
    'db-migrate': (opts: StrongParams) => {
      console.warn(chalk.green("\nThis is a sample of generated manifests for the db-migrate job:\n"))
      console.log(
        generateDbMigrateJob(
          opts.required('env'),
          'dummy-image',
          'dummy-sha'
        )
      )
    },
    'debug': (opts: StrongParams) => {
      const workspace = opts.required('workspace');
      const image = getWorkspaceImages(workspace)[0];
      console.warn(chalk.green(`\nThis is a sample of generated manifests for the debug image ${image} of the ${workspace} workspace:\n`))
      console.log(
        generateDebugDeployment(
          opts.required('env'),
          image,
          'dummy-sha'
        )
      )
    },
  },
};

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);

  const [command, contextType, param] = cmdObj.args;
  const commandHandler = handlers[command as keyof typeof handlers];
  if (!commandHandler) {
    console.error(`Unknown command: ${command}`);
    printUsageAndExit(usage);
  }

  if (!SUPPORTED_CONTEXT_TYPES.includes(contextType)) {
    console.error(`Unknown context type: ${contextType}. Supported types: ${SUPPORTED_CONTEXT_TYPES.join(', ')}`);
    process.exit(1);
  }
  const handler = commandHandler[contextType as keyof typeof commandHandler];

  const params = new StrongParams(usage, {
    env: cmdObj.env === 'development' ? 'staging' : cmdObj.env,
    contextType,
    workspace: param
  });
  handler(params);
}

export default {
  template: { oneLiner, keyExamples, run },
};
