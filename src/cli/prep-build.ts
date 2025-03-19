import fs from "fs-extra";
import { glob } from "glob";
import os from "os";
import path from "path";
import { CLICommandParser, printUsageAndExit } from "./common";
import { getImageDescendentData } from "../libs/workspace-discovery";
import { getImageData } from "../libs/config";
import { getMonorepoSecret } from "../libs/k8s-secrets-manager";

const oneLiner =
  "Copies all dependencies of an image to a temporary folder in preparation for a Docker build";
const keyExamples = `
    $ devops prep-build node-services
`.trim();

const usage = `
${oneLiner}

USAGE
    devops prep-build <image>

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const [image] = cmdObj.args;
  const imageData = getImageData(image);
  const dockerImageName = imageData["docker-file"];
  const dockerFile = `${dockerImageName}.Dockerfile`;
  const dockerFilePath = path.join(".devops/docker-images", dockerFile);
  const dockerImagePayloadPath = path.join(".devops/docker-images", dockerImageName);
  if (!fs.existsSync(dockerFilePath)) {
    console.error(`The dockerfile ${dockerFilePath} does not exist`);
    process.exit(1);
  }

  const destFolder = `${os.tmpdir()}/image-${image}-${Date.now()}`;
  // Avoid clutter stdout, as the caller will want to capture the final output to cd into it
  console.warn(`Creating build in ${destFolder}`);
  fs.mkdirSync(destFolder);

  // Copy Dockerfile
  console.warn(`COPYING Dockerfile`);
  fs.copySync(dockerFilePath, path.join(destFolder, "Dockerfile"));

  console.warn(`COPYING Docker image payload`);
  fs.copySync(dockerImagePayloadPath, destFolder);

  // Create config directory. It should be deleted by the docker image so that it can be mounted as a volume when the pod is run
  console.warn(`CREATING config for the build process`);
  fs.mkdirSync(path.join(destFolder, "config"));
  const envFileData = getMonorepoSecret(cmdObj.env);
  fs.writeFileSync(path.join(destFolder, `config/.env.global`), envFileData);

  // Copy all dependencies
  getImageDescendentData(image).forEach((project) => {
    console.warn(`COPYING ${project.rootPath}`);
    if (project.rootPath === ".devops") return;
    fs.copySync(project.rootPath, path.join(destFolder, project.rootPath));
  });

  // Copy all files in root
  console.warn(`COPYING all files in root`);
  const files = (await glob("*", { dot: true })).filter(
    (path) => !fs.lstatSync(path).isDirectory()
  );
  files.forEach((file) => fs.copyFileSync(file, path.join(destFolder, file)));

  console.log(destFolder);
}

export default {
  "prep-build": { oneLiner, keyExamples, run },
};
