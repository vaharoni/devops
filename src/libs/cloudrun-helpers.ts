import { randomBytes } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import yaml from "yaml";
import { CommandExecutor } from "../cli/common";
import { containerRegistryRepoPath, isLocalOrRemoteEnv } from "./k8s-constants";
import { getImageData } from "./config";
import { getMonorepoSecretObject } from "./k8s-secrets-manager";
import { getImageDescendentData } from "./discovery/images";
import { globEnvYamlFiles } from "./discovery";
import { envRequirementsFromFiles } from "./env-scope";
import { buildEnvPathFor } from "./build-env";
import chalk from "chalk";

function verifyCloudrunImage(image: string) {
  const imageData = getImageData(image);
  if (!imageData["cloudrun"]) {
    console.error(`Image ${image} is not a cloudrun image. Add "cloudrun: true" in images.yaml`);
    process.exit(1);
  }
}

/** The env variables declared in the env.yaml files of the image's workspaces, split by whether they may be missing */
function declaredEnvForImage(image: string) {
  const workspaceNames = getImageDescendentData(image).map((project) => project.name);
  const requirements = envRequirementsFromFiles(globEnvYamlFiles(workspaceNames));
  // Cloud Run sets these itself and rejects attempts to override them
  const keys = Object.keys(requirements).filter((key) => key !== "PORT" && !key.startsWith("K_"));
  return {
    required: keys.filter((key) => requirements[key] !== "optional"),
    optional: keys.filter((key) => requirements[key] === "optional"),
  };
}

/** Missing optional keys are skipped. Missing required keys cause an exit. */
function getEnvValuesToForward(env: string, requiredKeys: string[], optionalKeys: string[] = []) {
  const forwardEnv = [...new Set([...requiredKeys, ...optionalKeys])];
  if (!forwardEnv.length) return {};
  
  let envValues: Record<string, string> = {};
  const missingValues = new Set<string>();
  for (const key of forwardEnv) {
    const value = process.env[key];
    if (value) {
      envValues[key] = value;
    } else {
      missingValues.add(key);
    }
  }
  if (missingValues.size > 0 && isLocalOrRemoteEnv(env) === "remote") {
    const secretsFromCluster = getMonorepoSecretObject(env, Array.from(missingValues));
    for (const key of Object.keys(secretsFromCluster)) {
      envValues[key] = secretsFromCluster[key];
      missingValues.delete(key);
    }
  }
  const missingRequired = requiredKeys.filter((key) => missingValues.has(key));
  if (missingRequired.length > 0) {
    console.error(`Some forwardEnv variables are missing: ${missingRequired.join(", ")}`);
    process.exit(1);
  }
  return envValues;
}

export async function buildDev(image: string) {
  verifyCloudrunImage(image);
  const env = "development";
  const sha = randomBytes(12).toString("hex");

  const buildDir = new CommandExecutor(`devops prep-build ${image}`, {
    env, 
    quiet: true
  }).exec().trim();

  const tag = containerRegistryRepoPath(image, env, sha);
  console.warn(`Building ${tag} from ${buildDir}`);

  await new CommandExecutor(
    `docker build --platform linux/amd64 -t ${tag} ${buildDir} --build-arg MONOREPO_ENV=${env} --secret id=env,src=${buildEnvPathFor(buildDir)}`,
    { env }
  ).spawn({ pipeStdoutTo: "stderr" });

  console.warn(`Pushing ${tag}`);
  await new CommandExecutor(`docker push ${tag}`, { env }).spawn({ pipeStdoutTo: "stderr" });

  console.warn(`\n✅ Built and pushed ${tag}\n`);
  console.warn('Run "devops cloudrun deploy" next. For example:')
  console.warn(chalk.blue(`./devops cloudrun deploy ${image} ${sha} --env ${env} --allow-unauthenticated --region us-east1 -- --service-account RUNTIME_SA`));
  console.warn(chalk.yellow(`\n\nRUNTIME_SA is the name of the service account used to run the Cloud Run service.`));
  console.warn(chalk.yellow(`Find it with "gcloud iam service-accounts list"\n`));
  console.log(sha);
}

export async function deploy({
  image,
  env,
  sha,
  region,
  forwardEnv = [],
  allowUnauthenticated = false,
  cpu = "0.25",
  memory = "256Mi",
  minInstances = 0,
  maxInstances = 1,
  timeout = "60s",
  extraArgs = "",
}: {
  image: string;
  env: string; 
  sha: string; 
  region: string;
  forwardEnv?: string[];
  allowUnauthenticated?: boolean;
  cpu?: string;
  memory?: string;
  minInstances?: number;
  maxInstances?: number;
  timeout?: string;
  extraArgs?: string;
}) {
  verifyCloudrunImage(image);
  const repoPath = containerRegistryRepoPath(image, env, sha);
  const declared = declaredEnvForImage(image);
  const envValues = getEnvValuesToForward(env, [...declared.required, ...forwardEnv], declared.optional);
  // Values are passed through a file rather than the command line so that the shell never interprets them
  const envVarsFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cloudrun-env-")), "env.yaml");
  fs.writeFileSync(envVarsFile, yaml.stringify(envValues), { mode: 0o600 });
  // CommandExecutor exits the process on failure, so cleanup is tied to process exit
  process.once("exit", () => fs.rmSync(path.dirname(envVarsFile), { recursive: true, force: true }));
  const serviceName = `${image}-${env}`;

  const cmd = `
    gcloud run deploy ${serviceName} 
      --image ${repoPath} 
      ${Object.keys(envValues).length > 0 ? `--env-vars-file ${envVarsFile}` : ""} 
      ${allowUnauthenticated ? "--allow-unauthenticated" : ""}
      --region ${region}
      --cpu ${cpu}
      --memory ${memory}
      --min-instances ${minInstances}
      --max-instances ${maxInstances}
      --timeout ${timeout}
      ${extraArgs}
  `.trim().replace(/\s+/g, " ");

  await new CommandExecutor(cmd, { env }).spawn();
}