import {
} from "../../libs/k8s-image-config";
import { CLICommandParser, printUsageAndExit, StrongParams } from "../common";
import { generateDbMigrateJob, generateDebugPod, generateWorkspaceDeployment, ImageContextGenerator } from "../../libs/k8s-generate";
import chalk from "chalk";
import { getWorkspace } from "../../libs/discovery";
import { getWorkspaceImages } from "../../libs/discovery/images";
import { getImageData, getImageNames } from "../../libs/config";

const SUPPORTED_CONTEXT_TYPES = ['deployment', 'db-migrate', 'debug'];

const oneLiner = "Utilities to help validate manifest templates rendering.";
const keyExamples = `
    $ devops template context deployment www
    $ devops template context debug
    $ devops template context db-migrate
    $ devops template gen     deployment www
    $ devops template gen     debug      main-node
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

GENERATE TEMPLATES
    devops template gen deployment <workspace>
    devops template gen debug <image>
    devops template gen db-migrate-job

    For deployment, generates an example manifest of a workspace, including override files present under the 'manifests' folder.

EXAMPLES
    ${keyExamples}
`;

const handlers = {
  context: {
    'deployment': (opts: StrongParams) => {
      const workspace = opts.required('workspaceOrImage');
      const workspaceData = getWorkspace(workspace);
      const packageDataWithDeployment = workspaceData.packageDataEntries.find((entry) => entry.deployment);
      if (!packageDataWithDeployment) {
        console.error(`No deployment found for workspace ${workspace}`);
        process.exit(1);
      }
      const randomImage = getWorkspaceImages(workspace)[0];
      console.warn(chalk.green("\nThis is a sample context object used to render a manifest template of type deployment:\n"))
      console.log(
        JSON.stringify(
          new ImageContextGenerator(opts.required('env'), randomImage, 'dummy-sha').getDeployment(packageDataWithDeployment),
          null,
          2
        )
      )
    },
    'db-migrate': (opts: StrongParams) => {
      const randomImage = getWorkspaceImages('db').filter(image => getImageData(image)['can-db-migrate'])[0];
      if (!randomImage) {
        console.error("No image found with can-db-migrate=true in the db workspace.");
        process.exit(1);
      }
      console.warn(chalk.green("\nThis is a sample context object used to render a manifest template of type db-migrate:\n"))
      console.log(
        JSON.stringify(
          new ImageContextGenerator(opts.required('env'), randomImage, 'dummy-sha').getDbMigrate(),
          null,
          2
        )
      )
    },
    'debug': (opts: StrongParams) => {
      const randomImage = getImageNames()[0];
      console.warn(chalk.green("\nThis is a sample context object used to render a manifest template of type debug:\n"))
      console.log(
        JSON.stringify(
          new ImageContextGenerator(opts.required('env'), randomImage, 'dummy-sha').getDebug(),
          null,
          2
        )
      )
    },
  },
  gen: {
    'deployment': (opts: StrongParams) => {
      const workspace = opts.required('workspaceOrImage');
      const workspaceData = getWorkspace(workspace);
      const packageDataWithDeployment = workspaceData.packageDataEntries.find((entry) => entry.deployment);
      if (!packageDataWithDeployment) {
        console.error(`No deployment found for workspace ${workspace}`);
        process.exit(1);
      }
      const randomImage = getWorkspaceImages(workspace)[0];
      console.warn(chalk.green(`\nThis is a sample of generated manifests for the ${workspace} workspace:\n`))
      console.log(
        generateWorkspaceDeployment(
          packageDataWithDeployment,
          opts.required('env'),
          randomImage,
          'dummy-sha'
        )
      )
    },
    'db-migrate': (opts: StrongParams) => {
      const randomImage = getWorkspaceImages('db').filter(image => getImageData(image)['can-db-migrate'])[0];
      if (!randomImage) {
        console.error("No image found with can-db-migrate=true in the db workspace.");
        process.exit(1);
      }
      console.warn(chalk.green("\nThis is a sample of generated manifests for the db-migrate job:\n"))
      console.log(
        generateDbMigrateJob(
          opts.required('env'),
          randomImage,
          'dummy-sha'
        )
      )
    },
    'debug': (opts: StrongParams) => {
      const image = opts.required('workspaceOrImage');
      console.warn(chalk.green(`\nThis is a sample of generated manifests for the debug image ${image}:\n`))
      console.log(
        generateDebugPod(
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
    workspaceOrImage: param
  });
  handler(params);
}

export const template = { oneLiner, keyExamples, run };
