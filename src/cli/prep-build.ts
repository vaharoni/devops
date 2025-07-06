import fs from "fs-extra";
import os from "os";
import path from "path";
import { CLICommandParser, printUsageAndExit } from "./common";
import { getImageData, getTemplateData } from "../libs/config";
import { getMonorepoSecret } from "../libs/k8s-secrets-manager";
import { getImageDescendentData } from "../libs/discovery/images";

const oneLiner =
  "Copies all dependencies of an image to a temporary folder in preparation for a Docker build";
const keyExamples = `
    $ devops prep-build main-node
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

  console.warn(`COPYING Docker image payload`);
  fs.copySync(dockerImagePayloadPath, destFolder);

  console.warn(`COPYING .devops/config`);
  fs.mkdirSync(path.join(destFolder, ".devops"));
  fs.copySync(".devops/config", path.join(destFolder, ".devops/config"));

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

  // Copy image-extra content
  console.warn(`COPYING files from image-extra-content`);
  imageExtraContent.forEach((file) => {
    fs.copySync(file, path.join(destFolder, file));
    console.warn(`  ${file}`);
  });

  console.log(destFolder);
}

export default {
  "prep-build": { oneLiner, keyExamples, run },
};
