import { randomBytes } from "crypto";
import { CommandExecutor } from "../cli/common";
import { containerRegistryRepoPath, isLocalOrRemoteEnv } from "./k8s-constants";
import { getImageData } from "./config";
import { getMonorepoSecretObject } from "./k8s-secrets-manager";
import chalk from "chalk";

function verifyCloudrunImage(image: string) {
  const imageData = getImageData(image);
  if (!imageData["cloudrun"]) {
    console.error(`Image ${image} is not a cloudrun image. Add "cloudrun: true" in images.yaml`);
    process.exit(1);
  }
}

function getEnvValuesToForward(env: string, forwardEnv: string[]) {
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
  if (missingValues.size > 0) {
    console.error(`Some forwardEnv variables are missing: ${Array.from(missingValues).join(", ")}`);
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
  }).exec().trim();

  const tag = containerRegistryRepoPath(image, env, sha);
  console.warn(`Building ${tag} from ${buildDir}`);

  await new CommandExecutor(
    `docker build --platform linux/amd64 -t ${tag} ${buildDir} --build-arg MONOREPO_ENV=${env}`,
    { env }
  ).spawn();

  console.warn(`Pushing ${tag}`);
  await new CommandExecutor(`docker push ${tag}`, { env }).spawn();

  console.warn(`\n✅ Built and pushed ${tag}\n`);
  console.warn('Run "devops cloudrun deploy" next. For example:')
  console.warn(chalk.blue(`./devops cloudrun deploy ${image} ${sha} --env ${env} --allow-unauthenticated --region us-east1 --forward-env ENV1,ENV2`));
  console.warn();
  console.log(tag);
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
  const envValues = getEnvValuesToForward(env, forwardEnv);
  const envValuesCsv = Object.entries(envValues).map(([key, value]) => `${key}="${value}"`).join(",");
  const serviceName = `${image}-${env}`;

  const cmd = `
    gcloud run deploy ${serviceName} 
      --image ${repoPath} 
      ${Object.keys(envValues).length > 0 ? `--set-env-vars ${envValuesCsv}` : ""} 
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