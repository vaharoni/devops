import fs from "fs-extra";
import os from "os";
import path from "path";
import _ from "lodash";
import { CLICommandParser, dotEnvFilesForEnv, printUsageAndExit } from "../common";
import { getImageData, getTemplateData } from "../../libs/config";
import { getMonorepoSecretObject } from "../../libs/k8s-secrets-manager";
import { getImageDescendentData } from "../../libs/discovery/images";
import { isLocalOrRemoteEnv } from "../../libs/k8s-constants";
import { loadDotEnvFiles, serializeDotEnv } from "../../libs/dotenv";
import { ALWAYS_INJECTED_PREFIX, workspaceEnvRequirements } from "../../libs/env-scope";
import { buildEnvPathFor, ENV_KEYS_FILE } from "../../libs/build-env";
import chalk from "chalk";

const oneLiner =
  "Copies all dependencies of an image to a temporary folder in preparation for a Docker build";
const keyExamples = `
    $ devops prep-build main-node
`.trim();

const usage = `
${oneLiner}

USAGE
    devops prep-build <image> --env <env>

    Prints the path of the build folder to stdout. The env variables needed during the build are written to
    <build-folder>.build-env, outside the build context, so they never end up in an image layer. Pass them to
    docker as a build secret, for example:

      docker build --secret id=env,src=<build-folder>.build-env <build-folder>

    The Dockerfile then mounts them where devops expects them:

      RUN --mount=type=secret,id=env,target=/app/config/.env.global,required=true ./devops run-many build

    If <env> is a remote environment (e.g. staging, production), the environment variables are 
    fetched from the cluster. Only variables declared in the env.yaml files of the image's workspaces are included.

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const [image] = cmdObj.args;
  const imageData = getImageData(image);
  const imageTemplate = imageData["image-template"];
  const dockerFile = `${imageTemplate}.Dockerfile`;
  const dockerFilePath = path.join(".devops/docker-images", dockerFile);
  const dockerImagePayloadPath = path.join(".devops/docker-images", imageTemplate);
  const dockerCommonPayloadPath = path.join(".devops/docker-images", "common");
  const imageTemplateData = getTemplateData(imageTemplate);
  const copyCommon = imageTemplateData["copy-common"] ?? false;
  const imageExtraContent = imageTemplateData["extra-content"] ?? [];

  if (!fs.existsSync(dockerFilePath)) {
    console.error(`The dockerfile ${dockerFilePath} does not exist`);
    process.exit(1);
  }

  imageExtraContent.forEach((file) => {
    if (!fs.existsSync(file)) {
      console.error(`The file ${file} is specified in the extra-content section of ${image} but does not exist`);
      process.exit(1);
    }
  });

  const destFolder = `${os.tmpdir()}/image-${image}-${Date.now()}`;
  // Avoid clutter stdout, as the caller will want to capture the final output to cd into it
  console.warn(`Creating build in ${destFolder}`);
  fs.mkdirSync(destFolder);

  // Copy Dockerfile
  console.warn(`COPYING Dockerfile`);
  fs.copySync(dockerFilePath, path.join(destFolder, "Dockerfile"));

  if (copyCommon) {
    console.warn(`COPYING Docker common`);
    fs.copySync(dockerCommonPayloadPath, destFolder);
  }

  if (fs.existsSync(dockerImagePayloadPath)) {
    console.warn(`COPYING Docker image payload`);
    fs.copySync(dockerImagePayloadPath, destFolder);
  }

  console.warn(`COPYING .devops/config`);
  fs.mkdirSync(path.join(destFolder, ".devops"));
  fs.copySync(".devops/config", path.join(destFolder, ".devops/config"));

  // Map each workspace in the image to the env variables it needs, so pods can be given only those (see materialize_env)
  const imageWorkspaces = getImageDescendentData(image);
  const envKeys = Object.fromEntries(
    imageWorkspaces.map((project) => [
      project.name,
      Object.keys(workspaceEnvRequirements(project.name, project.language)).sort(),
    ])
  );
  console.warn(`CREATING ${ENV_KEYS_FILE}`);
  fs.writeJSONSync(path.join(destFolder, ENV_KEYS_FILE), envKeys, { spaces: 2 });

  // The build env is written outside the build context and passed to docker as a build secret
  const buildEnvPath = buildEnvPathFor(destFolder);
  console.warn(`CREATING ${buildEnvPath} for the build process`);
  const allEnv = loadBuildEnv(cmdObj.env);
  const imageEnvKeys = new Set(Object.values(envKeys).flat());
  const buildEnv = _.pickBy(allEnv, (_value, key) => imageEnvKeys.has(key) || key.startsWith(ALWAYS_INJECTED_PREFIX));
  fs.writeFileSync(buildEnvPath, serializeDotEnv(buildEnv), { mode: 0o600 });

  // Copy all dependencies
  imageWorkspaces.forEach((project) => {
    console.warn(`COPYING ${project.rootPath}`);
    if (project.rootPath === ".devops") return;
    fs.copySync(project.rootPath, path.join(destFolder, project.rootPath));
  });

  // Copy image-extra content
  console.warn(`COPYING files from image-extra-content`);
  imageExtraContent.forEach((file) => {
    fs.copySync(file, path.join(destFolder, file));
    console.warn(`  ${file}`);
  });

  console.log(destFolder);
}

function loadBuildEnv(monorepoEnv: string): Record<string, string> {
  if (isLocalOrRemoteEnv(monorepoEnv) === "remote") {
    return _.mapValues(getMonorepoSecretObject(monorepoEnv), (value) => String(value));
  }
  const envFiles = dotEnvFilesForEnv(monorepoEnv);
  if (envFiles.length === 0) {
    console.warn(chalk.red(`\nWarning: local environment ${monorepoEnv} has no .env files. Environment variables will not be injected.\n`));
  }
  return loadDotEnvFiles(envFiles);
}

export const prepBuild = { command: 'prep-build', oneLiner, keyExamples, run };
